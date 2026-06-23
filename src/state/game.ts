/**
 * Local game state for the current daily puzzle. Persisted to localStorage so an
 * in-progress or finished game survives a reload. This is purely local UX state;
 * the canonical record is written to the player's PDS on finish.
 */
import { MAX_GUESSES, WORD_LENGTH, type Lang } from '../config.js';
import { dailyAnswer } from '../engine/words.js';
import { scoreGuess } from '../engine/scoring.js';
import { normalizeWord } from '../engine/normalize.js';
import type { GameResult, TileState } from '../engine/types.js';

export type GameStatus = 'playing' | 'won' | 'lost';

export interface GameState {
  lang: Lang;
  puzzleNumber: number;
  answer: string;
  guesses: string[]; // normalized guessed words
  status: GameStatus;
}

function storageKey(lang: Lang, puzzleNumber: number): string {
  return `atmot:game:${lang}:${puzzleNumber}`;
}

export function loadGame(lang: Lang, puzzleNumber: number): GameState {
  const answer = dailyAnswer(lang, puzzleNumber);
  const raw = localStorage.getItem(storageKey(lang, puzzleNumber));
  if (raw) {
    try {
      const saved = JSON.parse(raw) as { guesses: string[] };
      const guesses = Array.isArray(saved.guesses) ? saved.guesses.slice(0, MAX_GUESSES) : [];
      return { lang, puzzleNumber, answer, guesses, status: deriveStatus(guesses, answer) };
    } catch {
      /* fall through to a fresh game */
    }
  }
  return { lang, puzzleNumber, answer, guesses: [], status: 'playing' };
}

function deriveStatus(guesses: string[], answer: string): GameStatus {
  if (guesses.some((g) => g === answer)) return 'won';
  if (guesses.length >= MAX_GUESSES) return 'lost';
  return 'playing';
}

function save(state: GameState): void {
  localStorage.setItem(
    storageKey(state.lang, state.puzzleNumber),
    JSON.stringify({ guesses: state.guesses }),
  );
}

/** Append a (normalized) guess. Caller must validate it's allowed first. */
export function applyGuess(state: GameState, rawGuess: string): GameState {
  if (state.status !== 'playing') return state;
  const guess = normalizeWord(rawGuess);
  if (guess.length !== WORD_LENGTH) return state;
  const guesses = [...state.guesses, guess];
  const next: GameState = { ...state, guesses, status: deriveStatus(guesses, state.answer) };
  save(next);
  return next;
}

/** Scored rows for rendering and for the result/share grid. */
export function scoredRows(state: GameState): TileState[][] {
  return state.guesses.map((g) => scoreGuess(g, state.answer));
}

export function isFinished(state: GameState): boolean {
  return state.status !== 'playing';
}

/** Per-letter best-known state across all guesses, for keyboard colouring. */
export function keyboardStates(state: GameState): Record<string, TileState> {
  const rank: Record<TileState, number> = { absent: 0, present: 1, correct: 2 };
  const out: Record<string, TileState> = {};
  for (const guess of state.guesses) {
    const states = scoreGuess(guess, state.answer);
    for (let i = 0; i < guess.length; i++) {
      const letter = guess[i]!;
      const s = states[i]!;
      if (!out[letter] || rank[s] > rank[out[letter]]) out[letter] = s;
    }
  }
  return out;
}

/** Build the immutable GameResult for the PDS record / share grid. */
export function toGameResult(state: GameState): GameResult {
  const solved = state.status === 'won';
  const result: GameResult = {
    lang: state.lang,
    puzzleNumber: state.puzzleNumber,
    solved,
    rows: scoredRows(state),
  };
  if (solved) result.guessCount = state.guesses.length;
  return result;
}
