import type { Lang } from '../config.js';

/** Tile state after scoring a guessed letter. */
export type TileState = 'correct' | 'present' | 'absent';

/**
 * Compact single-character codes stored in the result record's `grid` rows and
 * used internally. Deliberately colour-letters, never the guessed letters:
 *   G = correct (right letter, right spot)
 *   Y = present (right letter, wrong spot)
 *   B = absent  (not in the word)
 */
export type TileCode = 'G' | 'Y' | 'B';

export const TILE_CODE: Record<TileState, TileCode> = {
  correct: 'G',
  present: 'Y',
  absent: 'B',
};

export const TILE_STATE: Record<TileCode, TileState> = {
  G: 'correct',
  Y: 'present',
  B: 'absent',
};

/** One scored guess: the (normalized) word plus per-letter states. */
export interface ScoredGuess {
  word: string;
  states: TileState[];
}

/** Outcome of a finished game, the basis for the result record and share grid. */
export interface GameResult {
  lang: Lang;
  puzzleNumber: number;
  solved: boolean;
  /** 1–6 when solved; undefined on a loss. */
  guessCount?: number;
  /** Tile-state rows, colours only. */
  rows: TileState[][];
}
