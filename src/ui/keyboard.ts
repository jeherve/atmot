import type { Lang } from '../config.js';
import type { GameState } from '../state/game.js';
import { keyboardStates } from '../state/game.js';
import { el } from './dom.js';

const LAYOUTS: Record<Lang, string[]> = {
  en: ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'],
  fr: ['AZERTYUIOP', 'QSDFGHJKLM', 'WXCVBN'],
};

export interface KeyHandlers {
  onLetter: (letter: string) => void;
  onEnter: () => void;
  onBackspace: () => void;
}

/** On-screen keyboard, colour-coded by best-known letter state. */
export function renderKeyboard(state: GameState, lang: Lang, h: KeyHandlers): HTMLElement {
  const states = keyboardStates(state);
  const kb = el('div', { class: 'keyboard' });

  LAYOUTS[lang].forEach((letters, i) => {
    const row = el('div', { class: 'kbrow' });
    if (i === 2) {
      row.append(
        el('button', { class: 'key wide', ariaLabel: 'Enter', onClick: h.onEnter }, 'Enter'),
      );
    }
    for (const ch of letters) {
      const cls = ['key'];
      if (states[ch]) cls.push(states[ch]);
      row.append(
        el('button', { class: cls.join(' '), ariaLabel: ch, onClick: () => h.onLetter(ch) }, ch),
      );
    }
    if (i === 2) {
      row.append(
        el('button', { class: 'key wide', ariaLabel: 'Backspace', onClick: h.onBackspace }, '⌫'),
      );
    }
    kb.append(row);
  });
  return kb;
}
