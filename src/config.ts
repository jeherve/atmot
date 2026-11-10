/**
 * AT Mot — global configuration & frozen constants.
 *
 * This file is the single source of truth for every value that, once shipped,
 * can never change without breaking historical data:
 *   - the puzzle epoch (renumbering all history),
 *   - the canonical domain (baked into every leaderboard target forever),
 *   - the lexicon namespace,
 *   - the `puzzleTarget` URL format (Constellation compares it literally).
 *
 * Treat everything in here as immutable post-launch. See DECISIONS.md.
 */

/** Supported languages in v1. Adding a language is a drop-in: add lists + extend this tuple. */
export const LANGS = ['en', 'fr'] as const;
export type Lang = (typeof LANGS)[number];

export function isLang(value: string): value is Lang {
  return (LANGS as readonly string[]).includes(value);
}

/** Canonical, permanent, final domain. Baked immutably into every puzzleTarget. */
export const DOMAIN = 'atmot.herve.bzh';
export const ORIGIN = `https://${DOMAIN}`;

/** Lexicon authority / namespace. */
export const NSID_AUTHORITY = 'bzh.herve.atmot';
export const COLLECTION = {
  result: `${NSID_AUTHORITY}.result`,
  stats: `${NSID_AUTHORITY}.stats`,
} as const;

/** The single mutable stats/declaration record is keyed `self`. */
export const STATS_RKEY = 'self';

/**
 * Frozen epoch: 2026-06-23 (UTC). Launch day = puzzle #1 for each language.
 * Shared by EN and FR; the lists differ, so the same number yields different words.
 *
 * Stored as the UTC millisecond timestamp of midnight on the epoch date.
 */
export const EPOCH_UTC_MS = Date.UTC(2026, 5, 23); // month is 0-indexed: 5 = June

const MS_PER_DAY = 86_400_000;

/**
 * Whole UTC days elapsed since the epoch for a given instant (default: now).
 * Day of the epoch returns 0.
 */
export function daysSinceEpoch(at: number = Date.now()): number {
  // Normalize `at` to the start of its UTC day so the result only changes at
  // UTC midnight, never mid-day, regardless of the caller's local timezone.
  const utcMidnight = Math.floor(at / MS_PER_DAY) * MS_PER_DAY;
  return Math.floor((utcMidnight - EPOCH_UTC_MS) / MS_PER_DAY);
}

/**
 * The puzzle number for a UTC day. Launch day (epoch) = 1.
 * Days before the epoch return values < 1 (callers should treat those as "no puzzle yet").
 */
export function puzzleNumberFor(at: number = Date.now()): number {
  return daysSinceEpoch(at) + 1;
}

/** The UTC calendar date (YYYY-MM-DD) for a given puzzle number. */
export function puzzleDateString(puzzleNumber: number): string {
  const ms = EPOCH_UTC_MS + (puzzleNumber - 1) * MS_PER_DAY;
  return new Date(ms).toISOString().slice(0, 10);
}

/** Full UTC datetime (midnight) for a puzzle number — used for the `puzzleDate` field. */
export function puzzleDateTime(puzzleNumber: number): string {
  const ms = EPOCH_UTC_MS + (puzzleNumber - 1) * MS_PER_DAY;
  return new Date(ms).toISOString();
}

/**
 * THE shared helper for the leaderboard target. Both the write path (stored in
 * each result record) and the Constellation read path MUST go through this so
 * the format can never diverge.
 *
 * Frozen conventions (Constellation compares the string literally):
 *   scheme https, host exactly atmot.herve.bzh, path /p/<lang>/<puzzleNumber>,
 *   lowercase BCP-47 lang, bare integer, NO trailing slash.
 */
export function puzzleTarget(lang: Lang, puzzleNumber: number): string {
  return `${ORIGIN}/p/${lang}/${puzzleNumber}`;
}

/**
 * The largest puzzle number whose UTC date still falls inside the range that
 * ECMAScript's Date can represent (±8.64e15 ms from 1970). Beyond this,
 * `puzzleDateString` / `puzzleDateTime` throw a RangeError ("Invalid time
 * value"), so `parsePuzzleTarget` rejects out-of-range numbers from crafted
 * URLs rather than letting them crash the render.
 */
const MAX_PUZZLE_NUMBER = Math.floor((8_640_000_000_000_000 - EPOCH_UTC_MS) / MS_PER_DAY) + 1;

/** Parse a puzzleTarget / permalink path back into (lang, puzzleNumber), or null. */
export function parsePuzzleTarget(input: string): { lang: Lang; puzzleNumber: number } | null {
  let path = input;
  try {
    if (input.includes('://')) path = new URL(input).pathname;
  } catch {
    return null;
  }
  const m = /^\/p\/([a-z-]+)\/(\d+)$/.exec(path);
  if (!m) return null;
  const lang = m[1]!;
  const puzzleNumber = Number(m[2]);
  if (
    !isLang(lang) ||
    !Number.isInteger(puzzleNumber) ||
    puzzleNumber < 1 ||
    puzzleNumber > MAX_PUZZLE_NUMBER
  )
    return null;
  return { lang, puzzleNumber };
}

/**
 * Where the language toggle should take you. Puzzle pages encode the language
 * in the URL (`/p/<lang>/<n>`), so the router re-derives the language from the
 * path on every render — switching `ctx.lang` alone leaves a puzzle page on its
 * original language. Returns the equivalent puzzle path in `lang`, or null when
 * the current path is language-independent (or already in `lang`) and a plain
 * re-render suffices.
 */
export function pathForLangSwitch(currentPath: string, lang: Lang): string | null {
  const puzzle = parsePuzzleTarget(currentPath);
  if (puzzle && puzzle.lang !== lang) return `/p/${lang}/${puzzle.puzzleNumber}`;
  return null;
}

/** Deterministic rkey for a result record: `<lang>-<puzzleNumber>` (documented in the lexicon). */
export function resultRkey(lang: Lang, puzzleNumber: number): string {
  return `${lang}-${puzzleNumber}`;
}

/** Game rules. */
export const WORD_LENGTH = 5;
export const MAX_GUESSES = 6;

/** Constellation (microcosm) public backlink index. */
export const CONSTELLATION_BASE = 'https://constellation.microcosm.blue';

/** Sent on every Constellation request (microcosm asks for a descriptive UA + contact). */
export const USER_AGENT = `atmot/1.0 (+${ORIGIN}; word game; https://github.com/jeherve/atmot)`;

/** Handle/identity resolution endpoint (Bluesky AppView; web apps lack DNS access). */
export const APPVIEW_URL = 'https://public.api.bsky.app';
