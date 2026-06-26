// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import { renderPlayView } from '../src/ui/playView.js';
import type { Ctx } from '../src/ui/context.js';

function makeCtx(session: Ctx['session'] = null): Ctx {
  return {
    lang: 'en',
    session,
    handle: null,
    pendingRecord: null,
    setLang() {},
    navigate() {},
    rerender() {},
    async signInWith() {},
    async signOut() {},
  };
}

/** Index of the first top-level child of <main> matching `selector`. */
function childIndex(main: Element, selector: string): number {
  const children = [...main.children];
  return children.findIndex((c) => c.matches(selector) || c.querySelector(selector) !== null);
}

describe('renderPlayView layout order', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  // Regression for issue #2: the sign-in prompt used to sit between the board and
  // the keyboard, pushing the keys off-screen on mobile. Tiles → keyboard → prompt.
  it('renders the keyboard before the sign-in prompt while signed out', () => {
    const root = document.createElement('div');
    renderPlayView(makeCtx(null), root);

    const main = root.querySelector('main');
    expect(main).not.toBeNull();

    const boardIdx = childIndex(main!, '.board');
    const keyboardIdx = childIndex(main!, '.keyboard');
    const signInIdx = childIndex(main!, '.signin');

    expect(boardIdx).toBeGreaterThanOrEqual(0);
    expect(keyboardIdx).toBeGreaterThan(boardIdx);
    expect(signInIdx).toBeGreaterThan(keyboardIdx);
  });
});
