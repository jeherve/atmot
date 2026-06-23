// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { renderBoard } from '../src/ui/board.js';
import type { GameState } from '../src/state/game.js';

/** A game with one submitted guess; the active (second) row is in progress. */
function gameWithOneGuess(): GameState {
  return {
    lang: 'en',
    puzzleNumber: 1,
    answer: 'CRANE',
    guesses: ['SLATE'],
    status: 'playing',
  };
}

describe('renderBoard reveal animation', () => {
  it('does not animate a previously-revealed row while typing the next guess', () => {
    // Simulates a keystroke re-render (renderBoardOnly): no row should animate,
    // so row 1 must keep its colours without re-running the flip animation.
    const board = renderBoard(gameWithOneGuess(), 'CR');
    expect(board.querySelectorAll('.tile.reveal')).toHaveLength(0);
    // Colours are still applied to the submitted row.
    expect(board.querySelectorAll('.tile.correct, .tile.present, .tile.absent').length).toBe(5);
  });

  it('animates only the row that was just submitted', () => {
    const board = renderBoard(gameWithOneGuess(), '', 0);
    const animated = board.querySelectorAll('.tile.reveal');
    expect(animated).toHaveLength(5);
    // Every animated tile belongs to the first row only.
    const firstRow = board.querySelectorAll('.board-row')[0]!;
    animated.forEach((tile) => expect(firstRow.contains(tile)).toBe(true));
  });
});
