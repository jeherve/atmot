import { MAX_GUESSES, type Lang } from '../config.js';
import type { GameResult } from './types.js';

/** A bucket of the winning-guess-count histogram. */
export interface GuessBucket {
  guesses: number;
  count: number;
}

/** Per-language stats block (mirrors lexicon bzh.herve.atmot.stats#langStats). */
export interface LangStats {
  lang: string;
  currentStreak: number;
  maxStreak: number;
  gamesPlayed: number;
  gamesWon: number;
  lastPuzzleNumber: number;
  guessDistribution: GuessBucket[];
}

/** The full stats record (mirrors lexicon bzh.herve.atmot.stats main). */
export interface StatsRecord {
  $type?: 'bzh.herve.atmot.stats';
  byLang: LangStats[];
  updatedAt: string;
}

function emptyLangStats(lang: string): LangStats {
  return {
    lang,
    currentStreak: 0,
    maxStreak: 0,
    gamesPlayed: 0,
    gamesWon: 0,
    lastPuzzleNumber: 0,
    guessDistribution: [],
  };
}

function bumpDistribution(dist: GuessBucket[], guesses: number): GuessBucket[] {
  const out = dist.map((b) => ({ ...b }));
  const existing = out.find((b) => b.guesses === guesses);
  if (existing) existing.count += 1;
  else out.push({ guesses, count: 1 });
  out.sort((a, b) => a.guesses - b.guesses);
  return out;
}

/**
 * Pure stats transition: given the previous stats record (or null on first play)
 * and a freshly completed game, return the next stats record. Clock value
 * (`updatedAt`) is passed in so this stays deterministic and unit-testable.
 *
 * Streak rules: a win on the next consecutive puzzle extends the streak; a win
 * after a gap restarts it at 1; a loss resets it to 0. Replaying an older puzzle
 * updates totals/distribution but never disturbs the streak or lastPuzzleNumber.
 *
 * The caller is responsible for not invoking this twice for the same puzzle
 * (results are write-once, which provides that guard).
 */
export function computeNextStats(
  prev: StatsRecord | null,
  result: GameResult,
  updatedAt: string,
): StatsRecord {
  const byLang = (prev?.byLang ?? []).map((b) => ({ ...b, guessDistribution: [...b.guessDistribution] }));
  let bucket = byLang.find((b) => b.lang === result.lang);
  if (!bucket) {
    bucket = emptyLangStats(result.lang);
    byLang.push(bucket);
  }

  bucket.gamesPlayed += 1;
  if (result.solved) {
    bucket.gamesWon += 1;
    const guesses = result.guessCount ?? result.rows.length;
    if (guesses >= 1 && guesses <= MAX_GUESSES) {
      bucket.guessDistribution = bumpDistribution(bucket.guessDistribution, guesses);
    }
  }

  // Streak only advances for forward progress (newest puzzle).
  if (result.puzzleNumber > bucket.lastPuzzleNumber) {
    const consecutive =
      bucket.lastPuzzleNumber > 0 && result.puzzleNumber === bucket.lastPuzzleNumber + 1;
    if (result.solved) bucket.currentStreak = consecutive ? bucket.currentStreak + 1 : 1;
    else bucket.currentStreak = 0;
    bucket.lastPuzzleNumber = result.puzzleNumber;
  }

  bucket.maxStreak = Math.max(bucket.maxStreak, bucket.currentStreak);

  byLang.sort((a, b) => a.lang.localeCompare(b.lang));
  return { $type: 'bzh.herve.atmot.stats', byLang, updatedAt };
}

/** Convenience accessor. */
export function statsForLang(stats: StatsRecord | null, lang: Lang): LangStats | undefined {
  return stats?.byLang.find((b) => b.lang === lang);
}
