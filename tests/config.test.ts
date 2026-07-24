import { describe, it, expect } from 'vitest';
import {
  puzzleTarget,
  parsePuzzleTarget,
  pathForLangSwitch,
  resultRkey,
  daysSinceEpoch,
  puzzleNumberFor,
  puzzleDateString,
  EPOCH_UTC_MS,
} from '../src/config.js';

describe('puzzleTarget — frozen format (Constellation matches literally)', () => {
  it('emits the exact canonical URL with no trailing slash', () => {
    expect(puzzleTarget('fr', 412)).toBe('https://atmot.herve.bzh/p/fr/412');
    expect(puzzleTarget('en', 1)).toBe('https://atmot.herve.bzh/p/en/1');
  });

  it('round-trips through parsePuzzleTarget', () => {
    for (const t of [puzzleTarget('en', 7), puzzleTarget('fr', 999)]) {
      const parsed = parsePuzzleTarget(t);
      expect(parsed).not.toBeNull();
      expect(puzzleTarget(parsed!.lang, parsed!.puzzleNumber)).toBe(t);
    }
  });

  it('parses a bare path too', () => {
    expect(parsePuzzleTarget('/p/fr/412')).toEqual({ lang: 'fr', puzzleNumber: 412 });
  });

  it('rejects malformed / divergent targets (trailing slash, caps, bad lang)', () => {
    expect(parsePuzzleTarget('https://atmot.herve.bzh/p/fr/412/')).toBeNull();
    expect(parsePuzzleTarget('https://atmot.herve.bzh/p/FR/412')).toBeNull();
    expect(parsePuzzleTarget('https://atmot.herve.bzh/p/de/1')).toBeNull();
    expect(parsePuzzleTarget('https://atmot.herve.bzh/p/fr/0')).toBeNull();
  });

  it('rejects numbers whose date overflows Date (crafted /p/en/100000001 crash)', () => {
    // 99_979_374 is the last puzzle whose UTC date is still representable; one
    // more overflows and made puzzleDateString throw "Invalid time value",
    // taking down the puzzle-page render.
    expect(parsePuzzleTarget('/p/en/99979374')).toEqual({ lang: 'en', puzzleNumber: 99_979_374 });
    expect(() => puzzleDateString(99_979_374)).not.toThrow();
    expect(parsePuzzleTarget('/p/en/99979375')).toBeNull();
    expect(parsePuzzleTarget('/p/en/100000001')).toBeNull();
  });
});

describe('pathForLangSwitch — keep puzzle pages in sync with the lang toggle', () => {
  it('redirects a puzzle page to the same puzzle in the new language', () => {
    expect(pathForLangSwitch('/p/fr/1', 'en')).toBe('/p/en/1');
    expect(pathForLangSwitch('/p/en/412', 'fr')).toBe('/p/fr/412');
  });

  it('returns null when the puzzle is already in the target language', () => {
    expect(pathForLangSwitch('/p/fr/1', 'fr')).toBeNull();
  });

  it('returns null on language-independent paths (home, about)', () => {
    expect(pathForLangSwitch('/', 'fr')).toBeNull();
    expect(pathForLangSwitch('/about', 'en')).toBeNull();
  });
});

describe('resultRkey', () => {
  it('is <lang>-<puzzleNumber>', () => {
    expect(resultRkey('en', 412)).toBe('en-412');
    expect(resultRkey('fr', 1)).toBe('fr-1');
  });
});

describe('UTC daily rollover', () => {
  it('epoch day is day 0 / puzzle #1', () => {
    expect(daysSinceEpoch(EPOCH_UTC_MS)).toBe(0);
    expect(puzzleNumberFor(EPOCH_UTC_MS)).toBe(1);
  });

  it('only rolls over at UTC midnight, not local midnight', () => {
    const justBeforeUtcMidnight = EPOCH_UTC_MS + 86_400_000 - 1; // 23:59:59.999 UTC day 0
    const atUtcMidnight = EPOCH_UTC_MS + 86_400_000; // 00:00 UTC day 1
    expect(puzzleNumberFor(justBeforeUtcMidnight)).toBe(1);
    expect(puzzleNumberFor(atUtcMidnight)).toBe(2);
  });

  it('a fixed instant yields the same puzzle number regardless of process TZ', () => {
    // The function normalizes to UTC day, so the result is TZ-independent by design.
    const instant = Date.UTC(2026, 7, 1, 5, 30); // Aug 1 2026 05:30 UTC
    expect(puzzleNumberFor(instant)).toBe(daysSinceEpoch(instant) + 1);
  });

  it('puzzleDateString maps #1 back to the epoch date', () => {
    expect(puzzleDateString(1)).toBe('2026-06-23');
    expect(puzzleDateString(2)).toBe('2026-06-24');
  });
});
