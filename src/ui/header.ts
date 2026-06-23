import { LANGS } from '../config.js';
import { t } from '../i18n.js';
import { el } from './dom.js';
import type { Ctx } from './context.js';

export function renderHeader(ctx: Ctx): HTMLElement {
  const langswitch = el('div', { class: 'langswitch', role: 'group', ariaLabel: 'Language' });
  for (const l of LANGS) {
    langswitch.append(
      el(
        'button',
        {
          'aria-pressed': String(l === ctx.lang),
          onClick: () => ctx.setLang(l),
        },
        l.toUpperCase(),
      ),
    );
  }

  const actions = el('div', { class: 'bar-actions' }, langswitch);

  if (ctx.session) {
    const who = ctx.handle ? `@${ctx.handle}` : 'signed in';
    actions.append(
      el('button', { class: 'btn small', title: who, onClick: () => void ctx.signOut() }, t(ctx.lang).signOut),
    );
  }

  return el(
    'header',
    { class: 'bar' },
    el(
      'div',
      { class: 'brand' },
      el('span', { class: 'mark' }, el('a', { href: '/', onClick: navTo(ctx, '/') }, 'AT Mot')),
      el('span', { class: 'sub' }, t(ctx.lang).tagline),
    ),
    actions,
  );
}

/** Intercept link clicks for client-side navigation. */
export function navTo(ctx: Ctx, path: string) {
  return (e: Event) => {
    e.preventDefault();
    ctx.navigate(path);
  };
}
