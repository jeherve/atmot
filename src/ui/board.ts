import { MAX_GUESSES, WORD_LENGTH, type Lang } from '../config.js';
import type { GameState } from '../state/game.js';
import { scoredRows } from '../state/game.js';
import type { TileState } from '../engine/types.js';
import { t } from '../i18n.js';
import { el } from './dom.js';

const STATE_LABEL: Record<TileState, Record<Lang, string>> = {
  correct: { en: 'correct', fr: 'bien placée' },
  present: { en: 'present', fr: 'mal placée' },
  absent: { en: 'absent', fr: 'absente' },
};

/**
 * Render the 6×5 board. `pending` is the in-progress (unsubmitted) guess for the
 * active row. Tiles carry per-tile aria labels announcing the letter + state, so
 * the result is legible to screen readers and colour-blind players alike.
 *
 * `animateRow` is the index of the row that should play the flip-reveal
 * animation — set only on the render immediately following a guess submission.
 * Every other render (keystrokes, restored games, language switches) passes the
 * default `-1`, so already-revealed rows keep their colours without re-flipping
 * each time the board is rebuilt.
 *
 * On the animated row each tile's flip is delayed by its column index (see
 * `REVEAL_STEP_MS`), so the result is revealed letter by letter from left to
 * right; the colour stays hidden until the flip's midpoint (handled in CSS).
 */
/** Delay between consecutive tile flips on a freshly-submitted row, in ms. */
const REVEAL_STEP_MS = 300;
/** Duration of a single tile flip, in ms — must match the `flip` rule in theme.css. */
const REVEAL_FLIP_MS = 500;
/**
 * Total time the staggered reveal takes: the last tile starts after every
 * earlier tile's step, then runs one full flip. Callers use this to avoid
 * rebuilding the board (which would snap the in-flight tiles) before it ends.
 */
export const REVEAL_DURATION_MS = REVEAL_STEP_MS * (WORD_LENGTH - 1) + REVEAL_FLIP_MS;

export function renderBoard(state: GameState, pending: string, animateRow = -1): HTMLElement {
  const rows = scoredRows(state);
  const board = el('div', { class: 'board', role: 'grid', ariaLabel: t(state.lang).play });
  const activeRow = state.guesses.length;

  for (let r = 0; r < MAX_GUESSES; r++) {
    const row = el('div', { class: 'board-row', role: 'row' });
    const guess = state.guesses[r];
    const states = rows[r];
    for (let c = 0; c < WORD_LENGTH; c++) {
      let letter = '';
      const cls = ['tile'];
      let label: string | undefined;
      let style: string | undefined;

      if (guess && states) {
        letter = guess[c] ?? '';
        const s = states[c]!;
        cls.push(s);
        if (r === animateRow) {
          cls.push('reveal');
          style = `--reveal-delay: ${c * REVEAL_STEP_MS}ms`;
        }
        label = `${letter}, ${STATE_LABEL[s][state.lang]}`;
      } else if (r === activeRow) {
        letter = pending[c] ?? '';
        if (letter) cls.push('filled');
      }

      row.append(
        el(
          'div',
          { class: cls.join(' '), role: 'gridcell', ariaLabel: label ?? letter, style },
          letter,
        ),
      );
    }
    board.append(row);
  }
  return board;
}
