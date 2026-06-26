import { WORD_LENGTH, puzzleNumberFor } from '../config.js';
import { t } from '../i18n.js';
import { isAllowedGuess, accentedForm } from '../engine/words.js';
import { buildShareText } from '../engine/share.js';
import { statsForLang, type StatsRecord } from '../engine/stats.js';
import {
  loadGame,
  applyGuess,
  isFinished,
  toGameResult,
} from '../state/game.js';
import { recordCompletedGame, sharePost } from '../atproto/records.js';
import { el, mount, isEditableTarget } from './dom.js';
import { toast } from './toast.js';
import { renderHeader, navTo } from './header.js';
import { renderFooter } from './footer.js';
import { renderBoard, REVEAL_DURATION_MS } from './board.js';
import { renderLegend } from './legend.js';
import { maybeShowFirstVisitHelp } from './help.js';
import { openShareDialog } from './shareDialog.js';
import { renderKeyboard } from './keyboard.js';
import { renderDistribution, renderShareGrid, renderCountdown, stopCountdown } from './widgets.js';
import type { Ctx } from './context.js';

// Cache the latest stats per (lang) for display after recording.
const statsCache = new Map<string, StatsRecord>();

/** True when the user asked the OS to minimise motion (animations are near-instant). */
const reducedMotion = (): boolean =>
  globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
let detachKeydown: (() => void) | null = null;

export function renderPlayView(ctx: Ctx, root: HTMLElement): void {
  stopCountdown();
  if (detachKeydown) detachKeydown();

  const puzzleNumber = puzzleNumberFor();
  let state = loadGame(ctx.lang, puzzleNumber);
  let pending = '';
  let animateRow = -1; // row to flip-animate on the next renderContent (one-shot)
  let busy = false;
  let recordTried = false;

  const shell = el('div', { class: 'shell' });
  const main = el('main', {});
  mount(root, shell);

  function rerenderApp(): void {
    mount(shell, renderHeader(ctx), main, renderFooter(ctx, puzzleNumber));
  }

  function shakeActiveRow(): void {
    const rows = main.querySelectorAll('.board-row');
    const node = rows[state.guesses.length] as HTMLElement | undefined;
    if (node) {
      node.classList.add('row-shake');
      setTimeout(() => node.classList.remove('row-shake'), 400);
    }
  }

  // `settleMs` holds the re-render back until the reveal animation has finished,
  // so saving the game doesn't snap the still-flipping final row to its colours.
  async function maybeRecord(settleMs = 0): Promise<void> {
    if (recordTried) return;
    recordTried = true;
    const result = toGameResult(state);
    if (!ctx.session) {
      ctx.pendingRecord = result; // record after sign-in
      return;
    }
    const settle = settleMs > 0 ? new Promise((r) => setTimeout(r, settleMs)) : Promise.resolve();
    try {
      const stats = await recordCompletedGame(ctx.session, result);
      statsCache.set(ctx.lang, stats);
      await settle; // let the reveal play out before rebuilding the board
      toast(t(ctx.lang).savedToPds);
    } catch {
      await settle;
      toast(t(ctx.lang).constellationDown);
    }
    renderContent();
  }

  function submit(): void {
    if (busy || isFinished(state)) return;
    if (pending.length < WORD_LENGTH) {
      toast(t(ctx.lang).notEnough);
      shakeActiveRow();
      return;
    }
    if (!isAllowedGuess(ctx.lang, pending)) {
      toast(t(ctx.lang).notInList);
      shakeActiveRow();
      return;
    }
    state = applyGuess(state, pending);
    pending = '';
    animateRow = state.guesses.length - 1; // flip only the row we just submitted
    renderContent();
    // The just-submitted row is mid-reveal; hold the post-save re-render until
    // it finishes (skipped when the user prefers reduced motion).
    if (isFinished(state)) void maybeRecord(reducedMotion() ? 0 : REVEAL_DURATION_MS);
  }

  function typeLetter(ch: string): void {
    if (isFinished(state) || busy) return;
    if (pending.length < WORD_LENGTH && /^[A-Za-z]$/.test(ch)) {
      pending += ch.toUpperCase();
      renderBoardOnly();
    }
  }

  function backspace(): void {
    if (isFinished(state) || busy) return;
    pending = pending.slice(0, -1);
    renderBoardOnly();
  }

  // Re-render only the board (cheap, on each keystroke).
  function renderBoardOnly(): void {
    const old = main.querySelector('.board');
    if (old) old.replaceWith(renderBoard(state, pending));
  }

  function doShare(): void {
    const session = ctx.session;
    if (!session) return;
    openShareDialog(ctx.lang, toGameResult(state), async (note) => {
      try {
        await sharePost(session, toGameResult(state), note);
        toast(t(ctx.lang).shared);
      } catch (e) {
        toast(t(ctx.lang).constellationDown);
        throw e; // keep the dialog open so the user keeps their text
      }
    });
  }

  async function copyGrid(): Promise<void> {
    try {
      await navigator.clipboard.writeText(buildShareText(toGameResult(state)));
      toast(t(ctx.lang).copied);
    } catch {
      /* clipboard blocked — ignore */
    }
  }

  function resultsPanel(): HTMLElement {
    const s = t(ctx.lang);
    const result = toGameResult(state);
    const card = el('div', { class: 'card center' });

    card.append(el('h2', {}, state.status === 'won' ? s.won : s.lost));
    if (state.status === 'lost') {
      const accent = accentedForm(ctx.lang, state.answer);
      card.append(
        el(
          'p',
          { class: 'muted' },
          `${s.theWordWas} `,
          el('b', {}, accent ? `${state.answer} (${accent})` : state.answer),
        ),
      );
    }

    card.append(renderShareGrid(result.rows));

    const actions = el('div', { class: 'result-actions', style: 'justify-content:center' });
    if (ctx.session) {
      actions.append(
        el(
          'button',
          { class: 'btn primary', onClick: () => doShare() },
          s.shareToAtproto,
        ),
      );
    }
    actions.append(
      el('button', { class: 'btn', onClick: () => void copyGrid() }, s.copyResult),
      el(
        'a',
        { class: 'btn', href: `/p/${ctx.lang}/${puzzleNumber}`, onClick: navTo(ctx, `/p/${ctx.lang}/${puzzleNumber}`) },
        s.todaysResults,
      ),
    );
    card.append(actions);

    if (!ctx.session) {
      card.append(signInBar(ctx, s.signInToSave));
    }

    card.append(renderCountdown(ctx.lang));

    // Your stats (only when we have a stats record from this session).
    const stats = statsCache.get(ctx.lang);
    const ls = statsForLang(stats ?? null, ctx.lang);
    if (ls) {
      const statsCard = el('div', { class: 'card' });
      statsCard.append(el('h3', {}, s.statsTitle));
      const winPct = ls.gamesPlayed ? Math.round((ls.gamesWon / ls.gamesPlayed) * 100) : 0;
      statsCard.append(
        el(
          'div',
          { class: 'stats' },
          stat(String(ls.gamesPlayed), s.played),
          stat(`${winPct}`, s.winPct),
          stat(String(ls.currentStreak), s.curStreak),
          stat(String(ls.maxStreak), s.maxStreak),
        ),
      );
      statsCard.append(el('h3', { style: 'margin-top:14px' }, s.guessDist));
      statsCard.append(
        renderDistribution(ls.guessDistribution, state.status === 'won' ? state.guesses.length : undefined),
      );
      const after = el('div', {});
      after.append(card, statsCard);
      return after;
    }
    return card;
  }

  function renderContent(): void {
    const children: Array<Node> = [renderBoard(state, pending, animateRow)];
    animateRow = -1; // one-shot: consumed by this render only
    if (isFinished(state)) {
      children.push(resultsPanel());
    } else {
      // A compact colour/symbol key under the board, so the tiles are readable
      // without opening the help modal.
      children.push(renderLegend(ctx.lang));
      if (!ctx.session) {
        children.push(signInBar(ctx, t(ctx.lang).signInPrompt));
      }
      // Hide the on-screen keyboard once the game is over — there's nothing left to type.
      children.push(
        renderKeyboard(state, ctx.lang, { onLetter: typeLetter, onEnter: submit, onBackspace: backspace }),
      );
    }
    mount(main, ...children);
  }

  // Physical keyboard.
  const onKey = (e: KeyboardEvent): void => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (isEditableTarget(e.target)) return; // don't echo sign-in typing into the board
    if (e.key === 'Enter') submit();
    else if (e.key === 'Backspace') backspace();
    else if (/^[a-zA-Z]$/.test(e.key)) typeLetter(e.key);
  };
  document.addEventListener('keydown', onKey);
  detachKeydown = () => document.removeEventListener('keydown', onKey);

  rerenderApp();
  renderContent();

  // First-time visitors get the "How to play" modal once (guarded by localStorage).
  maybeShowFirstVisitHelp(ctx.lang);

  // If we arrived already-finished with a session, record once.
  if (isFinished(state) && ctx.session && !recordTried) void maybeRecord();

  // Expose state so main can record a pending game after sign-in.
  ctx.pendingRecord = isFinished(state) && !ctx.session ? toGameResult(state) : null;
}

function stat(n: string, label: string): HTMLElement {
  return el('div', { class: 'stat' }, el('div', { class: 'n' }, n), el('div', { class: 'l' }, label));
}

/** Inline sign-in form. */
export function signInBar(ctx: Ctx, prompt: string): HTMLElement {
  const s = t(ctx.lang);
  const input = el('input', {
    type: 'text',
    name: 'handle',
    id: 'atmot-handle',
    placeholder: s.signInPlaceholder,
    ariaLabel: s.signIn,
    autocapitalize: 'none',
    autocorrect: 'off',
    spellcheck: 'false',
  }) as HTMLInputElement;

  const go = async (): Promise<void> => {
    const id = input.value.trim();
    if (!id) return;
    toast(s.signingIn);
    try {
      await ctx.signInWith(id);
    } catch {
      toast(t(ctx.lang).constellationDown);
    }
  };
  input.addEventListener('keydown', (e) => {
    if ((e as KeyboardEvent).key === 'Enter') void go();
  });

  return el(
    'div',
    { class: 'card', style: 'margin-top:14px;text-align:left' },
    el('p', { class: 'muted', style: 'margin-bottom:10px' }, prompt),
    el(
      'div',
      { class: 'signin' },
      input,
      el('button', { class: 'btn primary', onClick: () => void go() }, s.signInCta),
    ),
  );
}
