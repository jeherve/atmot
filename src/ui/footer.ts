import { t } from '../i18n.js';
import { el } from './dom.js';
import { navTo } from './header.js';
import { colorBlindEnabled, setColorBlind } from './colorblind.js';
import type { Ctx } from './context.js';

const PROFILE_URL = 'https://bsky.app/profile/jeremy.herve.bzh';

/**
 * Monospace status line — the quiet "developer tool" signature. Carries the
 * puzzle lineage plus a link to the author's profile. The architecture details
 * (records, backlink reads, lexicon authority) now live on the About page
 * rather than crowding every footer.
 */
export function renderFooter(ctx: Ctx, puzzleNumber?: number): HTMLElement {
  const lines: HTMLElement[] = [];
  if (puzzleNumber != null) {
    lines.push(
      el('div', { class: 'line' }, el('span', {}, 'puzzle ', el('b', {}, `#${puzzleNumber}`), ` · ${ctx.lang}`)),
    );
  }

  const cbToggle = el(
    'button',
    {
      class: 'cb-toggle',
      type: 'button',
      'aria-pressed': String(colorBlindEnabled()),
      title: t(ctx.lang).colorBlindMode,
    },
    t(ctx.lang).colorBlindMode,
  );
  cbToggle.addEventListener('click', () => {
    const next = !colorBlindEnabled();
    setColorBlind(next);
    cbToggle.setAttribute('aria-pressed', String(next));
  });

  lines.push(
    el(
      'div',
      { class: 'line links', style: puzzleNumber != null ? 'margin-top:6px' : undefined },
      el('a', { href: '/about', onClick: navTo(ctx, '/about') }, t(ctx.lang).about),
      cbToggle,
      el('span', { class: 'spacer' }),
      el(
        'a',
        {
          href: PROFILE_URL,
          target: '_blank',
          rel: 'noopener noreferrer',
          class: 'iconlink',
          title: t(ctx.lang).profile,
          ariaLabel: t(ctx.lang).profile,
        },
        el('img', { src: '/jeremy-herve.svg', alt: '', width: '18', height: '18', class: 'avatar' }),
      ),
    ),
  );

  return el('footer', { class: 'status' }, ...lines);
}
