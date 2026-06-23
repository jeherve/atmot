import { describe, it, expect } from 'vitest';
import { scoreGuess, isWin } from '../src/engine/scoring.js';
import type { TileState } from '../src/engine/types.js';

const C: TileState = 'correct';
const P: TileState = 'present';
const A: TileState = 'absent';

describe('scoreGuess', () => {
  it('all correct on exact match', () => {
    expect(scoreGuess('CRANE', 'CRANE')).toEqual([C, C, C, C, C]);
    expect(isWin(scoreGuess('CRANE', 'CRANE'))).toBe(true);
  });

  it('marks present for right letter wrong spot', () => {
    // answer PLANT, guess PETAL
    // idx0 P==P correct; E absent; T present; A present; L present
    expect(scoreGuess('PETAL', 'PLANT')).toEqual([C, A, P, P, P]);
  });

  it('handles duplicate letters around exact matches', () => {
    // answer THREE = T H R E E; guess EERIE = E E R I E
    // idx2 R correct, idx4 E correct; remaining E:1
    // idx0 E -> present (consumes last E); idx1 E -> absent; idx3 I absent
    expect(scoreGuess('EERIE', 'THREE')).toEqual([P, A, C, A, C]);
  });

  it('classic duplicate case: guess SPEED vs answer ERASE', () => {
    // ERASE: E R A S E (E at 0 and 4, one S at 3)
    // SPEED: S P E E D
    // idx0 S: answer has S(idx3), not exact -> present
    // idx1 P: absent
    // idx2 E: present (answer has E x2)
    // idx3 E: present (2nd E) -> now 0 E remaining
    // idx4 D: absent
    expect(scoreGuess('SPEED', 'ERASE')).toEqual([P, A, P, P, A]);
  });

  it('throws on wrong-length input', () => {
    expect(() => scoreGuess('ABC', 'ABCDE')).toThrow();
  });
});
