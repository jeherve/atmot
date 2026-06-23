import { describe, it, expect } from 'vitest';
import { buildShareText, emojiGrid, shareHeader } from '../src/engine/share.js';
import type { GameResult } from '../src/engine/types.js';

const win: GameResult = {
  lang: 'fr',
  puzzleNumber: 412,
  solved: true,
  guessCount: 4,
  rows: [
    ['absent', 'present', 'absent', 'absent', 'present'],
    ['absent', 'correct', 'absent', 'present', 'absent'],
    ['correct', 'correct', 'absent', 'present', 'present'],
    ['correct', 'correct', 'correct', 'correct', 'correct'],
  ],
};

describe('share text', () => {
  it('header is "AT Mot <n> (<LANG>) <score>"', () => {
    expect(shareHeader(win)).toBe('AT Mot 412 (FR) 4/6');
  });

  it('uses standard Unicode squares (not brand colours)', () => {
    expect(emojiGrid(win.rows).split('\n')[3]).toBe('🟩🟩🟩🟩🟩');
    expect(emojiGrid([['absent', 'present', 'correct', 'absent', 'absent']])).toBe('⬛🟨🟩⬛⬛');
  });

  it('includes the puzzle permalink (load-bearing for Constellation discovery)', () => {
    const text = buildShareText(win);
    expect(text).toContain('https://atmot.herve.bzh/p/fr/412');
    // header, blank, grid, blank, link
    const parts = text.split('\n\n');
    expect(parts[0]).toBe('AT Mot 412 (FR) 4/6');
    expect(parts[2]).toBe('https://atmot.herve.bzh/p/fr/412');
  });

  it('shows X/6 on a loss', () => {
    const loss: GameResult = { ...win, solved: false, guessCount: undefined, rows: win.rows.slice(0, 6) };
    expect(shareHeader(loss)).toContain('X/6');
  });

  it('never contains the word "Wordle"', () => {
    expect(buildShareText(win).toLowerCase()).not.toContain('wordle');
  });
});
