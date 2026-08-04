/**
 * Reading and writing AT Mot records to/from PDSs.
 *
 * Writes go to the signed-in player's own repo via their OAuth session:
 *   - bzh.herve.atmot.result : one immutable record per puzzle (write-once,
 *     deterministic rkey `<lang>-<puzzleNumber>`).
 *   - bzh.herve.atmot.stats  : single mutable `self` record (also the player's
 *     "declaration" that they play AT Mot).
 *
 * Reads of other players' records (for the leaderboard) resolve the owner's PDS
 * and fetch over an unauthenticated client.
 */
import {
  COLLECTION,
  STATS_RKEY,
  resultRkey,
  puzzleTarget,
  puzzleDateTime,
  type Lang,
} from '../config.js';
import { TILE_CODE, type GameResult, type TileState } from '../engine/types.js';
import { computeNextStats, type StatsRecord } from '../engine/stats.js';
import {
  assembleShareText,
  defaultShareNote,
  buildShareFacets,
  buildShareEmbed,
} from '../engine/share.js';
import { TokenRefreshError } from '@atcute/oauth-browser-client';
import type { Session } from './oauth.js';
import { resolveActor, pdsClient } from './identity.js';
import { asDid, asNsid } from './brands.js';

export interface ResultRecord {
  $type: 'bzh.herve.atmot.result';
  lang: string;
  puzzleNumber: number;
  puzzleDate: string;
  solved: boolean;
  guessCount?: number;
  grid: Array<{ row: string }>;
  puzzleTarget: string;
  createdAt: string;
}

/** Encode tile rows as the compact `{ row: "GYBBB" }` form (colours only). */
function encodeGrid(rows: TileState[][]): Array<{ row: string }> {
  return rows.map((states) => ({ row: states.map((s) => TILE_CODE[s]).join('') }));
}

export function buildResultRecord(result: GameResult, createdAt: string): ResultRecord {
  const rec: ResultRecord = {
    $type: 'bzh.herve.atmot.result',
    lang: result.lang,
    puzzleNumber: result.puzzleNumber,
    puzzleDate: puzzleDateTime(result.puzzleNumber),
    solved: result.solved,
    grid: encodeGrid(result.rows),
    puzzleTarget: puzzleTarget(result.lang as Lang, result.puzzleNumber),
    createdAt,
  };
  if (result.solved && result.guessCount != null) rec.guessCount = result.guessCount;
  return rec;
}

/**
 * Thrown when an XRPC write is rejected.
 *
 * A save that fails is otherwise invisible: the caller only learns that
 * *something* went wrong, which is useless when the failure repeats every day
 * on one PDS but not another. Keep the calling method, the collection, the HTTP
 * status and the PDS's own error body together in the message so it can be read
 * off a toast or a console line without a debugger attached, and keep `status`
 * and `errorName` as fields so callers can branch on them without parsing text.
 */
export class WriteFailedError extends Error {
  override readonly name = 'WriteFailedError';
  readonly status: number | undefined;
  readonly collection: string;
  readonly errorName: string | undefined;

  constructor(method: string, collection: string, res: { status?: number; data?: unknown }) {
    const status = typeof res.status === 'number' ? `HTTP ${res.status}` : 'no status';
    super(`${method} ${collection} failed (${status}): ${JSON.stringify(res.data)}`);
    this.status = typeof res.status === 'number' ? res.status : undefined;
    this.collection = collection;
    const name = (res.data as { error?: unknown } | undefined)?.error;
    this.errorName = typeof name === 'string' ? name : undefined;
  }
}

/** PDS error names that mean "this session is no longer usable". */
const AUTH_ERROR_NAMES = new Set([
  'invalidtoken',
  'expiredtoken',
  'authenticationrequired',
  'authmissing',
  'invalid_token',
]);

/**
 * True when a failure means the player is effectively signed out, rather than
 * that this particular write was bad.
 *
 * Worth distinguishing carefully. When the access token is dead the PDS answers
 * 401 `invalid_token`; atcute then attempts a refresh and, if the refresh token
 * has been revoked too, hands the original 401 back instead of throwing. So a
 * signed-out player produces an ordinary rejected response, not an auth
 * exception — and treating it as a plain write failure is what let a dead
 * session masquerade as a working one. Conversely, a genuine bad-record
 * rejection must NOT be read as a sign-out, or a working session gets thrown
 * away over an unrelated error.
 */
export function isAuthFailure(err: unknown): boolean {
  if (err instanceof TokenRefreshError) return true;
  if (err instanceof WriteFailedError) {
    if (err.status === 401) return true;
    if (err.errorName && AUTH_ERROR_NAMES.has(err.errorName.toLowerCase())) return true;
  }
  return false;
}

/**
 * One-line, length-bounded description of a failed write, for the toast shown
 * to the player. The untruncated error still goes to the console.
 */
export function describeWriteError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.length > 200 ? `${msg.slice(0, 199)}…` : msg;
}

/** True if the createRecord error means "this rkey already exists" (write-once hit). */
function isAlreadyExists(err: unknown): boolean {
  const msg = String((err as { message?: string })?.message ?? err);
  return /already exists|RecordAlreadyExists|conflict/i.test(msg);
}

/** True if the player's own result record for this rkey already exists in their repo. */
async function resultExists(session: Session, rkey: string): Promise<boolean> {
  const res = await session.rpc.get('com.atproto.repo.getRecord', {
    params: {
      repo: session.did as `did:${string}:${string}`,
      collection: COLLECTION.result,
      rkey,
    },
  });
  return res.ok;
}

/**
 * Write the immutable result record. Returns true if newly created, false if it
 * already existed (re-finishing the same puzzle is a no-op, not an error).
 *
 * The rkey is deterministic and the record is write-once, so reopening a finished
 * puzzle re-attempts the same create on every load. We check existence first and
 * skip the doomed write, because a duplicate createRecord is rejected by the PDS
 * with an opaque 500 (`InternalServerError`) that no error-string heuristic can
 * reliably distinguish from a genuine failure.
 */
export async function writeResult(session: Session, result: GameResult): Promise<boolean> {
  const rkey = resultRkey(result.lang as Lang, result.puzzleNumber);
  if (await resultExists(session, rkey)) return false;

  const record = buildResultRecord(result, new Date().toISOString());
  const res = await session.rpc.post('com.atproto.repo.createRecord', {
    input: {
      repo: session.did as `did:${string}:${string}`,
      collection: COLLECTION.result,
      rkey,
      record: record as unknown as Record<string, unknown>,
    },
  });
  if (res.ok) return true;
  // Another tab or device may have won the race between our check and our write;
  // a create that lost that race is still a no-op, not an error.
  if (isAlreadyExists(res.data) || (await resultExists(session, rkey))) return false;
  throw new WriteFailedError('createRecord', COLLECTION.result, res);
}

/** Read the player's own stats record, or null if they have none yet. */
export async function readMyStats(session: Session): Promise<StatsRecord | null> {
  const res = await session.rpc.get('com.atproto.repo.getRecord', {
    params: {
      repo: session.did as `did:${string}:${string}`,
      collection: COLLECTION.stats,
      rkey: STATS_RKEY,
    },
  });
  if (!res.ok) return null;
  return res.data.value as unknown as StatsRecord;
}

/** Upsert the single mutable `self` stats record. */
export async function writeStats(session: Session, stats: StatsRecord): Promise<void> {
  const res = await session.rpc.post('com.atproto.repo.putRecord', {
    input: {
      repo: session.did as `did:${string}:${string}`,
      collection: COLLECTION.stats,
      rkey: STATS_RKEY,
      record: stats as unknown as Record<string, unknown>,
    },
  });
  if (!res.ok) throw new WriteFailedError('putRecord', COLLECTION.stats, res);
}

/**
 * Persist a completed game: write the immutable result, then advance stats.
 * Only advances stats when the result was newly written (so re-finishing the
 * same puzzle can't double-count). Returns the updated stats.
 */
export async function recordCompletedGame(
  session: Session,
  result: GameResult,
): Promise<StatsRecord> {
  const created = await writeResult(session, result);
  const prev = await readMyStats(session);
  if (!created && prev) return prev; // already recorded; leave stats untouched
  const next = computeNextStats(prev, result, new Date().toISOString());
  await writeStats(session, next);
  return next;
}

/**
 * Create the declaration/stats record on first sign-in even before any game, so
 * the account is discoverable as an AT Mot player. No-op if it already exists.
 */
export async function ensureDeclaration(session: Session): Promise<void> {
  const existing = await readMyStats(session);
  if (existing) return;
  await writeStats(session, {
    $type: 'bzh.herve.atmot.stats',
    byLang: [],
    updatedAt: new Date().toISOString(),
  });
}

/** Parse an at:// URI into its components. */
export function parseAtUri(uri: string): { did: string; collection: string; rkey: string } | null {
  const m = /^at:\/\/([^/]+)\/([^/]+)\/([^/]+)$/.exec(uri);
  if (!m) return null;
  return { did: m[1]!, collection: m[2]!, rkey: m[3]! };
}

/**
 * Validate an untrusted value fetched from a foreign PDS against the
 * `bzh.herve.atmot.result` lexicon shape before it is trusted in the public
 * leaderboard aggregate. A player who controls their PDS (or self-hosts a lax
 * one that does not enforce the lexicon) can return a result record with
 * out-of-range or wrong-typed fields — e.g. a `guessCount` of 1e9, negative, or
 * a string — which would otherwise be summed straight into the shared "average
 * guesses" and guess distribution. Returns the typed record only when every
 * field conforms to the lexicon (types, `puzzleNumber` >= 1, and `guessCount`
 * within its 1..6 range); returns null so a non-conforming record is dropped
 * rather than folded in.
 */
export function parseResultRecord(value: unknown): ResultRecord | null {
  if (typeof value !== 'object' || value === null) return null;
  const v = value as Record<string, unknown>;

  if (v.$type !== 'bzh.herve.atmot.result') return null;
  if (typeof v.lang !== 'string') return null;
  if (typeof v.puzzleNumber !== 'number' || !Number.isInteger(v.puzzleNumber) || v.puzzleNumber < 1) {
    return null;
  }
  if (typeof v.puzzleDate !== 'string') return null;
  if (typeof v.solved !== 'boolean') return null;
  if (typeof v.puzzleTarget !== 'string') return null;
  if (typeof v.createdAt !== 'string') return null;

  // Optional (absent on a loss); when present it must be an integer in 1..6.
  if (v.guessCount != null) {
    if (
      typeof v.guessCount !== 'number' ||
      !Number.isInteger(v.guessCount) ||
      v.guessCount < 1 ||
      v.guessCount > 6
    ) {
      return null;
    }
  }

  // Optional; when present it must be an array (<= 6 rows) of `{ row: string }`.
  if (v.grid != null) {
    if (!Array.isArray(v.grid) || v.grid.length > 6) return null;
    for (const row of v.grid as unknown[]) {
      if (typeof row !== 'object' || row === null) return null;
      if (typeof (row as Record<string, unknown>).row !== 'string') return null;
    }
  }

  return value as ResultRecord;
}

/**
 * Public read of any record by AT-URI (resolves the owner's PDS). Returns the
 * record value or null on any failure (callers degrade gracefully).
 *
 * The record value comes from a PDS the record's owner controls, so it is
 * untrusted: callers that fold foreign records into shared state pass a
 * `validate` function (e.g. `parseResultRecord`) to check the value against its
 * lexicon shape here, at the trust boundary, instead of casting it blindly.
 * A validator that returns null drops the record.
 */
export async function getRecordByUri<T = unknown>(
  uri: string,
  validate?: (value: unknown) => T | null,
): Promise<T | null> {
  const parts = parseAtUri(uri);
  if (!parts) return null;
  try {
    const actor = await resolveActor(parts.did);
    const rpc = pdsClient(actor.pds);
    const res = await rpc.get('com.atproto.repo.getRecord', {
      params: {
        repo: asDid(parts.did),
        collection: asNsid(parts.collection),
        rkey: parts.rkey,
      },
    });
    if (!res.ok) return null;
    const value = res.data.value as unknown;
    return validate ? validate(value) : (value as T);
  } catch {
    return null;
  }
}

/**
 * Create the spoiler-free share post as a standard app.bsky.feed.post.
 *
 * NOTE: the user-facing label is "Share to atproto" (open-protocol framing), but
 * the record created is intentionally an app.bsky.feed.post — that's the Bluesky
 * microblog lexicon, so it surfaces in Bluesky and compatible clients. This is by
 * design, not a bug. We deliberately do NOT store the returned uri/cid anywhere:
 * the permalink embedded in the post text is the only linkage Constellation needs.
 */
export async function sharePost(
  session: Session,
  result: GameResult,
  note?: string,
): Promise<{ uri: string }> {
  const text = assembleShareText(result, note ?? defaultShareNote(result));
  const res = await session.rpc.post('com.atproto.repo.createRecord', {
    input: {
      repo: session.did as `did:${string}:${string}`,
      collection: 'app.bsky.feed.post',
      record: {
        $type: 'app.bsky.feed.post',
        text,
        createdAt: new Date().toISOString(),
        langs: [result.lang],
        // The permalink must be a real link feature (facet) + embed so
        // Constellation can discover this post as a backlink to the puzzle.
        facets: buildShareFacets(result, note),
        embed: buildShareEmbed(result),
      } as unknown as Record<string, unknown>,
    },
  });
  if (!res.ok) throw new WriteFailedError('createRecord', 'app.bsky.feed.post', res);
  return { uri: res.data.uri };
}
