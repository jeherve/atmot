/**
 * Constellation (microcosm) backlink-index client — the no-database read side.
 *
 * Constellation indexes *links* and returns counts and lists of backlinks; it
 * cannot aggregate over scalar fields. So: get the result-record list from
 * Constellation, then fetch those records and aggregate (average, distribution)
 * in the browser.
 *
 * Etiquette & resilience (spec §10): descriptive User-Agent, client-side caching,
 * graceful degradation. Every function returns null / empty on failure rather
 * than throwing, so the UI degrades instead of crashing.
 */
import {
  CONSTELLATION_BASE,
  USER_AGENT,
  COLLECTION,
  puzzleTarget,
  type Lang,
} from '../config.js';

/** Backlink record as returned by getBacklinks. */
export interface BacklinkRecord {
  did: string;
  collection: string;
  rkey: string;
}

// Link paths Constellation indexes (discovered from the live instance).
const PATH = {
  resultTarget: 'puzzleTarget', // bzh.herve.atmot.result -> .puzzleTarget
  postFacetLink: 'facets[].features[app.bsky.richtext.facet#link].uri',
  postEmbedLink: 'embed.external.uri',
  subjectUri: 'subject.uri', // likes / reposts
  replyParent: 'reply.parent.uri',
} as const;

// ---- tiny client-side TTL cache -------------------------------------------

interface CacheEntry {
  at: number;
  value: unknown;
}
const cache = new Map<string, CacheEntry>();
const TTL_MS = 60_000;

async function cached<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value as T;
  const value = await fn();
  cache.set(key, { at: Date.now(), value });
  return value;
}

// ---- low-level fetch -------------------------------------------------------

async function get(path: string, params: Record<string, string>): Promise<any | null> {
  const url = new URL(path, CONSTELLATION_BASE);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  try {
    const res = await fetch(url, {
      headers: { accept: 'application/json', 'user-agent': USER_AGENT },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null; // network / CORS / down — degrade gracefully
  }
}

/** Distinct DIDs linking to `target` at (collection, dottedPath). Null on failure. */
export async function countDistinctDids(
  target: string,
  collection: string,
  dottedPath: string,
): Promise<number | null> {
  const data = await get('/links/count/distinct-dids', {
    target,
    collection,
    path: dottedPath.startsWith('.') ? dottedPath : `.${dottedPath}`,
  });
  return typeof data?.total === 'number' ? data.total : null;
}

/** One page of backlinks. `path` is the non-dotted source path. */
export async function getBacklinks(
  target: string,
  collection: string,
  path: string,
  opts: { limit?: number; cursor?: string } = {},
): Promise<{ total: number; records: BacklinkRecord[]; cursor: string | null } | null> {
  const params: Record<string, string> = {
    subject: target,
    source: `${collection}:${path}`,
    limit: String(opts.limit ?? 100),
  };
  if (opts.cursor) params.cursor = opts.cursor;
  const data = await get('/xrpc/blue.microcosm.links.getBacklinks', params);
  if (!data || !Array.isArray(data.records)) return null;
  return { total: data.total ?? data.records.length, records: data.records, cursor: data.cursor ?? null };
}

/** Page through backlinks up to `cap` records (merged across pages). */
export async function collectBacklinks(
  target: string,
  collection: string,
  path: string,
  cap = 200,
): Promise<BacklinkRecord[]> {
  const out: BacklinkRecord[] = [];
  let cursor: string | undefined;
  for (let i = 0; i < 10 && out.length < cap; i++) {
    const page = await getBacklinks(target, collection, path, { limit: 100, cursor });
    if (!page) break;
    out.push(...page.records);
    if (!page.cursor) break;
    cursor = page.cursor;
  }
  return out.slice(0, cap);
}

// ---- AT Mot high-level queries --------------------------------------------

/** "N players recorded this puzzle" — distinct DIDs with a result record. Null = unknown. */
export function dailyPlayerCount(lang: Lang, puzzleNumber: number): Promise<number | null> {
  const target = puzzleTarget(lang, puzzleNumber);
  return cached(`players:${target}`, () =>
    countDistinctDids(target, COLLECTION.result, PATH.resultTarget),
  );
}

/** Enumerate the result records for a puzzle (capped). */
export function dailyResultBacklinks(
  lang: Lang,
  puzzleNumber: number,
  cap = 200,
): Promise<BacklinkRecord[]> {
  const target = puzzleTarget(lang, puzzleNumber);
  return cached(`results:${target}:${cap}`, () =>
    collectBacklinks(target, COLLECTION.result, PATH.resultTarget, cap),
  );
}

/** Enumerate shared posts about a puzzle (via facet + embed link paths, deduped). */
export function sharedPostBacklinks(
  lang: Lang,
  puzzleNumber: number,
  cap = 100,
): Promise<BacklinkRecord[]> {
  const target = puzzleTarget(lang, puzzleNumber);
  return cached(`posts:${target}:${cap}`, async () => {
    const [byFacet, byEmbed] = await Promise.all([
      collectBacklinks(target, 'app.bsky.feed.post', PATH.postFacetLink, cap),
      collectBacklinks(target, 'app.bsky.feed.post', PATH.postEmbedLink, cap),
    ]);
    const seen = new Set<string>();
    const merged: BacklinkRecord[] = [];
    for (const r of [...byFacet, ...byEmbed]) {
      const key = `${r.did}/${r.rkey}`;
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(r);
    }
    return merged.slice(0, cap);
  });
}

/** Live engagement on a shared post (distinct DIDs). Each field null when unknown. */
export function postEngagement(
  postUri: string,
): Promise<{ likes: number | null; reposts: number | null; replies: number | null }> {
  return cached(`engagement:${postUri}`, async () => {
    const [likes, reposts, replies] = await Promise.all([
      countDistinctDids(postUri, 'app.bsky.feed.like', PATH.subjectUri),
      countDistinctDids(postUri, 'app.bsky.feed.repost', PATH.subjectUri),
      countDistinctDids(postUri, 'app.bsky.feed.post', PATH.replyParent),
    ]);
    return { likes, reposts, replies };
  });
}

/** Build the at:// URI for a backlink record. */
export function backlinkUri(r: BacklinkRecord): string {
  return `at://${r.did}/${r.collection}/${r.rkey}`;
}
