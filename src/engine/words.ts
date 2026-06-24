import { LANGS, type Lang } from '../config.js';
import { normalizeWord } from './normalize.js';
import { decodeAnswers } from './obfuscate.js';
import enData from '../data/words.en.json';
import frData from '../data/words.fr.json';

export interface WordList {
  lang: string;
  source: string;
  license: string;
  wordLength: number;
  counts: { answers: number; allowed: number };
  answers: string[];
  allowed: string[];
  accents?: Record<string, string>;
}

/** Shape of the shipped JSON: the answer sequence is obfuscated (see obfuscate.ts). */
interface RawWordData extends Omit<WordList, 'answers'> {
  answersEnc: string;
}

/** Decode the obfuscated answer sequence once, at module load. */
function hydrate(raw: RawWordData): WordList {
  const { answersEnc, ...rest } = raw;
  return { ...rest, answers: decodeAnswers(answersEnc) };
}

const DATA: Record<Lang, WordList> = {
  en: hydrate(enData as RawWordData),
  fr: hydrate(frData as RawWordData),
};

// Build allowed-guess sets once. Answers are always valid guesses too.
const ALLOWED_SETS: Record<Lang, Set<string>> = {
  en: new Set([...DATA.en.allowed, ...DATA.en.answers]),
  fr: new Set([...DATA.fr.allowed, ...DATA.fr.answers]),
};

export function getWordList(lang: Lang): WordList {
  return DATA[lang];
}

/**
 * The deterministic answer for a (lang, puzzleNumber). Cycles through the fixed
 * seeded answer sequence baked into the shipped data, so every client agrees.
 *
 * Puzzle #1 (launch / epoch) maps to index 0.
 */
export function dailyAnswer(lang: Lang, puzzleNumber: number): string {
  const list = DATA[lang].answers;
  // (puzzleNumber - 1) === daysSinceEpoch. Modulo wraps after the list is exhausted.
  const idx = ((puzzleNumber - 1) % list.length + list.length) % list.length;
  return list[idx]!;
}

/** True if a typed guess is a valid word for the language (normalized internally). */
export function isAllowedGuess(lang: Lang, raw: string): boolean {
  return ALLOWED_SETS[lang].has(normalizeWord(raw));
}

/** The accented reference spelling of a normalized word, if known (FR only). */
export function accentedForm(lang: Lang, normalized: string): string | undefined {
  return DATA[lang].accents?.[normalized];
}

/** Sanity helper used by tests: every supported language has lists loaded. */
export function loadedLangs(): Lang[] {
  return LANGS.filter((l) => DATA[l].answers.length > 0);
}
