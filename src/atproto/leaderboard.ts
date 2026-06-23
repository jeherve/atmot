/**
 * Browser-side aggregation for the per-puzzle results page.
 *
 * Constellation gives us the *list* of result records and shared posts; the
 * averages, distributions, and sorting are computed here in the browser (spec
 * §10). Everything degrades gracefully: missing data shrinks the view, never
 * breaks it.
 */
import type { Lang } from '../config.js';
import type { GuessBucket } from '../engine/stats.js';
import {
  dailyPlayerCount,
  dailyResultBacklinks,
  sharedPostBacklinks,
  postEngagement,
  backlinkUri,
} from './constellation.js';
import { getRecordByUri, type ResultRecord } from './records.js';
import { handleForDid } from './identity.js';

/** Run async `fn` over items with bounded concurrency. */
async function pMap<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  async function worker(): Promise<void> {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx]!);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

export interface LeaderboardEntry {
  did: string;
  handle: string;
  solved: boolean;
  guessCount?: number;
}

export interface DailyStats {
  lang: Lang;
  puzzleNumber: number;
  /** Distinct players from Constellation's cheap count (headline number). */
  players: number | null;
  /** How many of the sampled results were solved. */
  solvers: number;
  /** Average winning guesses, or null when no solvers. */
  averageGuesses: number | null;
  guessDistribution: GuessBucket[];
  /** Sampled, sorted leaderboard rows (fewest guesses first). */
  entries: LeaderboardEntry[];
  /** True if we hit the sample cap (more results exist than were aggregated). */
  sampled: boolean;
  /** True if Constellation was unreachable. */
  degraded: boolean;
}

const SAMPLE_CAP = 200;

export async function getDailyStats(
  lang: Lang,
  puzzleNumber: number,
): Promise<DailyStats> {
  const [players, backlinks] = await Promise.all([
    dailyPlayerCount(lang, puzzleNumber),
    dailyResultBacklinks(lang, puzzleNumber, SAMPLE_CAP),
  ]);

  const records = await pMap(backlinks, 8, (r) => getRecordByUri<ResultRecord>(backlinkUri(r)));

  const entries: LeaderboardEntry[] = [];
  const dist = new Map<number, number>();
  let solvers = 0;
  let guessTotal = 0;

  await pMap(
    backlinks.map((bl, idx) => ({ bl, rec: records[idx] })),
    8,
    async ({ bl, rec }) => {
      if (!rec || rec.lang !== lang || rec.puzzleNumber !== puzzleNumber) return;
      const handle = await handleForDid(bl.did);
      const entry: LeaderboardEntry = { did: bl.did, handle, solved: rec.solved };
      if (rec.solved && rec.guessCount != null) {
        entry.guessCount = rec.guessCount;
        solvers++;
        guessTotal += rec.guessCount;
        dist.set(rec.guessCount, (dist.get(rec.guessCount) ?? 0) + 1);
      }
      entries.push(entry);
    },
  );

  entries.sort((a, b) => {
    if (a.solved !== b.solved) return a.solved ? -1 : 1;
    return (a.guessCount ?? 99) - (b.guessCount ?? 99);
  });

  const guessDistribution: GuessBucket[] = [...dist.entries()]
    .map(([guesses, count]) => ({ guesses, count }))
    .sort((a, b) => a.guesses - b.guesses);

  return {
    lang,
    puzzleNumber,
    players,
    solvers,
    averageGuesses: solvers > 0 ? Math.round((guessTotal / solvers) * 100) : null,
    guessDistribution,
    entries,
    sampled: backlinks.length >= SAMPLE_CAP,
    degraded: players === null && backlinks.length === 0,
  };
}

export interface SharedPost {
  did: string;
  handle: string;
  uri: string;
  text?: string;
  engagement: { likes: number | null; reposts: number | null; replies: number | null };
}

export async function getSharedPosts(lang: Lang, puzzleNumber: number): Promise<SharedPost[]> {
  const backlinks = await sharedPostBacklinks(lang, puzzleNumber, 50);
  const posts = await pMap(backlinks, 6, async (r) => {
    const uri = backlinkUri(r);
    const [handle, rec, engagement] = await Promise.all([
      handleForDid(r.did),
      getRecordByUri<{ text?: string }>(uri),
      postEngagement(uri),
    ]);
    const post: SharedPost = { did: r.did, handle, uri, engagement };
    if (rec?.text) post.text = rec.text;
    return post;
  });
  // Most-engaged first.
  const score = (p: SharedPost): number =>
    (p.engagement.likes ?? 0) + (p.engagement.reposts ?? 0) + (p.engagement.replies ?? 0);
  return posts.sort((a, b) => score(b) - score(a));
}

/** Convert the scaled-by-100 average to a human string like "4.12". */
export function formatAverage(scaled: number | null): string {
  if (scaled == null) return '—';
  return (scaled / 100).toFixed(2);
}
