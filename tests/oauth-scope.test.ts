import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { COLLECTION } from '../src/config.js';

// Resolve paths relative to the repo root (this file is in tests/).
const root = fileURLToPath(new URL('..', import.meta.url));

const metadata = JSON.parse(readFileSync(root + 'public/client-metadata.json', 'utf8'));
const scopes: string[] = String(metadata.scope).split(/\s+/).filter(Boolean);

/** Find the granted `repo:<nsid>` token for a collection, or undefined. */
const repoScope = (nsid: string) =>
  scopes.find((s) => s === `repo:${nsid}` || s.startsWith(`repo:${nsid}?`));

describe('OAuth scope (client-metadata.json)', () => {
  it('requests the base atproto scope', () => {
    expect(scopes).toContain('atproto');
  });

  it('uses granular least-privilege scopes, never broad transition:generic', () => {
    // The whole point: AT Mot must not request blanket repo access.
    expect(scopes).not.toContain('transition:generic');
    expect(scopes.some((s) => s.startsWith('transition:'))).toBe(false);
  });

  it('grants create on the write-once result collection', () => {
    const s = repoScope(COLLECTION.result);
    expect(s, `missing repo scope for ${COLLECTION.result}`).toBeDefined();
    expect(s).toContain('action=create');
  });

  it('grants create+update on the mutable stats collection', () => {
    const s = repoScope(COLLECTION.stats);
    expect(s, `missing repo scope for ${COLLECTION.stats}`).toBeDefined();
    expect(s).toContain('action=create');
    expect(s).toContain('action=update');
  });

  it('grants create on app.bsky.feed.post for the share', () => {
    const s = repoScope('app.bsky.feed.post');
    expect(s, 'missing repo scope for app.bsky.feed.post').toBeDefined();
    expect(s).toContain('action=create');
  });

  it('does not request write access to any other collection', () => {
    const allowed = new Set([COLLECTION.result, COLLECTION.stats, 'app.bsky.feed.post']);
    const repoNsids = scopes
      .filter((s) => s.startsWith('repo:'))
      .map((s) => s.slice('repo:'.length).split('?')[0]!);
    for (const nsid of repoNsids) {
      expect(allowed.has(nsid), `unexpected repo scope: ${nsid}`).toBe(true);
    }
  });
});
