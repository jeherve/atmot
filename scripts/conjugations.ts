/**
 * conjugations.ts — detect French verb forms that make poor daily answers, so
 * they can be kept out of the answer pool. They remain valid as *guesses*.
 *
 * The French answer pool is ranked by subtitle frequency, and subtitles are
 * mostly dialogue, so conjugated verbs rank very high: ARMEZ, MISEZ, TUIEZ,
 * FONDA, BOIVE. As a daily answer these are unfair in a way the infinitive
 * isn't — a player thinking of "mordre" does not naturally produce MORDE.
 *
 * English already does this for its own morphology (`isInflectedSForm` in
 * plurals.ts); this is the French counterpart.
 *
 * KEPT (natural, dictionary-shaped): the infinitive (AIMER), the past participle
 * (AIMEE, FENDU), and the 3rd-person singular present (AIME, REVIENT) — the form
 * a speaker reaches for first and the one dictionaries cite.
 *
 * DROPPED: every other person and tense — `vous` and `nous` forms, the
 * imperfect, the passé simple, the future, and the subjunctive.
 *
 * Two mechanisms, because French morphology is not uniform:
 *
 *  1. Regular patterns are derived, the way the English filter derives a
 *     singular: strip a known ending and check the reconstructed infinitive
 *     against the dictionary. This is what generalises — it needs no list.
 *  2. Suppletive forms of the common irregular verbs (être, avoir, aller, faire,
 *     dire, voir, savoir, devoir, boire, mourir…) share no stem with their
 *     infinitive, so no suffix rule can reach them. Those are enumerated.
 *
 * `IRREGULAR` and `NOT_A_VERB_FORM` are both verified against the shipped pool
 * by tests/conjugations.test.ts.
 */

/**
 * Suppletive / stem-changing forms no suffix rule can derive from the infinitive.
 * FERAI has no "faire" in it; VERRA has no "voir"; IRONT has no "aller".
 */
const IRREGULAR = new Set([
  // être / avoir
  'ETAIS', 'ETAIT', 'ETIEZ', 'SEREZ', 'SOYEZ', 'AIENT', 'AVAIT', 'AVIEZ', 'AUREZ',
  // aller
  'IRAIS', 'IRAIT', 'IRIEZ', 'IRONT',
  // faire / dire / lire / écrire / redire / relire / revoir / revivre
  'FASSE', 'FERAI', 'FEREZ', 'DIRAI', 'DIRAS', 'DIREZ', 'DISES', 'LIRAI', 'LIRAS',
  'LIREZ', 'LISES', 'LISEZ', 'ECRIS', 'REDIS', 'RELIS', 'REVIS',
  // voir / savoir / devoir / pouvoir / vouloir
  'VERRA', 'SACHE', 'SAVEZ', 'DOIVE', 'DEVEZ', 'DEVRA',
  // boire / croire / mourir / vivre / suivre / mettre / prendre / plaire
  'BOIRA', 'BOIVE', 'BUVEZ', 'CROIE', 'CROIS', 'MEURE', 'MEURS', 'VIVEZ', 'VIVRA',
  'SUIVE', 'METTE', 'PLAIS', 'TAISE', 'FUYEZ',
  // -re subjunctives whose stem differs from the indicative
  'COURE', 'DORME', 'MENTE', 'MORDE', 'PARTE', 'PENDE', 'PERDE', 'RENDE', 'SENTE',
  'SORTE', 'VENDE', 'JOINS', 'PEINS',
  // venir / tenir / valoir / recevoir / rire
  'VENEZ', 'TENEZ', 'VALEZ', 'RECUT', 'VECUT', 'RIAIS', 'RIAIT', 'DINES',
  // -re verbs, 1st/2nd person singular present. A closed set: deriving these by
  // rule (strip -S, look for stem+RE) matches far too much — CENTS would find
  // CENTRE, CHATS would find CHATRE, BOUTS would find BOUTRE.
  'MORDS', 'RENDS', 'VENDS', 'PERDS', 'TORDS', 'TENDS', 'ROMPS',
]);

/**
 * Words the derivation rules would flag, but which are ordinary nouns or
 * adjectives in their own right. OPERA is the clearest: stripping the passé
 * simple -A leaves OPER, and "opérer" is a real verb, so the rule fires — but
 * "opéra" the noun is a perfectly good answer.
 */
const NOT_A_VERB_FORM = new Set([
  'OPERA', // un opéra (vs. il opéra)
  'PRIMA', // prima donna (vs. il prima)
  'VISAS', // des visas (vs. tu visas)
  'TAPAS', // des tapas (vs. tu tapas)
  'NIAIS', // niais, foolish (vs. je niais)
  'AGORA', // une agora
  'PANDA', // un panda
  'CAMES', // des cames
  'CIMES', // des cimes
  'MITES', // des mites
  'PAIES', // une paie / des paies
  'RALES', // des râles
  'BISES', // des bises
  'DURES', // dur(e)s
  'VIVES', // vif/vives
  'HELAS', // hélas
  'REBUT', // un rebut
  'PARIA', // un paria (vs. il paria)
  'VOILA', // voilà
  'LIONS', // des lions (vs. nous lions, from lier)
  'BARDA', // un barda (vs. il barda)
  'SAUNA', // un sauna (vs. il sauna, from sauner)
  'APTES', // aptes (APTE + S finds "aptère")
  'CHERS', // chers
  'SORTE', // une sorte, a kind (vs. que je sorte)
]);

/** Endings that mark a person/tense we drop, paired with the -ER infinitive. */
const ER_ENDINGS = ['EZ', 'ONS', 'ENT', 'AIS', 'AIT', 'IEZ', 'IONS', 'AIENT', 'A'];

/**
 * True when `word` is a French verb form other than the infinitive, the past
 * participle, or the 3rd-person singular present.
 *
 * @param word   Uppercase A–Z candidate, 5 letters.
 * @param isWord Predicate recognising real French words of ANY length — the
 *               reconstructed infinitive is usually longer than the form itself
 *               (ARMEZ -> ARMER, MORDS -> MORDRE), so a 5-letter-only set would
 *               make this silently return false, the way the English filter once did.
 */
export function isConjugatedForm(word: string, isWord: (w: string) => boolean): boolean {
  if (NOT_A_VERB_FORM.has(word)) return false;
  if (IRREGULAR.has(word)) return true;

  // Regular -ER verbs: strip the person/tense ending, restore the infinitive.
  // ARMEZ -> ARM + ER, TUONS -> TU + ER, FONDA -> FOND + ER, TUAIT -> TU + ER.
  for (const ending of ER_ENDINGS) {
    if (!word.endsWith(ending)) continue;
    const stem = word.slice(0, -ending.length);
    // A one-letter stem is noise, not a verb (e.g. "OSA" -> "O").
    if (stem.length >= 2 && isWord(stem + 'ER')) return true;
  }

  // Future, built on the whole infinitive rather than a stem:
  // OSERA -> OSER, TUERA -> TUER, AGIRA -> AGIR.
  if (word.endsWith('A')) {
    const stem = word.slice(0, -1);
    if (/(ER|IR|RE)$/.test(stem) && isWord(stem)) return true;
  }

  return false;
}
