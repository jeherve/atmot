import { describe, it, expect } from 'vitest';
import { dailyAnswer, isAllowedGuess, getWordList } from '../src/engine/words.js';
import { isPlayableFiveLetter } from '../src/engine/normalize.js';
import { LANGS, type Lang } from '../src/config.js';

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

  // History-safety guard: these puzzle->word pairs are already live. Obfuscating
  // the shipped answer list MUST decode back to byte-identical words, or players'
  // recorded results (keyed by <lang>-<puzzleNumber>) and in-progress games would
  // no longer match. If this test ever changes, history has been renumbered.
  //
  // Every number here sits inside the published range, so curating the unplayed
  // tail (see EXCLUDED in scripts/build-wordlists.ts) must leave them untouched.
  // Anchors past the end of the sequence are deliberately NOT asserted: curation
  // shortens the list, which moves the wrap-around point years from now.
  it('maps known puzzle numbers to their established words', () => {
    expect(dailyAnswer('en', 1)).toBe('DRAMA');
    expect(dailyAnswer('en', 2)).toBe('SMITH');
    expect(dailyAnswer('en', 3)).toBe('LACEY');
    expect(dailyAnswer('en', 30)).toBe('BERRY');
    expect(dailyAnswer('en', 60)).toBe('CYNIC');
    expect(dailyAnswer('fr', 1)).toBe('KOALA');
    expect(dailyAnswer('fr', 2)).toBe('FLEAU');
    expect(dailyAnswer('fr', 3)).toBe('LIGUE');
    expect(dailyAnswer('fr', 30)).toBe('SNACK');
    // FLOOD is an English word that the French sources wrongly admitted. It was
    // served on 2026-08-21, so it stays: curation fixes the future, not the past.
    expect(dailyAnswer('fr', 60)).toBe('FLOOD');
  });
});

/**
 * Regression guard for the FLOOD bug (2026-08-21): the French answer pool is
 * ranked by OpenSubtitles frequency and validated against a dictionary derived
 * from a Letterpress game list, so untranslated English tokens (FLOOD, GLASS,
 * TOMMY) and bare forenames sailed through as "French" words.
 *
 * scripts/build-wordlists.ts now filters a curated EXCLUDED list out of the
 * unplayed tail. This asserts the shipped data actually reflects that, so a
 * rebuild can never quietly reintroduce one.
 */
describe('curated answers (no excluded word past the published range)', () => {
  // Kept in sync with EXCLUDED in scripts/build-wordlists.ts. A sample is enough:
  // the point is to catch a rebuild that drops the curation step entirely.
  const EXCLUDED_SAMPLE: Record<Lang, string[]> = {
    en: [
      'CHINK', 'GYPSY', 'KRAUT', 'MAMMY', 'PANSY', 'QUEER', 'SQUAW', // slurs
      'DILDO', 'FANNY', 'PRICK', 'RAPED', 'WHORE', // crude
      'HENRY', 'JAPAN', 'JENNY', 'PARIS', 'TESLA', 'TOMMY', 'XEROX', // proper nouns
      'FEMME', 'HAUTE', 'MERDE', 'MONDE', 'TROIS', 'VOILA', // not English
    ],
    fr: [
      'GREAT', 'GROUP', 'HELLO', 'LIVES', 'PHONE', 'SMART', 'TOMMY', // not French
      'ELISE', 'JENNY', 'JESUS', 'MARIA', 'PARIS', // proper nouns
      'FATMA', 'NEGRE', 'RITAL', 'SQUAW', // slurs
      'ETRON', 'NIQUE', 'PISSE', 'TAPIN', 'VAGIN', // crude
    ],
  };

  // Puzzles at or below this were already served and are frozen as-is, warts and
  // all. Mirrors FROZEN_THROUGH in scripts/build-wordlists.ts.
  const FROZEN_THROUGH = 60;

  for (const lang of LANGS) {
    it(`[${lang}] no excluded word is queued after puzzle #${FROZEN_THROUGH}`, () => {
      const future = getWordList(lang).answers.slice(FROZEN_THROUGH);
      for (const word of EXCLUDED_SAMPLE[lang]) {
        expect(future, `${word} is still queued as a ${lang} answer`).not.toContain(word);
      }
    });

    it(`[${lang}] the published prefix is left alone`, () => {
      // GLASS (#55) and FLOOD (#60) are the bug itself, and they stay put.
      expect(getWordList(lang).answers.length).toBeGreaterThan(FROZEN_THROUGH);
    });
  }

  it('keeps FLOOD and GLASS in French history but nowhere else', () => {
    const answers = getWordList('fr').answers;
    expect(answers.indexOf('FLOOD')).toBe(59); // puzzle #60
    expect(answers.indexOf('GLASS')).toBe(54); // puzzle #55
    expect(answers.lastIndexOf('FLOOD')).toBe(59);
    expect(answers.lastIndexOf('GLASS')).toBe(54);
  });

  it('keeps naturalised loanwords playable as answers', () => {
    // The fix must not overshoot. Properly French, not English intrusions:
    for (const word of ['LASER', 'ALBUM', 'WAGON', 'SHORT', 'STOCK']) {
      expect(getWordList('fr').answers, `FR ${word}`).toContain(word);
    }
    // Properly English, despite foreign roots — these have an independent life
    // in English, unlike HAUTE or CULPA which only appear inside a borrowed phrase.
    for (const word of ['BERET', 'DEBUT', 'FOYER', 'NICHE', 'SUSHI', 'VODKA']) {
      expect(getWordList('en').answers, `EN ${word}`).toContain(word);
    }
  });

  it('keeps name-shaped English words that are ordinary vocabulary', () => {
    // ROBIN is a bird before it is a person; PEARL, IVORY and OLIVE likewise.
    for (const word of ['ROBIN', 'PEARL', 'IVORY', 'OLIVE', 'AMBER', 'DAISY']) {
      expect(getWordList('en').answers, `EN ${word}`).toContain(word);
    }
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
