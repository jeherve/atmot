import type { Lang } from '../config.js';
import type { Session } from '../atproto/oauth.js';

/** Shared app context handed to every view. */
export interface Ctx {
  lang: Lang;
  session: Session | null;
  /** Resolved handle of the signed-in account, if known. */
  handle: string | null;
  /** A finished game awaiting a record write once the user signs in. */
  pendingRecord: import('../engine/types.js').GameResult | null;

  setLang(lang: Lang): void;
  navigate(path: string): void;
  rerender(): void;
  signInWith(identifier: string): Promise<void>;
  signOut(): Promise<void>;
}
