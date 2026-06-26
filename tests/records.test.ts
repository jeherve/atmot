import { describe, it, expect, vi } from 'vitest';
import { writeResult, sharePost } from '../src/atproto/records.js';
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
    expect(rec.text).toContain('AT Mot 412 (FR) 4/6');
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
