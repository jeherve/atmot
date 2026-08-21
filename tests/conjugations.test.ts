import { describe, it, expect } from 'vitest';
import { isConjugatedForm } from '../scripts/conjugations.js';
import { decodeAnswers } from '../src/engine/obfuscate.js';
import frData from '../src/data/words.fr.json';

// A dictionary covering every length, the way the real French list does. The
// infinitive is longer than the form it explains (ARMEZ -> ARMER), so a
// 5-letter-only set would make the filter silently return false — the trap the
// English -S filter fell into once already.
const DICT = new Set([
  'ARMER', 'TUER', 'FONDER', 'LIER', 'OSER', 'AGIR', 'CRIER', 'DINER', 'MORDRE',
  'CENTRE', 'CHATRE', 'APTERE', 'SAUNER', 'OPERER', 'ARME', 'CENT', 'CHAT', 'SORTE',
]);
const isWord = (w: string) => DICT.has(w);

describe('isConjugatedForm', () => {
  it('flags a "vous" form (ARMEZ -> ARMER)', () => {
    expect(isConjugatedForm('ARMEZ', isWord)).toBe(true);
  });

  it('flags a "nous" form (TUONS -> TUER)', () => {
    expect(isConjugatedForm('TUONS', isWord)).toBe(true);
  });

  it('flags the imperfect (TUAIT, TUAIS -> TUER)', () => {
    expect(isConjugatedForm('TUAIT', isWord)).toBe(true);
    expect(isConjugatedForm('TUAIS', isWord)).toBe(true);
  });

  it('flags the passé simple (FONDA -> FONDER)', () => {
    expect(isConjugatedForm('FONDA', isWord)).toBe(true);
  });

  it('flags the 3rd-person plural (TUENT -> TUER, LIENT -> LIER)', () => {
    expect(isConjugatedForm('TUENT', isWord)).toBe(true);
    expect(isConjugatedForm('LIENT', isWord)).toBe(true);
  });

  it('flags the future, which is built on the whole infinitive', () => {
    expect(isConjugatedForm('OSERA', isWord)).toBe(true); // OSER + A
    expect(isConjugatedForm('AGIRA', isWord)).toBe(true); // AGIR + A
  });

  it('flags suppletive forms no suffix rule could reach', () => {
    // FERAI holds no "faire", VERRA no "voir", IRONT no "aller".
    for (const w of ['FERAI', 'VERRA', 'IRONT', 'SOYEZ', 'FASSE', 'BOIVE', 'MORDS']) {
      expect(isConjugatedForm(w, isWord), w).toBe(true);
    }
  });

  it('keeps the forms a dictionary would cite', () => {
    // Infinitive, past participle, 3rd-person singular present.
    for (const w of ['ARMER', 'FENDU', 'AIMEE', 'MORDU']) {
      expect(isConjugatedForm(w, isWord), w).toBe(false);
    }
  });

  it('keeps nouns and adjectives the derivation rules would misfire on', () => {
    // CENTS would find CENTRE, CHATS would find CHATRE, APTES would find APTERE,
    // SAUNA would find SAUNER, OPERA would find OPERER, SORTE looks subjunctive.
    for (const w of ['CENTS', 'CHATS', 'APTES', 'SAUNA', 'OPERA', 'SORTE', 'LIONS']) {
      expect(isConjugatedForm(w, isWord), w).toBe(false);
    }
  });

  it('ignores a stem too short to be a verb', () => {
    // Defensive: the build only ever passes 5-letter words, but a 1-letter stem
    // must never reconstruct an infinitive. ("OSA" is correctly flagged — its
    // stem is OS, and OSER is a verb.)
    expect(isConjugatedForm('LA', isWord)).toBe(false);
    expect(isConjugatedForm('OSA', isWord)).toBe(true);
  });
});

describe('shipped FR answer pool excludes awkward conjugations (regression)', () => {
  const answers = decodeAnswers(frData.answersEnc);
  const future = new Set(answers.slice(60)); // puzzles 1-60 are frozen history

  for (const form of ['ARMEZ', 'MISEZ', 'TUIEZ', 'PIGEZ', 'FONDA', 'BOIVE', 'MORDE', 'PUAIT']) {
    it(`does not queue "${form}" as a future answer`, () => {
      expect(future.has(form)).toBe(false);
    });
  }

  it('keeps infinitives and participles, which are fair answers', () => {
    // The filter must not swallow the whole verb — only the awkward persons.
    for (const w of ['AIMER', 'BATIR', 'FENDU', 'COUSU']) {
      expect(answers, w).toContain(w);
    }
  });

  it('keeps -EZ forms under 1% of the pool', () => {
    const ez = answers.filter((w) => w.endsWith('EZ')).length;
    expect(ez / answers.length).toBeLessThan(0.01);
  });
});
