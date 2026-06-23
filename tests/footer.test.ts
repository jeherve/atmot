// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { renderFooter } from '../src/ui/footer.js';
import type { Ctx } from '../src/ui/context.js';

function makeCtx(): Ctx {
  return {
    lang: 'en',
    session: null,
    handle: null,
    pendingRecord: null,
    setLang() {},
    navigate() {},
    rerender() {},
    async signInWith() {},
    async signOut() {},
  };
}

describe('renderFooter', () => {
  it('links to the source repo and the Bluesky profile', () => {
    const footer = renderFooter(makeCtx());
    const hrefs = [...footer.querySelectorAll('a')].map((a) => a.getAttribute('href'));
    expect(hrefs).toContain('https://tangled.org/jeremy.herve.bzh/atmot');
    expect(hrefs).toContain('https://bsky.app/profile/jeremy.herve.bzh');
  });

  it('renders the tangled mark inline and the avatar as an image', () => {
    const footer = renderFooter(makeCtx());
    expect(footer.querySelector('a[href*="tangled.org"] svg')).not.toBeNull();
    const avatar = footer.querySelector('a[href*="bsky.app"] img');
    expect(avatar?.getAttribute('src')).toBe('/jeremy-herve.svg');
  });

  it('keeps the About link and the puzzle lineage', () => {
    const footer = renderFooter(makeCtx(), 42);
    expect(footer.querySelector('a[href="/about"]')).not.toBeNull();
    expect(footer.textContent).toContain('#42');
  });

  it('no longer surfaces the architecture details that moved to the About page', () => {
    const text = renderFooter(makeCtx(), 42).textContent ?? '';
    expect(text).not.toContain('constellation.microcosm.blue');
    expect(text).not.toContain('records →');
    expect(text).not.toContain('authority');
    expect(text).not.toContain('MIT / Apache-2.0');
  });
});
