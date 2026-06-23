import { puzzleTarget, puzzleDateString, type Lang } from '../config.js';
import { t } from '../i18n.js';
import {
  getDailyStats,
  getSharedPosts,
  formatAverage,
  type DailyStats,
  type SharedPost,
} from '../atproto/leaderboard.js';
import { el, mount } from './dom.js';
import { renderHeader, navTo } from './header.js';
import { renderFooter } from './footer.js';
import { renderDistribution, stopCountdown } from './widgets.js';
import type { Ctx } from './context.js';

export function renderPuzzlePage(
  ctx: Ctx,
  root: HTMLElement,
  lang: Lang,
  puzzleNumber: number,
): void {
  stopCountdown();
  const s = t(ctx.lang);
  const shell = el('div', { class: 'shell' });
  const main = el('main', {});
  mount(root, shell);
  mount(shell, renderHeader(ctx), main, renderFooter(ctx, puzzleNumber));

  const permalink = puzzleTarget(lang, puzzleNumber);
  const head = el(
    'div',
    { class: 'card' },
    el('h1', {}, `AT Mot #${puzzleNumber} `, el('span', { class: 'muted' }, `(${lang.toUpperCase()})`)),
    el('p', { class: 'mono muted', style: 'font-size:13px;word-break:break-all' }, puzzleDateString(puzzleNumber), ' · ', permalink),
    el('a', { href: '/', onClick: navTo(ctx, '/') }, `← ${s.backToGame}`),
  );

  const statsCard = el('div', { class: 'card' }, el('h3', {}, s.todaysResults), el('p', { class: 'muted' }, '…'));
  const postsCard = el('div', { class: 'card' }, el('h3', {}, s.sharedGrids), el('p', { class: 'muted' }, '…'));
  mount(main, head, statsCard, postsCard);

  void loadStats(ctx, statsCard, lang, puzzleNumber);
  void loadPosts(ctx, postsCard, lang, puzzleNumber);
}

async function loadStats(
  ctx: Ctx,
  card: HTMLElement,
  lang: Lang,
  puzzleNumber: number,
): Promise<void> {
  const s = t(ctx.lang);
  let stats: DailyStats;
  try {
    stats = await getDailyStats(lang, puzzleNumber);
  } catch {
    mount(card, el('h3', {}, s.todaysResults), el('p', { class: 'muted' }, s.constellationDown));
    return;
  }

  const children: Node[] = [el('h3', {}, s.todaysResults)];

  if (stats.degraded) {
    children.push(el('p', { class: 'muted' }, s.constellationDown));
    mount(card, ...children);
    return;
  }

  children.push(
    el(
      'div',
      { class: 'stats', style: 'grid-template-columns:repeat(3,1fr)' },
      numStat(String(stats.players ?? stats.entries.length), s.players),
      numStat(String(stats.solvers), s.solved),
      numStat(formatAverage(stats.averageGuesses), s.avgGuesses),
    ),
  );

  if (stats.guessDistribution.length) {
    children.push(el('h3', { style: 'margin-top:14px' }, s.guessDist), renderDistribution(stats.guessDistribution));
  }

  if (stats.entries.length) {
    const list = el('div', { class: 'posts', style: 'margin-top:14px' });
    for (const e of stats.entries.slice(0, 50)) {
      list.append(
        el(
          'div',
          { class: 'post' },
          el('div', { class: 'who' }, `@${e.handle}`),
          el(
            'div',
            { class: 'meta' },
            el('span', {}, e.solved ? `${e.guessCount ?? '?'} / 6` : `X / 6`),
          ),
        ),
      );
    }
    if (stats.sampled) list.append(el('p', { class: 'muted', style: 'font-size:12px' }, `(sampled)`));
    children.push(list);
  } else {
    children.push(el('p', { class: 'muted' }, s.leaderboardEmpty));
  }

  mount(card, ...children);
}

async function loadPosts(
  ctx: Ctx,
  card: HTMLElement,
  lang: Lang,
  puzzleNumber: number,
): Promise<void> {
  const s = t(ctx.lang);
  let posts: SharedPost[];
  try {
    posts = await getSharedPosts(lang, puzzleNumber);
  } catch {
    mount(card, el('h3', {}, s.sharedGrids), el('p', { class: 'muted' }, s.constellationDown));
    return;
  }

  const children: Node[] = [el('h3', {}, s.sharedGrids)];
  if (!posts.length) {
    children.push(el('p', { class: 'muted' }, s.noSharedYet));
    mount(card, ...children);
    return;
  }

  const list = el('div', { class: 'posts' });
  for (const p of posts) {
    const webUrl = `https://bsky.app/profile/${p.did}/post/${p.uri.split('/').pop()}`;
    const post = el('div', { class: 'post' }, el('div', { class: 'who' }, `@${p.handle}`));
    if (p.text) {
      // Show only the emoji grid lines (strip header + link) — text node, no HTML.
      const gridLines = p.text
        .split('\n')
        .filter((l) => /[🟩🟨⬛⬜]/u.test(l))
        .join('\n');
      if (gridLines) post.append(el('div', { class: 'grid' }, gridLines));
    }
    post.append(
      el(
        'div',
        { class: 'meta' },
        el('span', {}, `♥ ${p.engagement.likes ?? '–'}`),
        el('span', {}, `⇄ ${p.engagement.reposts ?? '–'}`),
        el('span', {}, `💬 ${p.engagement.replies ?? '–'}`),
        el('a', { href: webUrl, target: '_blank', rel: 'noopener' }, 'open ↗'),
      ),
    );
    list.append(post);
  }
  children.push(list);
  mount(card, ...children);
}

function numStat(n: string, label: string): HTMLElement {
  return el('div', { class: 'stat' }, el('div', { class: 'n' }, n), el('div', { class: 'l' }, label));
}
