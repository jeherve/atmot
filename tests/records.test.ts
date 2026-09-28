import { describe, it, expect, vi } from 'vitest';
import {
  writeResult,
  writeStats,
  sharePost,
  parseResultRecord,
  describeWriteError,
  isAuthFailure,
  WriteFailedError,
} from '../src/atproto/records.js';
import { TokenRefreshError } from '@atcute/oauth-browser-client';
import { COLLECTION, resultRkey } from '../src/config.js';
import type { GameResult } from '../src/engine/types.js';
import type { Session } from '../src/atproto/oauth.js';

const DID = 'did:plc:bqrdkv2mlluts24tici7wcnl';

function result(): GameResult {
  return {
    lang: 'fr',
    puzzleNumber: 1,
    solved: true,
    guessCount: 5,
    rows: [],
  };
}

/** Build a fake Session whose rpc.get/rpc.post are vitest mocks. */
function fakeSession(over: {
  get?: (args: unknown) => unknown;
  post?: (args: unknown) => unknown;
}): { session: Session; get: ReturnType<typeof vi.fn>; post: ReturnType<typeof vi.fn> } {
  const get = vi.fn(over.get ?? (() => ({ ok: false, data: {} })));
  const post = vi.fn(over.post ?? (() => ({ ok: true, data: { uri: 'at://x' } })));
  const session = { did: DID, rpc: { get, post } } as unknown as Session;
  return { session, get, post };
}

function sharedResult(): GameResult {
  return {
    lang: 'fr',
    puzzleNumber: 412,
    solved: true,
    guessCount: 4,
    rows: [['correct', 'correct', 'correct', 'correct', 'correct']],
  };
}

describe('sharePost', () => {
  it('posts the default header text when no note is given', async () => {
    const { session, post } = fakeSession({});
    await sharePost(session, sharedResult());
    const rec = (post.mock.calls[0]![1] as { input: { record: { text: string } } }).input.record;
    expect(rec.text).toContain('AT Mot 412 (FR) 4/6 #puzzlesurf');
    expect(rec.text.trimEnd().endsWith('https://atmot.herve.bzh/p/fr/412')).toBe(true);
  });

  it('posts a custom note and recomputes facets to point at the link', async () => {
    const { session, post } = fakeSession({});
    await sharePost(session, sharedResult(), 'Réussi ! 🎉');
    const rec = (post.mock.calls[0]![1] as {
      input: { record: { text: string; facets: Array<{ index: { byteStart: number; byteEnd: number } }> } };
    }).input.record;
    expect(rec.text).toContain('Réussi ! 🎉');
    expect(rec.text).not.toContain('AT Mot');
    const bytes = new TextEncoder().encode(rec.text);
    const f = rec.facets[0]!;
    const slice = new TextDecoder().decode(bytes.slice(f.index.byteStart, f.index.byteEnd));
    expect(slice).toBe('https://atmot.herve.bzh/p/fr/412');
  });
});

describe('parseResultRecord', () => {
  // A record shaped exactly as buildResultRecord / the result.json lexicon emit it.
  function conformant(over: Record<string, unknown> = {}): Record<string, unknown> {
    return {
      $type: 'bzh.herve.atmot.result',
      lang: 'en',
      puzzleNumber: 412,
      puzzleDate: '2027-08-08T00:00:00.000Z',
      solved: true,
      guessCount: 4,
      grid: [{ row: 'GYBBB' }],
      puzzleTarget: 'https://atmot.herve.bzh/p/en/412',
      createdAt: '2027-08-08T12:00:00.000Z',
      ...over,
    };
  }

  it('passes a conformant result record through unchanged', () => {
    const rec = conformant();
    expect(parseResultRecord(rec)).toEqual(rec);
  });

  it('accepts a loss with no guessCount', () => {
    const rec = conformant({ solved: false, guessCount: undefined });
    expect(parseResultRecord(rec)).toEqual(rec);
  });

  it('drops an out-of-range guessCount that would inflate the average', () => {
    expect(parseResultRecord(conformant({ guessCount: 1_000_000 }))).toBeNull();
    expect(parseResultRecord(conformant({ guessCount: 0 }))).toBeNull();
    expect(parseResultRecord(conformant({ guessCount: -5 }))).toBeNull();
  });

  it('drops a non-integer guessCount', () => {
    expect(parseResultRecord(conformant({ guessCount: 3.5 }))).toBeNull();
    expect(parseResultRecord(conformant({ guessCount: Number.NaN }))).toBeNull();
  });

  it('drops a string guessCount that would render the average as NaN', () => {
    expect(parseResultRecord(conformant({ guessCount: '1000000' }))).toBeNull();
  });

  it('drops a record whose solved flag is the wrong type', () => {
    expect(parseResultRecord(conformant({ solved: 'yes' }))).toBeNull();
  });

  it('drops a record with a malformed grid', () => {
    expect(parseResultRecord(conformant({ grid: [{ row: 5 }] }))).toBeNull();
    expect(parseResultRecord(conformant({ grid: 'GYBBB' }))).toBeNull();
  });

  it('drops a wrong puzzleNumber type or missing required field', () => {
    expect(parseResultRecord(conformant({ puzzleNumber: '412' }))).toBeNull();
    expect(parseResultRecord(conformant({ puzzleNumber: 0 }))).toBeNull();
    expect(parseResultRecord(conformant({ solved: undefined }))).toBeNull();
  });

  it('drops non-objects and foreign record types', () => {
    expect(parseResultRecord(null)).toBeNull();
    expect(parseResultRecord('nope')).toBeNull();
    expect(parseResultRecord(conformant({ $type: 'app.bsky.feed.post' }))).toBeNull();
  });
});

describe('writeResult', () => {
  it('is a no-op replay when the record already exists (PDS returns an opaque 500)', async () => {
    // The result already lives in the repo (write-once). The PDS rejects a
    // duplicate createRecord with an unmapped Internal Server Error.
    const { session, post } = fakeSession({
      get: () => ({ ok: true, data: { value: { $type: COLLECTION.result } } }),
      post: () => ({ ok: false, data: { error: 'InternalServerError', message: 'Internal Server Error' } }),
    });

    const created = await writeResult(session, result());

    expect(created).toBe(false);
    // We must not attempt the doomed createRecord once we know it exists.
    expect(post).not.toHaveBeenCalled();
  });

  it('creates the record when it does not yet exist', async () => {
    const { session, post } = fakeSession({
      get: () => ({ ok: false, data: {} }), // not found
      post: () => ({ ok: true, data: { uri: 'at://x' } }),
    });

    const created = await writeResult(session, result());

    expect(created).toBe(true);
    expect(post).toHaveBeenCalledTimes(1);
    const arg = post.mock.calls[0]![1] as { input: { rkey: string; collection: string } };
    expect(arg.input.rkey).toBe(resultRkey('fr', 1));
    expect(arg.input.collection).toBe(COLLECTION.result);
  });

  it('tolerates a lost create race (record appears between check and create)', async () => {
    let getCalls = 0;
    const { session } = fakeSession({
      get: () => {
        getCalls += 1;
        // First check: absent. Re-check after the failed create: present.
        return getCalls === 1
          ? { ok: false, data: {} }
          : { ok: true, data: { value: { $type: COLLECTION.result } } };
      },
      post: () => ({ ok: false, data: { error: 'InternalServerError', message: 'Internal Server Error' } }),
    });

    const created = await writeResult(session, result());

    expect(created).toBe(false);
  });

  it('throws on a genuine create failure when the record is truly absent', async () => {
    const { session } = fakeSession({
      get: () => ({ ok: false, data: {} }), // absent before and after
      post: () => ({ ok: false, data: { error: 'InvalidRecord', message: 'bad' } }),
    });

    await expect(writeResult(session, result())).rejects.toThrow(/createRecord .* failed/);
  });

  // A save that fails every day is only fixable if the PDS's own explanation
  // survives. The thrown error must carry the collection, the HTTP status and
  // the PDS error body, so the toast and the console can show why.
  it('names the collection, status and PDS error body when the create fails', async () => {
    const { session } = fakeSession({
      get: () => ({ ok: false, status: 400, data: {} }),
      post: () => ({
        ok: false,
        status: 403,
        data: { error: 'InvalidToken', message: 'Bad token scope' },
      }),
    });

    await expect(writeResult(session, result())).rejects.toThrow(
      /createRecord.*bzh\.herve\.atmot\.result.*403.*InvalidToken.*Bad token scope/s,
    );
  });
});

describe('writeStats', () => {
  it('names putRecord, the collection, status and PDS error body when it fails', async () => {
    const { session } = fakeSession({
      post: () => ({ ok: false, status: 429, data: { error: 'RateLimitExceeded' } }),
    });

    await expect(
      writeStats(session, {
        $type: 'bzh.herve.atmot.stats',
        byLang: [],
        updatedAt: '2026-08-03T00:00:00.000Z',
      }),
    ).rejects.toThrow(/putRecord.*bzh\.herve\.atmot\.stats.*429.*RateLimitExceeded/s);
  });
});

describe('isAuthFailure', () => {
  // The PDS answers a dead token with 401 invalid_token; atcute tries to refresh,
  // the refresh fails, and it hands the 401 back rather than throwing. That is
  // the shape a signed-out player actually produces, so it must be recognised.
  it('recognises a 401 from the PDS', async () => {
    const { session } = fakeSession({
      get: () => ({ ok: false, status: 401, data: { error: 'InvalidToken' } }),
      post: () => ({ ok: false, status: 401, data: { error: 'InvalidToken' } }),
    });

    const err = await writeResult(session, result()).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(WriteFailedError);
    expect(isAuthFailure(err)).toBe(true);
  });

  it('recognises a token error name even without a 401 status', () => {
    const err = new WriteFailedError('createRecord', COLLECTION.result, {
      data: { error: 'ExpiredToken', message: 'Token has expired' },
    });
    expect(isAuthFailure(err)).toBe(true);
  });

  it('recognises a failed token refresh thrown by atcute', () => {
    const err = new TokenRefreshError('did:plc:abc' as never, 'session was revoked');
    expect(isAuthFailure(err)).toBe(true);
  });

  // A genuine save problem must NOT sign the player out — that would throw away
  // a working session over an unrelated PDS error.
  it('does not treat an ordinary write rejection as an auth failure', () => {
    const err = new WriteFailedError('createRecord', COLLECTION.result, {
      status: 400,
      data: { error: 'InvalidRecord', message: 'bad' },
    });
    expect(isAuthFailure(err)).toBe(false);
  });

  it('does not treat an arbitrary error as an auth failure', () => {
    expect(isAuthFailure(new Error('network down'))).toBe(false);
    expect(isAuthFailure(null)).toBe(false);
  });
});

describe('describeWriteError', () => {
  it('keeps the message of a thrown Error so the toast can show the reason', () => {
    expect(describeWriteError(new Error('createRecord failed (HTTP 403): nope'))).toBe(
      'createRecord failed (HTTP 403): nope',
    );
  });

  it('stringifies a non-Error rejection', () => {
    expect(describeWriteError('network down')).toBe('network down');
  });

  // The toast is a single transient line; an unbounded PDS body would bury the
  // rest of the UI (the full text still goes to the console).
  it('truncates a very long message', () => {
    const out = describeWriteError(new Error('x'.repeat(500)));
    expect(out.length).toBeLessThanOrEqual(200);
    expect(out.endsWith('…')).toBe(true);
  });
});
