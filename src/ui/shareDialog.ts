import { puzzleTarget, type Lang } from '../config.js';
import { t } from '../i18n.js';
import {
  emojiGrid,
  defaultShareNote,
  assembleShareText,
  countGraphemes,
  POST_MAX_GRAPHEMES,
} from '../engine/share.js';
import type { GameResult } from '../engine/types.js';
import { el } from './dom.js';

/** Publish the post with the user's edited note. Rejects to keep the dialog open. */
export type ShareSubmit = (note: string) => Promise<void>;

/** Build (but don't open) the share-edit dialog. */
function buildShareDialog(lang: Lang, result: GameResult, onSubmit: ShareSubmit): HTMLDialogElement {
  const s = t(lang);
  const dialog = el('dialog', { class: 'share-edit', ariaLabel: s.shareEditTitle });

  const close = el(
    'button',
    { class: 'help-close', type: 'button', ariaLabel: s.helpClose, onClick: () => dialog.close() },
    '×',
  );

  const textarea = el('textarea', {
    class: 'share-note',
    id: 'share-note-input',
    rows: '3',
  }) as HTMLTextAreaElement;
  textarea.value = defaultShareNote(result);

  const preview = el(
    'pre',
    { class: 'share-locked' },
    `${emojiGrid(result.rows)}\n\n${puzzleTarget(result.lang as Lang, result.puzzleNumber)}`,
  );

  const counter = el('span', { class: 'share-counter' });
  const post = el('button', { class: 'btn primary', type: 'button' }, s.postShare) as HTMLButtonElement;
  const cancel = el('button', { class: 'btn', type: 'button', onClick: () => dialog.close() }, s.cancel);

  let busy = false;

  function refresh(): void {
    const total = countGraphemes(assembleShareText(result, textarea.value));
    counter.textContent = `${total}/${POST_MAX_GRAPHEMES}`;
    const over = total > POST_MAX_GRAPHEMES;
    counter.classList.toggle('over', over);
    post.disabled = busy || over;
  }

  textarea.addEventListener('input', refresh);

  post.addEventListener('click', () => {
    if (busy || post.disabled) return;
    busy = true;
    post.textContent = s.sharing;
    refresh();
    void onSubmit(textarea.value)
      .then(() => dialog.close())
      .catch(() => {
        busy = false;
        post.textContent = s.postShare;
        refresh();
      });
  });

  dialog.append(
    el('div', { class: 'help-head' }, el('h2', {}, s.shareEditTitle), close),
    el('label', { class: 'share-label', for: 'share-note-input' }, s.shareMessageLabel),
    textarea,
    el('p', { class: 'share-locked-note' }, s.shareLockedNote),
    preview,
    el(
      'div',
      { class: 'share-foot' },
      counter,
      el('div', { class: 'share-actions' }, cancel, post),
    ),
  );

  // Backdrop click dismisses; tidy up the DOM once closed.
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) dialog.close();
  });
  dialog.addEventListener('close', () => dialog.remove());

  refresh();
  return dialog;
}

/** Open the share-edit modal. No-op if one is already open. */
export function openShareDialog(lang: Lang, result: GameResult, onSubmit: ShareSubmit): void {
  if (document.querySelector('dialog.share-edit[open]')) return;
  const dialog = buildShareDialog(lang, result, onSubmit);
  document.body.append(dialog);
  dialog.showModal();
}
