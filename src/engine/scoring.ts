import { WORD_LENGTH } from '../config.js';
import type { TileState } from './types.js';

/**
 * Score a guess against the answer using the standard two-pass rules:
 *   1. Mark exact matches (correct / green).
 *   2. For the rest, mark present (yellow) only while unused answer letters of
 *      that value remain — so duplicate letters are handled correctly
 *      (a second guessed 'E' goes grey if the answer has only one 'E' and it
 *      was already matched).
 *
 * Both inputs MUST already be normalized (uppercase A–Z, length WORD_LENGTH).
 */
export function scoreGuess(guess: string, answer: string): TileState[] {
  if (guess.length !== WORD_LENGTH || answer.length !== WORD_LENGTH) {
    throw new Error(`scoreGuess expects ${WORD_LENGTH}-letter words`);
  }

  const states: TileState[] = new Array(WORD_LENGTH).fill('absent');
  // Count answer letters not yet consumed by a green match.
  const remaining: Record<string, number> = {};

  for (let i = 0; i < WORD_LENGTH; i++) {
    const a = answer[i]!;
    if (guess[i] === a) {
      states[i] = 'correct';
    } else {
      remaining[a] = (remaining[a] ?? 0) + 1;
    }
  }

  for (let i = 0; i < WORD_LENGTH; i++) {
    if (states[i] === 'correct') continue;
    const g = guess[i]!;
    if ((remaining[g] ?? 0) > 0) {
      states[i] = 'present';
      remaining[g]!--;
    }
  }

  return states;
}

/** True when every tile is correct. */
export function isWin(states: TileState[]): boolean {
  return states.every((s) => s === 'correct');
}
