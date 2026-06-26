import { LANGS } from '../config.js';
import { t } from '../i18n.js';
import { el } from './dom.js';
import { openHelp } from './help.js';
import type { Ctx } from './context.js';

/** Options for the shared header. `showSignIn` adds a signed-out shortcut to the inline sign-in bar (play view only). */
export interface HeaderOpts {
  showSignIn?: boolean;
}

/** Bring the inline sign-in bar into view and focus its input. No-op if the bar isn't on the page. */
function focusSignInBar(): void {
  const input = document.getElementById('atmot-handle');
  if (!input) return;
  input.focus({ preventScroll: true }); // focus first so mobile pops the keyboard
  input.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
}

export function renderHeader(ctx: Ctx, opts: HeaderOpts = {}): HTMLElement {
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

  const help = el(
    'button',
    {
      class: 'btn small icon',
      type: 'button',
      title: t(ctx.lang).helpOpen,
      ariaLabel: t(ctx.lang).helpOpen,
      onClick: () => openHelp(ctx.lang),
    },
    '?',
  );

  const actions = el('div', { class: 'bar-actions' }, help, langswitch);

  if (ctx.session) {
    const who = ctx.handle ? `@${ctx.handle}` : 'signed in';
    actions.append(
      el('button', { class: 'btn small', title: who, onClick: () => void ctx.signOut() }, t(ctx.lang).signOut),
    );
  } else if (opts.showSignIn) {
    // Always-visible shortcut to the inline sign-in bar — on mobile the bar sits
    // below the keyboard and is easy to miss (issue #2).
    actions.append(
      el('button', { class: 'btn small', type: 'button', onClick: focusSignInBar }, t(ctx.lang).signIn),
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
