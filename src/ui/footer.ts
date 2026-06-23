import { NSID_AUTHORITY, COLLECTION } from '../config.js';
import { t } from '../i18n.js';
import { el } from './dom.js';
import { navTo } from './header.js';
import type { Ctx } from './context.js';

/**
 * Monospace status line — the quiet "developer tool" signature. Surfaces the
 * puzzle lineage and the no-database architecture as ambient UI detail.
 */
export function renderFooter(ctx: Ctx, puzzleNumber?: number): HTMLElement {
  const bits: Array<Node | string> = [];
  if (puzzleNumber != null) {
    bits.push(el('span', {}, 'puzzle ', el('b', {}, `#${puzzleNumber}`), ` · ${ctx.lang}`));
  }
  bits.push(el('span', {}, 'records → ', el('b', {}, `${COLLECTION.result}`)));
  bits.push(el('span', {}, 'reads ← ', el('b', {}, 'constellation.microcosm.blue')));

  return el(
    'footer',
    { class: 'status' },
    el('div', { class: 'line' }, ...bits),
    el(
      'div',
      { class: 'line', style: 'margin-top:6px' },
      el('span', {}, t(ctx.lang).dataNote),
    ),
    el(
      'div',
      { class: 'line', style: 'margin-top:6px' },
      el('a', { href: '/about', onClick: navTo(ctx, '/about') }, t(ctx.lang).about),
      el('span', {}, '·'),
      el('span', {}, `authority ${NSID_AUTHORITY}`),
      el('span', {}, '·'),
      el('span', {}, 'MIT / Apache-2.0'),
    ),
  );
}
