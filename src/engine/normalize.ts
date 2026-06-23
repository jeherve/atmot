/**
 * Word normalization.
 *
 * All gameplay is uppercase, unaccented A–Z. The source French list keeps accents
 * for legibility/provenance, but the keyboard, typed guess, comparison, and stored
 * grid all operate on the normalized form (matching the accent-free, all-caps
 * convention of the official French Scrabble dictionary / ODS).
 *
 * Pipeline: expand ligatures (Œ→OE, Æ→AE) → strip diacritics → uppercase → keep A–Z.
 */

const LIGATURES: Array<[RegExp, string]> = [
  [/œ/gi, 'oe'],
  [/æ/gi, 'ae'],
];

// Unicode combining diacritical marks block (U+0300–U+036F).
const COMBINING_MARKS = /[\u0300-\u036f]/g;

/**
 * Normalize an arbitrary word to its playable A–Z uppercase form.
 * Returns the normalized string (may be any length; callers validate length).
 */
export function normalizeWord(raw: string): string {
  let s = raw.trim();
  // Expand French ligatures BEFORE diacritic stripping / length checks.
  for (const [re, rep] of LIGATURES) s = s.replace(re, rep);
  // Decompose accents then drop the combining marks (É→E, Ç→C, etc.).
  s = s.normalize('NFD').replace(COMBINING_MARKS, '');
  s = s.toUpperCase();
  // Keep only ASCII A–Z (drops apostrophes, hyphens, digits, spaces).
  s = s.replace(/[^A-Z]/g, '');
  return s;
}

/** True if, once normalized, the word is exactly 5 letters of A–Z. */
export function isPlayableFiveLetter(raw: string, length = 5): boolean {
  const n = normalizeWord(raw);
  return n.length === length && /^[A-Z]+$/.test(n);
}
