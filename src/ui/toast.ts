import { el } from './dom.js';

let wrap: HTMLElement | null = null;

function ensureWrap(): HTMLElement {
  if (!wrap) {
    wrap = el('div', { class: 'toast-wrap', ariaLive: 'polite', role: 'status' });
    document.body.append(wrap);
  }
  return wrap;
}

/** Transient message. Plain text only (no HTML) — safe for user-derived strings. */
export function toast(message: string, ms = 1600): void {
  const w = ensureWrap();
  const node = el('div', { class: 'toast' }, message);
  w.append(node);
  setTimeout(() => node.remove(), ms);
}
