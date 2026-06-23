import './ui/theme.css';
import { isLang, type Lang, parsePuzzleTarget } from './config.js';
import {
  isOAuthCallback,
  completeCallback,
  resumeSession,
  signIn,
  signOut as oauthSignOut,
  type Session,
} from './atproto/oauth.js';
import { ensureDeclaration, recordCompletedGame } from './atproto/records.js';
import { handleForDid } from './atproto/identity.js';
import type { Ctx } from './ui/context.js';
import { renderPlayView } from './ui/playView.js';
import { renderPuzzlePage } from './ui/puzzlePage.js';
import { renderAboutPage } from './ui/aboutPage.js';
import { toast } from './ui/toast.js';

const root = document.getElementById('app')!;

const LANG_KEY = 'atmot:lang';
function initialLang(): Lang {
  const saved = localStorage.getItem(LANG_KEY);
  if (saved && isLang(saved)) return saved;
  // Default to the browser's preferred language if it's one we support.
  const nav = navigator.language?.slice(0, 2).toLowerCase();
  return nav && isLang(nav) ? nav : 'en';
}

const ctx: Ctx = {
  lang: initialLang(),
  session: null,
  handle: null,
  pendingRecord: null,

  setLang(lang: Lang) {
    ctx.lang = lang;
    localStorage.setItem(LANG_KEY, lang);
    document.documentElement.lang = lang;
    render();
  },

  navigate(path: string) {
    if (path !== location.pathname) history.pushState(null, '', path);
    render();
  },

  rerender: render,

  async signInWith(identifier: string) {
    await signIn(identifier); // redirects away
  },

  async signOut() {
    await oauthSignOut(ctx.session);
    ctx.session = null;
    ctx.handle = null;
    render();
  },
};

async function adoptSession(session: Session): Promise<void> {
  ctx.session = session;
  ctx.handle = null;
  // Create the declaration record (idempotent) so the account is discoverable.
  void ensureDeclaration(session).catch(() => {});
  // Resolve handle for the UI (best-effort).
  handleForDid(session.did).then((h) => {
    ctx.handle = h.startsWith('did:') ? null : h;
    render();
  });
  // If a game finished before sign-in, record it now.
  if (ctx.pendingRecord) {
    const pending = ctx.pendingRecord;
    ctx.pendingRecord = null;
    try {
      await recordCompletedGame(session, pending);
    } catch {
      /* will be retried on next finish; non-fatal */
    }
  }
}

function render(): void {
  document.documentElement.lang = ctx.lang;
  const path = location.pathname;

  const puzzle = parsePuzzleTarget(path);
  if (puzzle) {
    renderPuzzlePage(ctx, root, puzzle.lang, puzzle.puzzleNumber);
  } else if (path === '/about') {
    renderAboutPage(ctx, root);
  } else {
    renderPlayView(ctx, root);
  }
  root.removeAttribute('aria-busy');
}

// Intercept browser back/forward.
window.addEventListener('popstate', render);

async function boot(): Promise<void> {
  try {
    if (isOAuthCallback()) {
      const session = await completeCallback();
      await adoptSession(session);
    } else {
      const session = await resumeSession();
      if (session) await adoptSession(session);
    }
  } catch {
    toast('Sign-in failed');
  }
  render();
}

void boot();
