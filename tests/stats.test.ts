import { describe, it, expect } from 'vitest';
import { computeNextStats, statsForLang, type StatsRecord } from '../src/engine/stats.js';
import type { GameResult } from '../src/engine/types.js';

function game(lang: 'en' | 'fr', puzzleNumber: number, solved: boolean, guessCount?: number): GameResult {
  return { lang, puzzleNumber, solved, guessCount, rows: [] };
}

const T = '2026-06-23T00:00:00.000Z';

describe('computeNextStats', () => {
  it('creates a fresh lang bucket on first play', () => {
    const s = computeNextStats(null, game('en', 1, true, 3), T);
    const en = statsForLang(s, 'en')!;
    expect(en.gamesPlayed).toBe(1);
    expect(en.gamesWon).toBe(1);
    expect(en.currentStreak).toBe(1);
    expect(en.maxStreak).toBe(1);
    expect(en.lastPuzzleNumber).toBe(1);
    expect(en.guessDistribution).toEqual([{ guesses: 3, count: 1 }]);
  });

  it('extends streak on consecutive wins and tracks max', () => {
    let s: StatsRecord | null = null;
    s = computeNextStats(s, game('en', 1, true, 4), T);
    s = computeNextStats(s, game('en', 2, true, 3), T);
    s = computeNextStats(s, game('en', 3, true, 2), T);
    const en = statsForLang(s, 'en')!;
    expect(en.currentStreak).toBe(3);
    expect(en.maxStreak).toBe(3);
    expect(en.gamesWon).toBe(3);
  });

  it('resets streak to 0 on a loss, keeps max', () => {
    let s: StatsRecord | null = null;
    s = computeNextStats(s, game('en', 1, true, 4), T);
    s = computeNextStats(s, game('en', 2, true, 3), T);
    s = computeNextStats(s, game('en', 3, false), T);
    const en = statsForLang(s, 'en')!;
    expect(en.currentStreak).toBe(0);
    expect(en.maxStreak).toBe(2);
    expect(en.gamesPlayed).toBe(3);
    expect(en.gamesWon).toBe(2);
  });

  it('restarts streak at 1 after a gap', () => {
    let s: StatsRecord | null = null;
    s = computeNextStats(s, game('en', 1, true, 4), T);
    s = computeNextStats(s, game('en', 5, true, 3), T); // gap
    expect(statsForLang(s, 'en')!.currentStreak).toBe(1);
  });

  it('keeps EN and FR streaks independent', () => {
    let s: StatsRecord | null = null;
    s = computeNextStats(s, game('en', 1, true, 4), T);
    s = computeNextStats(s, game('fr', 1, true, 5), T);
    s = computeNextStats(s, game('en', 2, true, 3), T);
    expect(statsForLang(s, 'en')!.currentStreak).toBe(2);
    expect(statsForLang(s, 'fr')!.currentStreak).toBe(1);
  });

  it('does not disturb streak when replaying an older puzzle', () => {
    let s: StatsRecord | null = null;
    s = computeNextStats(s, game('en', 10, true, 4), T);
    s = computeNextStats(s, game('en', 3, true, 2), T); // older puzzle
    const en = statsForLang(s, 'en')!;
    expect(en.lastPuzzleNumber).toBe(10);
    expect(en.currentStreak).toBe(1);
    expect(en.gamesPlayed).toBe(2);
    expect(en.gamesWon).toBe(2);
  });
});
