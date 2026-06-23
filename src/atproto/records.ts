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
import { buildShareText, buildShareFacets, buildShareEmbed } from '../engine/share.js';
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
  throw new Error(`createRecord failed: ${JSON.stringify(res.data)}`);
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
  if (!res.ok) throw new Error(`putRecord stats failed: ${JSON.stringify(res.data)}`);
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
 * Public read of any record by AT-URI (resolves the owner's PDS). Returns the
 * record value or null on any failure (callers degrade gracefully).
 */
export async function getRecordByUri<T = unknown>(uri: string): Promise<T | null> {
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
    return res.data.value as unknown as T;
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
export async function sharePost(session: Session, result: GameResult): Promise<{ uri: string }> {
  const text = buildShareText(result);
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
        facets: buildShareFacets(result),
        embed: buildShareEmbed(result),
      } as unknown as Record<string, unknown>,
    },
  });
  if (!res.ok) throw new Error(`share post failed: ${JSON.stringify(res.data)}`);
  return { uri: res.data.uri };
}
