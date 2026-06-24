import { describe, it, expect } from 'vitest';
import { encodeAnswers, decodeAnswers } from '../src/engine/obfuscate.js';

describe('answer-list obfuscation', () => {
  const sample = ['DRAMA', 'SMITH', 'LACEY', 'KOALA', 'FLEAU'];

  it('round-trips a list of words back to byte-identical strings', () => {
    expect(decodeAnswers(encodeAnswers(sample))).toEqual(sample);
  });

  it('is deterministic — same input always encodes to the same blob', () => {
    expect(encodeAnswers(sample)).toBe(encodeAnswers(sample));
  });

  it('round-trips an empty list back to an empty list (not [""])', () => {
    expect(decodeAnswers(encodeAnswers([]))).toEqual([]);
  });

  it('produces an ASCII base64 string (safe to embed in JSON / a JS bundle)', () => {
    const blob = encodeAnswers(sample);
    expect(typeof blob).toBe('string');
    expect(/^[A-Za-z0-9+/]+=*$/.test(blob)).toBe(true);
  });

  it('does not leak the plaintext words (not greppable)', () => {
    const blob = encodeAnswers(sample);
    for (const word of sample) {
      expect(blob).not.toContain(word);
    }
  });

  it('round-trips a large realistic list', () => {
    const words = Array.from({ length: 2500 }, (_, i) =>
      // deterministic pseudo-words, all 5 uppercase A–Z letters
      String.fromCharCode(
        65 + (i % 26),
        65 + ((i * 7) % 26),
        65 + ((i * 13) % 26),
        65 + ((i * 17) % 26),
        65 + ((i * 23) % 26),
      ),
    );
    expect(decodeAnswers(encodeAnswers(words))).toEqual(words);
  });
});
