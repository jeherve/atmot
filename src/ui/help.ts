import type { Lang } from '../config.js';
import { t, type HowToExample } from '../i18n.js';
import { el } from './dom.js';
import { colorBlindEnabled } from './colorblind.js';

/** localStorage flag: set once the visitor has seen the first-run help modal. */
const SEEN_KEY = 'atmot:help-seen';

/** One worked example: a sample word row with a single highlighted tile. */
function exampleRow(ex: HowToExample): HTMLElement {
  const row = el('div', { class: 'board-row', role: 'row' });
  for (let i = 0; i < ex.word.length; i++) {
    const cls = i === ex.index ? `tile ${ex.state}` : 'tile';
    row.append(el('div', { class: cls, 'aria-hidden': 'true' }, ex.word[i]));
  }
  return el('div', { class: 'help-example' }, row, el('div', { class: 'caption' }, ex.caption));
}

/** Build (but don't open) the "How to play" dialog for `lang`. */
function buildHelpDialog(lang: Lang): HTMLDialogElement {
  const s = t(lang);
  const dialog = el('dialog', { class: 'help', ariaLabel: s.helpOpen });

  const close = el(
    'button',
    { class: 'help-close', type: 'button', ariaLabel: s.helpClose, onClick: () => dialog.close() },
    '×',
  );

  const list = el('ul', {});
  for (const line of s.howTo) list.append(el('li', {}, line));

  const examples = el('div', { class: 'help-examples' });
  for (const ex of s.howToExamples) examples.append(exampleRow(ex));

  dialog.append(el('div', { class: 'help-head' }, el('h2', {}, s.helpOpen), close), list, examples);

  // Point colour-blind players at the footer toggle (only when it's still off).
  if (!colorBlindEnabled()) {
    dialog.append(el('p', { class: 'help-hint' }, s.helpColorBlindHint));
  }

  // Click on the backdrop (the dialog box itself, outside any child) dismisses.
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) dialog.close();
  });
  // Tidy up the DOM once closed — by button, Escape, or backdrop.
  dialog.addEventListener('close', () => dialog.remove());
  return dialog;
}

/** Open the "How to play" modal. No-op if one is already open. */
export function openHelp(lang: Lang): void {
  if (document.querySelector('dialog.help[open]')) return;
  const dialog = buildHelpDialog(lang);
  document.body.append(dialog);
  dialog.showModal();
}

/**
 * Show the help modal once, on a visitor's first ever play view. The flag is
 * written before opening so a storage-blocked browser doesn't re-prompt every
 * load (we'd rather under-show than nag).
 */
export function maybeShowFirstVisitHelp(lang: Lang): void {
  try {
    if (localStorage.getItem(SEEN_KEY) === '1') return;
    localStorage.setItem(SEEN_KEY, '1');
  } catch {
    return; // storage unavailable — skip the auto-open entirely
  }
  openHelp(lang);
}
