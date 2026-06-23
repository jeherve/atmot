/**
 * plurals.ts — detect inflected -S forms (plurals, 3rd-person-singular verbs) so
 * they can be kept out of the daily-answer pool. They remain valid as *guesses*.
 *
 * The singular of a 5-letter -S form is shorter than five letters (ROOMS -> ROOM,
 * BOXES -> BOX), so `isWord` MUST recognise words of every length. The historical
 * bug here passed a 5-letter-only set, so no 4-letter singular ever matched and
 * the filter silently did nothing.
 */

// Stems that take "-es" rather than a bare "-s": those ending in a sibilant
// (S, X, Z) or the digraphs CH / SH (BOXES -> BOX, ASHES -> ASH, MATCHES -> MATCH).
const SIBILANT_STEM = /([SXZ]|[CS]H)$/;

/**
 * True when `word` looks like a regular -S inflection of a shorter real word.
 *
 * @param word   Uppercase A–Z candidate.
 * @param isWord Predicate that recognises real words of ANY length.
 */
export function isInflectedSForm(word: string, isWord: (w: string) => boolean): boolean {
  if (!word.endsWith('S')) return false;
  // Regular plural / 3rd-person singular: drop the trailing S (ROOMS -> ROOM).
  if (isWord(word.slice(0, -1))) return true;
  // -ES inflection after a sibilant stem (BOXES -> BOX, BUSES -> BUS, ASHES -> ASH).
  if (word.endsWith('ES')) {
    const stem = word.slice(0, -2);
    if (SIBILANT_STEM.test(stem) && isWord(stem)) return true;
    // Y -> IES inflection (DRIES -> DRY, FLIES -> FLY, SKIES -> SKY).
    if (word.endsWith('IES') && isWord(word.slice(0, -3) + 'Y')) return true;
  }
  return false;
}
