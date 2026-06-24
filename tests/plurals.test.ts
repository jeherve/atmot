import { describe, it, expect } from 'vitest';
import { isInflectedSForm } from '../scripts/plurals.js';
import { decodeAnswers } from '../src/engine/obfuscate.js';
import enData from '../src/data/words.en.json';

// A tiny dictionary covering every length, the way ENABLE does. The bug was that
// the real check only ever saw 5-letter words, so 4-letter singulars never matched.
const DICT = new Set(['ROOM', 'CARD', 'WALK', 'MOVE', 'BOX', 'BUS', 'GAS', 'DRY', 'FLY', 'ASH']);
const isWord = (w: string) => DICT.has(w);

describe('isInflectedSForm', () => {
  it('flags a regular plural whose singular is a shorter dictionary word', () => {
    expect(isInflectedSForm('ROOMS', isWord)).toBe(true); // ROOM
    expect(isInflectedSForm('CARDS', isWord)).toBe(true); // CARD
  });

  it('flags a 3rd-person-singular verb (WALKS -> WALK)', () => {
    expect(isInflectedSForm('WALKS', isWord)).toBe(true);
  });

  it('flags an -ES plural after a sibilant stem (BOXES -> BOX, BUSES -> BUS)', () => {
    expect(isInflectedSForm('BOXES', isWord)).toBe(true);
    expect(isInflectedSForm('BUSES', isWord)).toBe(true);
  });

  it('flags a Y->IES inflection (DRIES -> DRY, FLIES -> FLY)', () => {
    expect(isInflectedSForm('DRIES', isWord)).toBe(true);
    expect(isInflectedSForm('FLIES', isWord)).toBe(true);
  });

  it('flags an -ES plural after an SH/CH stem (ASHES -> ASH)', () => {
    expect(isInflectedSForm('ASHES', isWord)).toBe(true);
  });

  it('keeps a non-plural word ending in S (singular not a word)', () => {
    expect(isInflectedSForm('ATLAS', isWord)).toBe(false); // ATLA not a word
    expect(isInflectedSForm('CHAOS', isWord)).toBe(false); // CHAO not a word
  });

  it('keeps words that do not end in S', () => {
    expect(isInflectedSForm('MOVED', isWord)).toBe(false);
  });
});

describe('shipped EN answer pool excludes obvious plurals (regression)', () => {
  const answerList = decodeAnswers(enData.answersEnc);
  const answers = new Set(answerList);

  for (const plural of ['ROOMS', 'CARDS', 'MOVES', 'KINGS', 'BOXES', 'FLIES', 'ASHES']) {
    it(`does not use "${plural}" as a daily answer`, () => {
      expect(answers.has(plural)).toBe(false);
    });
  }

  it('keeps -S plurals to under 5% of the answer pool', () => {
    const endingInS = answerList.filter((w) => w.endsWith('S')).length;
    expect(endingInS / answerList.length).toBeLessThan(0.05);
  });
});
