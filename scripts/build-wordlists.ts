/**
 * build-wordlists.ts — generate the per-language word lists shipped with AT Mot.
 *
 * Sources (both license-clean and independently sourced):
 *   - English dictionary: ENABLE word list — public domain.
 *   - French dictionary + both commonness rankings: hermitdave/FrequencyWords
 *     (OpenSubtitles frequency lists) — MIT licensed.
 *
 * Output: src/data/words.<lang>.json, committed to the repo. The ANSWER order is
 * a fixed seeded shuffle baked into the file, so every client worldwide indexes
 * the identical sequence (UTC daily agreement is guaranteed by shared data, not
 * by runtime computation). Re-run with `npm run build:words`.
 *
 * The answer sequence is then curated to strip words the sources wrongly admit:
 * a reviewed EXCLUDED list per language, plus a morphological filter that keeps
 * awkward French verb conjugations out (see conjugations.ts).
 * Curation only ever touches puzzles past FROZEN_THROUGH, so published days keep
 * the word players were served.
 *
 * The output is reproducible: same sources + same seeds + same curation =>
 * byte-identical files.
 */
import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { normalizeWord } from '../src/engine/normalize.ts';
import { encodeAnswers, decodeAnswers } from '../src/engine/obfuscate.ts';
import { isInflectedSForm } from './plurals.ts';
import { isConjugatedForm } from './conjugations.ts';
import { puzzleNumberFor, type Lang } from '../src/config.ts';
import frenchDictionary from 'an-array-of-french-words' with { type: 'json' };

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = resolve(HERE, '../src/data');

const WORD_LENGTH = 5;

const SOURCES = {
  enable: 'https://raw.githubusercontent.com/dolph/dictionary/master/enable1.txt',
  enFreq:
    'https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2018/en/en_50k.txt',
  frFreq:
    'https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2018/fr/fr_50k.txt',
};

// Fixed per-language seeds: changing these reshuffles all history, so never do.
const SEED = { en: 0x6d6f7401, fr: 0x6d6f7402 };

/**
 * The last puzzle number already published in each language. Everything at or
 * below this index is HISTORY: players have seen it, and their result records
 * are keyed by puzzle number, so the words must never move.
 *
 * Curation (EXCLUDED below, plus the French conjugation filter) is therefore
 * applied only to the tail beyond this point. Bump these to the current puzzle
 * number BEFORE re-running the build — `assertFreezeIsCurrent` refuses to run
 * otherwise, and `verifyFrozenPrefix` re-checks the result against the
 * committed file.
 */
const FROZEN_THROUGH: Record<Lang, number> = { en: 60, fr: 60 };

/**
 * Words removed from the *answer* pool by hand.
 *
 * Both languages draw their commonness ranking from OpenSubtitles frequency
 * lists, and French subtitles are full of English dialogue and character names.
 * The French validity gate (an-array-of-french-words) is derived from a
 * Letterpress game list, so it happily admits `flood`, `glass` and `tommy` as
 * "French" — which is how FLOOD shipped as the answer for 2026-08-21.
 *
 * No automated source separates a naturalised loanword (LASER, ALBUM, WAGON,
 * SHORT — all properly French) from an untranslated intrusion (FLOOD, GREAT,
 * GROUP), so this list is a reviewed editorial decision, not a heuristic.
 *
 * These stay valid GUESSES — only the daily-answer sequence is filtered.
 */
const EXCLUDED: Record<Lang, ReadonlySet<string>> = {
  en: new Set([
    // Slurs: ethnic, homophobic, ableist, and slavery-era.
    'BWANA', 'CHINK', 'CHOLO', 'CISSY', 'GYPSY', 'HONKY', 'KRAUT', 'LIMEY',
    'MAMMY', 'MASSA', 'MONGO', 'NANCE', 'NANCY', 'PANSY', 'PYGMY', 'QUEER',
    'SISSY', 'SQUAW',
    // Crude / sexual.
    'BITCH', 'BONER', 'DILDO', 'FANNY', 'HORNY', 'HUSSY', 'KINKY', 'NUDIE',
    'PENIS', 'PORNO', 'PRICK', 'PUBES', 'PUSSY', 'RAPED', 'SEMEN', 'SPERM',
    'PONCE', 'SPUNK', 'TITTY', 'WHORE', 'WILLY',
    // Demeaning epithets.
    'BIMBO', 'DUNCE', 'FATSO', 'IDIOT', 'LOONY', 'MORON', 'SICKO', 'WACKO',
    'WENCH',
    // Proper nouns. ENABLE lists these lowercase because each has some obscure
    // common-noun sense (a `jenny` is a female donkey, a `henry` an SI unit of
    // inductance, to `japan` is to lacquer) — but a player reads the name first.
    'AGGIE', 'ALAMO', 'ALINE', 'ARIEL', 'BENNY', 'BILBO', 'BILLY', 'BRENT', 'BRITT', 'BUFFY',
    'BURKE', 'CHANG', 'CHEVY', 'CHICO', 'CHILE', 'CHINA', 'CISCO', 'CLARY', 'COSTA', 'CUPID',
    'DEGAS', 'DERRY', 'DEVON', 'DONNA', 'EMMET', 'ERICA', 'FAGIN', 'FAYED', 'GARTH', 'GEMMA',
    'GENOA', 'GILLY', 'GINNY', 'HENRY', 'HOGAN', 'HOMER', 'HONDA', 'HOYLE', 'HURST', 'JACKY',
    'JAPAN', 'JENNY', 'JERRY', 'JESSE', 'JIMMY', 'JONES', 'JUDAS', 'KELLY', 'KERRY', 'LAURA',
    'LEONE', 'LEVIN', 'LEWIS', 'LIANG', 'LIBRA', 'LINDY', 'LOGAN', 'LOTTE', 'LOUIE', 'LOUIS',
    'LUGER', 'MACON', 'MAMIE', 'MARGE', 'MARIA', 'MAVIS', 'MECCA', 'MERLE', 'MIRZA', 'MOIRA',
    'MOLLY', 'MONTE', 'NAWAB', 'NELLY', 'PARIS', 'PEDRO', 'PILAR', 'RALPH', 'RANCE', 'RILEY',
    'ROMEO', 'ROUEN', 'SANTO', 'SAYID', 'SEINE', 'SHAWN', 'SHIVA', 'SODOM', 'SPEER', 'TAMMY',
    'TERRY', 'TESLA', 'TEXAS', 'TOMMY', 'TONGA', 'VICHY', 'WALLY', 'WEBER', 'XEROX', 'YAHOO',
    'ARGUS', 'COLIN', 'CONGO', 'CURIE', 'HARRY', 'HERTZ', 'MORSE', 'ROGER', 'SERGE', 'TORAH',
    // Foreign words that only live inside a borrowed phrase in English (haute
    // couture, mea culpa, a la carte). Naturalised loans with an independent
    // English life — BERET, DEBUT, FOYER, NICHE, SUSHI, VODKA — are kept.
    'BONNE', 'BRAVA', 'CARTE', 'COMTE', 'CONTE', 'CREME', 'CULPA', 'DOLCE', 'FEMME', 'HAUTE',
    'MADRE', 'MATER', 'MERDE', 'MILLE', 'MODUS', 'MONDE', 'PATER', 'PETIT', 'SENOR', 'TERRA',
    'TROIS', 'TUTTI', 'VOILA', 'AMOUR', 'CAMPO', 'LIBER', 'MONDO', 'PADRE',
    // Read as typos rather than words: variant or archaic spellings of a word the
    // player already knows (PAYED/paid, WOOLY/woolly, SYNCH/sync, HULLO/hello).
    'ALIST', 'AMIGA', 'HULLO', 'PAYED', 'SYNCH', 'WOOLY',
    // Dialect and trade words almost no player will have met.
    'BALLY', 'BARMY', 'BOING', 'CUDDY', 'CULLY', 'CUTTY', 'DOBBY', 'GAULT', 'GRIFF',
    'HOLLA', 'HOTCH', 'MOUCH', 'NOBBY', 'SAVIN', 'SKINT', 'WILCO',
    // Archaic forms.
    'AFORE', 'AUGHT', 'BEGAT', 'CANST', 'DIDST', 'DURST', 'SHALT', 'THINE', 'YOUSE',
  ]),
  fr: new Set([
    // Not French: untranslated English/foreign tokens from the subtitle corpus.
    'BLACK', 'BOOTS', 'BROOK', 'CARRY', 'CHINA', 'CLAMP', 'DOLCE', 'DRILL',
    'DRINK', 'FLINT', 'FLOOD', 'GLASS', 'GREAT', 'GREEN', 'GROUP', 'HELLO',
    'JACKS', 'JUMBO', 'LAIRD', 'LIVES', 'MAMMY', 'MARKS', 'MILES', 'PADDY',
    'PHONE', 'ROCKS', 'SHOWS', 'SMART', 'TERRA', 'YARDS', 'ZEBRA',
    // Same failure mode, caught by comparing English and French corpus ranks:
    // each has a real but obscure French sense, and reads as English on the board.
    // ABOUT is the 51st most common English word; `un about` is a carpentry term.
    'ABOUT', 'LOVER', 'NURSE', 'RIVER', 'SKIES', 'SOULS', 'TRUST',
    // Brand name.
    'VESPA',
    // Proper nouns: forenames and places that the dictionary lists lowercase.
    'ALPES', 'ALVIN', 'BLAIR', 'CESAR', 'CLIVE', 'DELIA', 'DENIS', 'DIANE',
    'DONNA', 'DORIS', 'ELISE', 'GEMMA', 'HENRY', 'IRISA', 'JENNY', 'JESUS',
    'LAURE', 'MACHA', 'MARIA', 'MOISE', 'MURAT', 'PEKIN', 'RAINA', 'RENEE',
    'ROSIE', 'TERRI', 'TOMAS', 'TOMMY',
    // Real common nouns, but a French player reads them as proper nouns first
    // (PARIS the city before "des paris", SERGE the forename before the fabric).
    'BOSCO', 'DAMAS', 'GALLO', 'JULES', 'LOUIS', 'MARIE', 'MAURE', 'MILAN',
    'OSCAR', 'PARIS', 'PARME', 'PERSE', 'ROBIN', 'SEINE', 'SERGE', 'TEXAN',
    'TORAH', 'VICHY', 'VIOLA', 'WEBER',
    // Slurs.
    'BOCHE', 'CATIN', 'FATMA', 'FRITZ', 'GARCE', 'NABOT', 'NEGRE', 'PUTES',
    'RITAL', 'SQUAW',
    // Crude / sexual.
    'BAISE', 'BITES', 'CHIER', 'CHIES', 'ETRON', 'FOUTE', 'HOMOS', 'MERDE',
    'NIQUE', 'PENIS', 'PISSE', 'PORNO', 'SUCON', 'TAPIN', 'VAGIN',
    // Ethnically or bodily loaded, even where the term itself is neutral.
    'ARYEN', 'GITAN', 'METIS', 'NAZIE', 'NAZIS', 'OBESE',
  ]),
};

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, { headers: { 'user-agent': 'atmot-build/1.0' } });
  if (!res.ok) throw new Error(`fetch ${url} -> ${res.status}`);
  return res.text();
}

/** Deterministic PRNG (mulberry32). */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fisher–Yates with a seeded PRNG; pure, deterministic. */
function seededShuffle<T>(items: readonly T[], seed: number): T[] {
  const rand = mulberry32(seed);
  const a = items.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

/** Parse a hermitdave frequency file ("word count" per line) into ranked tokens. */
function parseFreq(text: string): string[] {
  const out: string[] = [];
  for (const line of text.split('\n')) {
    const word = line.split(' ')[0]?.trim();
    if (word) out.push(word);
  }
  return out;
}

interface WordList {
  lang: string;
  source: string;
  license: string;
  wordLength: number;
  counts: { answers: number; allowed: number };
  /** Ordered daily-answer sequence (seeded shuffle). */
  answers: string[];
  /** Sorted set of valid guesses (superset of answers). */
  allowed: string[];
  /** Optional: normalized -> accented original (provenance / reference only). */
  accents?: Record<string, string>;
}

/**
 * The answer sequence currently committed for a language, or null on a first
 * build. Decoded from the shipped file, which is the only record of what
 * players have actually been served.
 */
function committedAnswers(lang: Lang): string[] | null {
  const file = resolve(DATA_DIR, `words.${lang}.json`);
  if (!existsSync(file)) return null;
  const raw = JSON.parse(readFileSync(file, 'utf8')) as { answersEnc?: string };
  return raw.answersEnc ? decodeAnswers(raw.answersEnc) : null;
}

/**
 * Refuse to build if `FROZEN_THROUGH` has fallen behind the calendar. Puzzles
 * between the frozen point and today are already live but outside the guard, so
 * curating the tail would silently re-sequence words players have seen.
 */
function assertFreezeIsCurrent(lang: Lang): void {
  const published = puzzleNumberFor();
  if (published > FROZEN_THROUGH[lang]) {
    throw new Error(
      `FROZEN_THROUGH.${lang} is ${FROZEN_THROUGH[lang]} but puzzle #${published} has ` +
        `already been published. Bump FROZEN_THROUGH.${lang} to ${published} before rebuilding.`,
    );
  }
}

/**
 * Drop the curated exclusions from the not-yet-published tail of the sequence.
 *
 * The head (already-played puzzles) is passed through untouched, warts and all —
 * FLOOD stays the answer for 2026-08-21 because that is what players were served.
 * Filtering shortens the sequence, which moves the wrap-around point; that is
 * years out and affects no recorded result.
 */
function curateTail(
  lang: Lang,
  sequence: readonly string[],
  alsoDrop: (word: string) => boolean = () => false,
): string[] {
  const frozen = FROZEN_THROUGH[lang];
  const excluded = EXCLUDED[lang];
  const head = sequence.slice(0, frozen);
  const tail = sequence.slice(frozen).filter((w) => !excluded.has(w) && !alsoDrop(w));
  console.log(`words.${lang}.json: curated ${sequence.length - frozen - tail.length} from the tail`);
  return [...head, ...tail];
}

/** Belt-and-braces: the frozen head must match the committed file word for word. */
function verifyFrozenPrefix(lang: Lang, answers: readonly string[]): void {
  const previous = committedAnswers(lang);
  if (!previous) return;
  const frozen = FROZEN_THROUGH[lang];
  if (previous.length < frozen) {
    throw new Error(`committed words.${lang}.json has fewer than ${frozen} answers`);
  }
  for (let i = 0; i < frozen; i++) {
    if (previous[i] !== answers[i]) {
      throw new Error(
        `history changed: puzzle #${i + 1} (${lang}) was ${previous[i]}, would become ${answers[i]}`,
      );
    }
  }
}

function write(list: WordList): void {
  mkdirSync(DATA_DIR, { recursive: true });
  const file = resolve(DATA_DIR, `words.${list.lang}.json`);
  // The ordered answer sequence ships obfuscated (a deliberate speed bump, not
  // encryption — see src/engine/obfuscate.ts) so the daily word isn't readable
  // in plaintext in the bundle or the repo. `answersEnc` decodes back to the
  // identical ordered list, so the per-day mapping is unchanged.
  const out = {
    lang: list.lang,
    source: list.source,
    license: list.license,
    wordLength: list.wordLength,
    counts: list.counts,
    answersEnc: encodeAnswers(list.answers),
    allowed: list.allowed,
    ...(list.accents ? { accents: list.accents } : {}),
  };
  writeFileSync(file, JSON.stringify(out, null, 0) + '\n');
  console.log(
    `words.${list.lang}.json: ${list.counts.answers} answers, ${list.counts.allowed} allowed`,
  );
}

async function buildEnglish(): Promise<void> {
  assertFreezeIsCurrent('en');
  const [enableRaw, freqRaw] = await Promise.all([
    fetchText(SOURCES.enable),
    fetchText(SOURCES.enFreq),
  ]);

  // Full ENABLE dictionary (every length): the singular of a 5-letter plural is
  // shorter than five letters, so plural detection needs words of all lengths.
  const dictAll = new Set<string>();
  const allowedSet = new Set<string>(); // 5-letter subset => the allowed-guess set.
  for (const w of enableRaw.split('\n')) {
    const n = normalizeWord(w);
    if (n.length === 0) continue;
    dictAll.add(n);
    if (n.length === WORD_LENGTH) allowedSet.add(n);
  }
  const isWord = (w: string): boolean => dictAll.has(w);

  // Commonness ranking from the frequency list (only words present in ENABLE).
  const freqRanked = parseFreq(freqRaw)
    .map(normalizeWord)
    .filter((w) => w.length === WORD_LENGTH && allowedSet.has(w));

  // Heuristic: keep obvious -S inflections (plurals, 3rd-person verbs) out of the
  // answer pool so it stays mostly base words. They remain valid as guesses.
  const seen = new Set<string>();
  const answerPool: string[] = [];
  for (const w of freqRanked) {
    if (seen.has(w)) continue;
    seen.add(w);
    if (isInflectedSForm(w, isWord)) continue;
    answerPool.push(w);
    if (answerPool.length >= 2500) break;
  }

  const answers = curateTail('en', seededShuffle(answerPool, SEED.en));
  verifyFrozenPrefix('en', answers);
  const allowed = [...allowedSet].sort();

  write({
    lang: 'en',
    source:
      'Dictionary: ENABLE word list (https://github.com/dolph/dictionary). ' +
      'Commonness ranking: hermitdave/FrequencyWords en_50k (OpenSubtitles).',
    license: 'ENABLE: Public Domain. Frequency ranking: MIT.',
    wordLength: WORD_LENGTH,
    counts: { answers: answers.length, allowed: allowed.length },
    answers,
    allowed,
  });
}

async function buildFrench(): Promise<void> {
  assertFreezeIsCurrent('fr');
  const freqRaw = await fetchText(SOURCES.frFreq);
  const ranked = parseFreq(freqRaw);

  // Build a validity dictionary from an-array-of-french-words (MIT). Map each
  // word's normalized form to its first (accented) spelling for reference, and
  // remember which normalized forms are real French words. This is what filters
  // out the names (AARON), English loanwords, and apostrophe-mangled contractions
  // (ESTCE, JUSQU) that pollute raw subtitle frequency lists.
  // Elision stems that appear as bare dictionary artifacts but aren't standalone
  // playable words (e.g. "jusqu" from "jusqu'à").
  const FR_FRAGMENTS = new Set(['JUSQU', 'LORSQU', 'PUISQU', 'QUOIQU', 'PRESQU']);

  const validNormalized = new Set<string>();
  // Infinitives are longer than the 5-letter forms they explain (ARMEZ -> ARMER,
  // AGIRA -> AGIR), so the conjugation filter needs words of every length — the
  // same trap that once made the English -S filter a no-op.
  const frAnyLength = new Set<string>();
  const accents: Record<string, string> = {};
  for (const word of frenchDictionary as string[]) {
    // Skip multi-part entries (contractions/compounds like "est-ce", "jusqu'",
    // "a-t-il") — they normalize to fragment "words" (ESTCE, JUSQU) that aren't
    // real single playable words.
    if (/['’-]/.test(word)) continue;
    const n = normalizeWord(word);
    if (n.length > 0) frAnyLength.add(n);
    if (n.length !== WORD_LENGTH) continue;
    if (FR_FRAGMENTS.has(n)) continue;
    validNormalized.add(n);
    if (!(n in accents) && /[^a-z]/i.test(word)) accents[n] = word;
  }

  // Commonness ordering from the frequency list, gated by dictionary validity.
  const allowedSet = new Set<string>();
  const answerPool: string[] = [];
  const VOWELS = /[AEIOUY]/;
  for (const raw of ranked) {
    const n = normalizeWord(raw);
    if (n.length !== WORD_LENGTH || !VOWELS.test(n)) continue;
    if (!validNormalized.has(n)) continue; // must be a real French word
    if (!allowedSet.has(n)) {
      allowedSet.add(n);
      if (answerPool.length < 2200) answerPool.push(n);
    }
  }

  // Allowed-guess set = every valid 5-letter dictionary word (superset of answers),
  // so players can guess uncommon-but-real words.
  for (const n of validNormalized) allowedSet.add(n);

  // Conjugation filtering happens here, on the shuffled sequence, rather than on
  // the pool: removing words before the shuffle would re-order everything,
  // including the already-published prefix.
  const isFrWord = (w: string): boolean => validNormalized.has(w) || frAnyLength.has(w);
  const answers = curateTail('fr', seededShuffle(answerPool, SEED.fr), (w) =>
    isConjugatedForm(w, isFrWord),
  );
  verifyFrozenPrefix('fr', answers);
  const allowed = [...allowedSet].sort();
  // Trim the accents map to words we actually ship.
  const shippedAccents: Record<string, string> = {};
  for (const n of allowedSet) if (accents[n]) shippedAccents[n] = accents[n]!;

  write({
    lang: 'fr',
    source:
      'Dictionary: an-array-of-french-words (https://github.com/words/an-array-of-french-words). ' +
      'Commonness ranking: hermitdave/FrequencyWords fr_50k (OpenSubtitles). ' +
      'Independently sourced.',
    license: 'Dictionary: MIT. Frequency ranking: MIT.',
    wordLength: WORD_LENGTH,
    counts: { answers: answers.length, allowed: allowed.length },
    answers,
    allowed,
    accents: shippedAccents,
  });
}

await buildEnglish();
await buildFrench();
console.log('done.');
