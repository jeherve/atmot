/**
 * build-wordlists.ts — generate the per-language word lists shipped with AT Mot.
 *
 * Sources (both license-clean and deliberately NOT derived from the
 * wordle-fr / "Le Mot" project):
 *   - English dictionary: ENABLE word list — public domain.
 *   - French dictionary + both commonness rankings: hermitdave/FrequencyWords
 *     (OpenSubtitles frequency lists) — MIT licensed.
 *
 * Output: src/data/words.<lang>.json, committed to the repo. The ANSWER order is
 * a fixed seeded shuffle baked into the file, so every client worldwide indexes
 * the identical sequence (UTC daily agreement is guaranteed by shared data, not
 * by runtime computation). Re-run with `npm run build:words`.
 *
 * The output is reproducible: same sources + same seeds => byte-identical files.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { normalizeWord } from '../src/engine/normalize.ts';
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

function write(list: WordList): void {
  mkdirSync(DATA_DIR, { recursive: true });
  const file = resolve(DATA_DIR, `words.${list.lang}.json`);
  writeFileSync(file, JSON.stringify(list, null, 0) + '\n');
  console.log(
    `words.${list.lang}.json: ${list.counts.answers} answers, ${list.counts.allowed} allowed`,
  );
}

async function buildEnglish(): Promise<void> {
  const [enableRaw, freqRaw] = await Promise.all([
    fetchText(SOURCES.enable),
    fetchText(SOURCES.enFreq),
  ]);

  // Dictionary: every 5-letter A–Z word in ENABLE => the allowed-guess set.
  const allowedSet = new Set<string>();
  for (const w of enableRaw.split('\n')) {
    const n = normalizeWord(w);
    if (n.length === WORD_LENGTH) allowedSet.add(n);
  }

  // Commonness ranking from the frequency list (only words present in ENABLE).
  const freqRanked = parseFreq(freqRaw)
    .map(normalizeWord)
    .filter((w) => w.length === WORD_LENGTH && allowedSet.has(w));

  // Heuristic: drop obvious plurals as answers (word ends in S and the singular
  // is also a dictionary word) so the answer pool is mostly base words. They stay
  // valid as guesses.
  const seen = new Set<string>();
  const answerPool: string[] = [];
  for (const w of freqRanked) {
    if (seen.has(w)) continue;
    seen.add(w);
    if (w.endsWith('S') && allowedSet.has(w.slice(0, -1))) continue;
    answerPool.push(w);
    if (answerPool.length >= 2500) break;
  }

  const answers = seededShuffle(answerPool, SEED.en);
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
  const accents: Record<string, string> = {};
  for (const word of frenchDictionary as string[]) {
    // Skip multi-part entries (contractions/compounds like "est-ce", "jusqu'",
    // "a-t-il") — they normalize to fragment "words" (ESTCE, JUSQU) that aren't
    // real single playable words.
    if (/['’-]/.test(word)) continue;
    const n = normalizeWord(word);
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

  const answers = seededShuffle(answerPool, SEED.fr);
  const allowed = [...allowedSet].sort();
  // Trim the accents map to words we actually ship.
  const shippedAccents: Record<string, string> = {};
  for (const n of allowedSet) if (accents[n]) shippedAccents[n] = accents[n]!;

  write({
    lang: 'fr',
    source:
      'Dictionary: an-array-of-french-words (https://github.com/words/an-array-of-french-words). ' +
      'Commonness ranking: hermitdave/FrequencyWords fr_50k (OpenSubtitles). ' +
      'Independently sourced — no relation to the wordle-fr / "Le Mot" project.',
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
