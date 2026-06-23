// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { renderKeyboard } from '../src/ui/keyboard.js';
import type { GameState } from '../src/state/game.js';

const NOOP = { onLetter: () => {}, onEnter: () => {}, onBackspace: () => {} };

function game(lang: 'en' | 'fr'): GameState {
  return { lang, puzzleNumber: 1, answer: 'CRANE', guesses: [], status: 'playing' };
}

/** The letter keys in DOM order, ignoring the Enter / Backspace controls. */
function letterRows(kb: HTMLElement): string[] {
  return Array.from(kb.querySelectorAll('.kbrow')).map((row) =>
    Array.from(row.querySelectorAll('.key:not(.wide)'))
      .map((b) => b.textContent)
      .join(''),
  );
}

describe('renderKeyboard layout', () => {
  it('uses a QWERTY layout for English', () => {
    expect(letterRows(renderKeyboard(game('en'), 'en', NOOP))).toEqual([
      'QWERTYUIOP',
      'ASDFGHJKL',
      'ZXCVBNM',
    ]);
  });

  it('uses an AZERTY layout for French', () => {
    expect(letterRows(renderKeyboard(game('fr'), 'fr', NOOP))).toEqual([
      'AZERTYUIOP',
      'QSDFGHJKLM',
      'WXCVBN',
    ]);
  });

  it('covers all 26 letters in both layouts', () => {
    for (const lang of ['en', 'fr'] as const) {
      const letters = letterRows(renderKeyboard(game(lang), lang, NOOP)).join('').split('').sort();
      expect(letters.join('')).toBe('ABCDEFGHIJKLMNOPQRSTUVWXYZ');
    }
  });
});
