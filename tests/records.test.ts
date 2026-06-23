import { describe, it, expect, vi } from 'vitest';
import { writeResult } from '../src/atproto/records.js';
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

    await expect(writeResult(session, result())).rejects.toThrow(/createRecord failed/);
  });
});
