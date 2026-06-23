import { MAX_GUESSES, type Lang } from '../config.js';
import { t } from '../i18n.js';
import type { GuessBucket } from '../engine/stats.js';
import type { TileState } from '../engine/types.js';
import { emojiGrid } from '../engine/share.js';
import { el } from './dom.js';

/** Horizontal guess-distribution bars (1..6), optionally highlighting one row. */
export function renderDistribution(
  buckets: GuessBucket[],
  highlight?: number,
): HTMLElement {
  const byGuess = new Map(buckets.map((b) => [b.guesses, b.count]));
  const max = Math.max(1, ...buckets.map((b) => b.count));
  const wrap = el('div', { class: 'dist' });
  for (let g = 1; g <= MAX_GUESSES; g++) {
    const count = byGuess.get(g) ?? 0;
    const bar = el('div', { class: 'dist-bar' }, String(count));
    bar.style.width = `${Math.max(8, (count / max) * 100)}%`;
    if (g === highlight) bar.style.background = 'var(--tile-present)';
    wrap.append(el('div', { class: 'dist-row' }, el('span', {}, String(g)), bar));
  }
  return wrap;
}

/** The standard Unicode emoji grid as a text block (matches the shared post). */
export function renderShareGrid(rows: TileState[][]): HTMLElement {
  return el('div', { class: 'share-grid mono' }, emojiGrid(rows));
}

let countdownTimer: number | undefined;

/** A live "next puzzle in HH:MM:SS" element counting down to UTC midnight. */
export function renderCountdown(lang: Lang): HTMLElement {
  const node = el('div', { class: 'countdown' });
  const update = (): void => {
    const now = Date.now();
    const nextMidnight = Math.ceil(now / 86_400_000) * 86_400_000;
    let s = Math.max(0, Math.floor((nextMidnight - now) / 1000));
    const hh = String(Math.floor(s / 3600)).padStart(2, '0');
    s %= 3600;
    const mm = String(Math.floor(s / 60)).padStart(2, '0');
    const ss = String(s % 60).padStart(2, '0');
    node.textContent = `${t(lang).nextPuzzle} ${hh}:${mm}:${ss}`;
  };
  update();
  if (countdownTimer) clearInterval(countdownTimer);
  countdownTimer = window.setInterval(update, 1000);
  return node;
}

/** Stop the global countdown timer (called when navigating away). */
export function stopCountdown(): void {
  if (countdownTimer) {
    clearInterval(countdownTimer);
    countdownTimer = undefined;
  }
}
