import { describe, it, expect } from 'vitest';
import { normalizeWord, isPlayableFiveLetter } from '../src/engine/normalize.js';

describe('normalizeWord', () => {
  it('strips French diacritics to A–Z', () => {
    expect(normalizeWord('élève')).toBe('ELEVE');
    expect(normalizeWord('français')).toBe('FRANCAIS');
    expect(normalizeWord('hôtel')).toBe('HOTEL');
    expect(normalizeWord('naïf')).toBe('NAIF');
  });

  it('expands ligatures before length checks', () => {
    expect(normalizeWord('œuf')).toBe('OEUF');
    expect(normalizeWord('nœud')).toBe('NOEUD'); // 5 letters once expanded
    expect(normalizeWord('cœur')).toBe('COEUR');
  });

  it('drops apostrophes and hyphens', () => {
    expect(normalizeWord("aujourd'hui")).toBe('AUJOURDHUI');
    expect(normalizeWord('arc-en-ciel')).toBe('ARCENCIEL');
  });

  it('uppercases plain ASCII', () => {
    expect(normalizeWord('crane')).toBe('CRANE');
  });
});

describe('isPlayableFiveLetter', () => {
  it('accepts words that are 5 letters once normalized', () => {
    expect(isPlayableFiveLetter('NŒUD')).toBe(true); // -> NOEUD
    expect(isPlayableFiveLetter('élève')).toBe(true); // -> ELEVE
    expect(isPlayableFiveLetter('CRANE')).toBe(true);
  });

  it('rejects words that are not 5 letters normalized', () => {
    expect(isPlayableFiveLetter('cœur')).toBe(true); // COEUR = 5
    expect(isPlayableFiveLetter('œuf')).toBe(false); // OEUF = 4
    expect(isPlayableFiveLetter('bonjour')).toBe(false);
  });
});
