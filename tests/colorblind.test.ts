// @vitest-environment happy-dom
import { describe, expect, it, beforeEach } from 'vitest';
import { colorBlindEnabled, setColorBlind, initColorBlind } from '../src/ui/colorblind.js';

beforeEach(() => {
  localStorage.clear();
  document.documentElement.className = '';
});

describe('colour-blind preference', () => {
  it('is off by default — no cb-safe class', () => {
    expect(colorBlindEnabled()).toBe(false);
    initColorBlind();
    expect(document.documentElement.classList.contains('cb-safe')).toBe(false);
  });

  it('enabling persists and adds the cb-safe class', () => {
    setColorBlind(true);
    expect(colorBlindEnabled()).toBe(true);
    expect(document.documentElement.classList.contains('cb-safe')).toBe(true);
  });

  it('disabling clears the flag and the class', () => {
    setColorBlind(true);
    setColorBlind(false);
    expect(colorBlindEnabled()).toBe(false);
    expect(document.documentElement.classList.contains('cb-safe')).toBe(false);
  });

  it('initColorBlind re-applies a previously-saved preference', () => {
    setColorBlind(true);
    document.documentElement.className = ''; // simulate a fresh page load
    initColorBlind();
    expect(document.documentElement.classList.contains('cb-safe')).toBe(true);
  });
});
