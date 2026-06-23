import { COLLECTION, NSID_AUTHORITY, ORIGIN } from '../config.js';
import { el, mount } from './dom.js';
import { renderHeader, navTo } from './header.js';
import { renderFooter } from './footer.js';
import { stopCountdown } from './widgets.js';
import type { Ctx } from './context.js';

const COPY = {
  en: {
    title: 'About AT Mot',
    intro:
      'AT Mot is a bilingual (English / French) daily 5-letter word game built natively on the AT Protocol — the open network behind Bluesky. It is a static client-side app with no application database and no bespoke backend.',
    sections: [
      ['Your data is yours', 'When you finish a puzzle, the result is written as a record to your own Personal Data Server (PDS) using your atproto OAuth session. We never store your games on a server — there is no server. Delete your records and they are gone.'],
      ['The leaderboard has no database', 'Each result record links to a canonical per-day permalink. The leaderboard is built by querying the public Constellation backlink index for records pointing at that link, then aggregating in your browser. Constellation is community-run, so the leaderboard degrades gracefully when it is busy.'],
      ['Share to atproto', 'Sharing posts a standard app.bsky.feed.post with a spoiler-free emoji grid and the puzzle permalink. That permalink is what lets the results page discover every shared post — likes, reposts and replies are read live from Constellation, never stored.'],
      ['Deterministic & fair', 'Each language is its own daily series. The day’s word is computed on every client from a bundled word list, indexed by whole UTC days since launch — so everyone worldwide gets the same word on the same calendar day, with no server in the loop.'],
      ['Open & standard', 'The lexicons are published under the authority below and follow the AT Protocol Lexicon Style Guide. The whole project is open source under MIT / Apache-2.0.'],
    ] as const,
    play: '← Play today’s puzzle',
  },
  fr: {
    title: 'À propos d’AT Mot',
    intro:
      'AT Mot est un jeu de mots quotidien bilingue (anglais / français) de 5 lettres, conçu nativement sur l’AT Protocol — le réseau ouvert derrière Bluesky. C’est une application statique côté client, sans base de données ni backend dédié.',
    sections: [
      ['Vos données vous appartiennent', 'Quand vous terminez une grille, le résultat est écrit dans votre propre PDS via votre session OAuth atproto. Rien n’est stocké sur un serveur — il n’y a pas de serveur. Supprimez vos enregistrements et ils disparaissent.'],
      ['Un classement sans base de données', 'Chaque résultat pointe vers un permalien canonique du jour. Le classement est construit en interrogeant l’index public de backlinks Constellation, puis agrégé dans votre navigateur. Constellation est communautaire : le classement se dégrade proprement en cas de charge.'],
      ['Partager sur atproto', 'Le partage publie un app.bsky.feed.post standard avec une grille d’emojis sans spoiler et le permalien de la grille. C’est ce permalien qui permet à la page de résultats de retrouver chaque partage — likes, reposts et réponses sont lus en direct depuis Constellation, jamais stockés.'],
      ['Déterministe et équitable', 'Chaque langue a sa propre série quotidienne. Le mot du jour est calculé sur chaque client à partir d’une liste embarquée, indexée par jours UTC entiers depuis le lancement — tout le monde a donc le même mot le même jour.'],
      ['Ouvert et standard', 'Les lexiques sont publiés sous l’autorité ci-dessous et suivent le guide de style des lexiques AT Protocol. Le projet entier est open source sous MIT / Apache-2.0.'],
    ] as const,
    play: '← Jouer le mot du jour',
  },
} as const;

export function renderAboutPage(ctx: Ctx, root: HTMLElement): void {
  stopCountdown();
  const c = COPY[ctx.lang];
  const shell = el('div', { class: 'shell' });
  const main = el('main', {});
  mount(root, shell);

  const card = el('div', { class: 'card' }, el('h1', {}, c.title), el('p', {}, c.intro));
  for (const [h, body] of c.sections) {
    card.append(el('h3', { style: 'margin-top:16px' }, h), el('p', { class: 'muted' }, body));
  }
  card.append(
    el(
      'p',
      { class: 'mono muted', style: 'font-size:13px;margin-top:16px;word-break:break-all' },
      `authority: ${NSID_AUTHORITY}.* · result: ${COLLECTION.result} · stats: ${COLLECTION.stats} · ${ORIGIN}`,
    ),
    el('p', { style: 'margin-top:12px' }, el('a', { href: '/', onClick: navTo(ctx, '/') }, c.play)),
  );

  mount(main, card);
  mount(shell, renderHeader(ctx), main, renderFooter(ctx));
}
