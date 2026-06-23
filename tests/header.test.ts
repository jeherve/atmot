// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import { renderHeader } from '../src/ui/header.js';
import { pathForLangSwitch } from '../src/config.js';
import type { Ctx } from '../src/ui/context.js';

function makeCtx(over: Partial<Ctx> = {}): Ctx {
  return {
    lang: 'fr',
    session: null,
    handle: null,
    pendingRecord: null,
    setLang() {},
    navigate() {},
    rerender() {},
    async signInWith() {},
    async signOut() {},
    ...over,
  };
}

describe('renderHeader language switch', () => {
  it('the EN button asks to switch to English', () => {
    const setLang = vi.fn();
    const header = renderHeader(makeCtx({ setLang }));
    const en = [...header.querySelectorAll('button')].find((b) => b.textContent === 'EN');
    expect(en).toBeDefined();
    en!.click();
    expect(setLang).toHaveBeenCalledWith('en');
  });

  // Regression: on a French puzzle page, switching to EN must route to the
  // English puzzle. Previously setLang only flipped ctx.lang and re-rendered,
  // so the router re-derived `fr` from the unchanged path and nothing changed.
  it('switching language on a puzzle page routes to the same puzzle in the new language', () => {
    expect(pathForLangSwitch('/p/fr/1', 'en')).toBe('/p/en/1');
  });
});
