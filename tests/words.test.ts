import { describe, it, expect } from 'vitest';
import { dailyAnswer, isAllowedGuess, getWordList } from '../src/engine/words.js';
import { isPlayableFiveLetter } from '../src/engine/normalize.js';
import { LANGS } from '../src/config.js';

describe('word lists integrity', () => {
  for (const lang of LANGS) {
    it(`[${lang}] every answer is a valid 5-letter A–Z word and an allowed guess`, () => {
      const list = getWordList(lang);
      expect(list.answers.length).toBeGreaterThan(500);
      for (const w of list.answers) {
        expect(/^[A-Z]{5}$/.test(w)).toBe(true);
        expect(isPlayableFiveLetter(w)).toBe(true);
        expect(isAllowedGuess(lang, w)).toBe(true);
      }
    });

    it(`[${lang}] every allowed word is 5 letters A–Z`, () => {
      for (const w of getWordList(lang).allowed) {
        expect(/^[A-Z]{5}$/.test(w)).toBe(true);
      }
    });
  }
});

describe('deterministic daily selection (cross-client agreement)', () => {
  it('is a pure function of (lang, puzzleNumber)', () => {
    for (const lang of LANGS) {
      for (const n of [1, 2, 100, 2500, 9999]) {
        expect(dailyAnswer(lang, n)).toBe(dailyAnswer(lang, n));
      }
    }
  });

  it('puzzle #1 is index 0 of the shipped sequence', () => {
    for (const lang of LANGS) {
      expect(dailyAnswer(lang, 1)).toBe(getWordList(lang).answers[0]);
    }
  });

  it('wraps with modulo after the sequence is exhausted', () => {
    for (const lang of LANGS) {
      const len = getWordList(lang).answers.length;
      expect(dailyAnswer(lang, len + 1)).toBe(dailyAnswer(lang, 1));
      expect(dailyAnswer(lang, len + 2)).toBe(dailyAnswer(lang, 2));
    }
  });

  it('EN and FR are independent series (same number → different word)', () => {
    // Overwhelmingly true; assert it holds for the first several puzzles.
    let differ = 0;
    for (let n = 1; n <= 20; n++) if (dailyAnswer('en', n) !== dailyAnswer('fr', n)) differ++;
    expect(differ).toBeGreaterThan(15);
  });
});

describe('guess validation', () => {
  it('accepts normalized + accented input', () => {
    expect(isAllowedGuess('en', 'crane')).toBe(true);
    expect(isAllowedGuess('en', 'CRANE')).toBe(true);
    expect(isAllowedGuess('fr', 'élève')).toBe(true); // -> ELEVE
  });

  it('rejects non-words', () => {
    expect(isAllowedGuess('en', 'zzzzz')).toBe(false);
    expect(isAllowedGuess('fr', 'xxxxx')).toBe(false);
  });
});
