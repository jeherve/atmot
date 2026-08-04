/**
 * Browser OAuth via atcute. Fully client-side: there is no server-side session
 * store. atcute persists the OAuth session internally; we only remember which DID
 * is "ours" so we can resume it on reload.
 */
import {
  configureOAuth,
  createAuthorizationUrl,
  finalizeAuthorization,
  getSession,
  deleteStoredSession,
  OAuthUserAgent,
  TokenRefreshError,
} from '@atcute/oauth-browser-client';
import {
  CompositeDidDocumentResolver,
  LocalActorResolver,
  PlcDidDocumentResolver,
  WebDidDocumentResolver,
  XrpcHandleResolver,
} from '@atcute/identity-resolver';
import { Client } from '@atcute/client';
import type { ActorIdentifier, Did } from '@atcute/lexicons';
import { APPVIEW_URL } from '../config.js';

const STORAGE_DID = 'atmot:did';

export interface Session {
  did: string;
  agent: OAuthUserAgent;
  rpc: Client;
}

let configured = false;

function ensureConfigured(): void {
  if (configured) return;
  configureOAuth({
    metadata: {
      client_id: import.meta.env.VITE_OAUTH_CLIENT_ID,
      redirect_uri: import.meta.env.VITE_OAUTH_REDIRECT_URI,
    },
    identityResolver: new LocalActorResolver({
      // Web apps lack DNS access, so handle resolution goes through the AppView.
      handleResolver: new XrpcHandleResolver({ serviceUrl: APPVIEW_URL }),
      didDocumentResolver: new CompositeDidDocumentResolver({
        methods: {
          plc: new PlcDidDocumentResolver(),
          web: new WebDidDocumentResolver(),
        },
      }),
    }),
  });
  configured = true;
}

function sessionFrom(did: string, agent: OAuthUserAgent): Session {
  return { did, agent, rpc: new Client({ handler: agent }) };
}

/** True if the current URL looks like an OAuth callback (params in the hash). */
export function isOAuthCallback(): boolean {
  if (!location.hash) return false;
  const params = new URLSearchParams(location.hash.slice(1));
  return params.has('state') && (params.has('code') || params.has('error'));
}

/**
 * Start the OAuth flow for a handle or DID. Redirects the browser away.
 */
export async function signIn(identifier: string): Promise<void> {
  ensureConfigured();
  const authUrl = await createAuthorizationUrl({
    target: {
      type: 'account',
      identifier: identifier.trim().replace(/^@/, '') as ActorIdentifier,
    },
    scope: import.meta.env.VITE_OAUTH_SCOPE,
  });
  // No sleep before the redirect: atcute writes the PKCE/DPoP state through
  // synchronous localStorage calls that have already completed by the time
  // createAuthorizationUrl resolves. The fixed 200 ms delay this replaces was a
  // race dressed as a safeguard — it could not guarantee anything, and it
  // stalled every sign-in.
  location.assign(authUrl);
}

/**
 * Finalize an OAuth callback. Returns the new Session, or throws on error.
 * Scrubs the OAuth params from the URL afterward.
 */
export async function completeCallback(): Promise<Session> {
  ensureConfigured();
  const params = new URLSearchParams(location.hash.slice(1));
  history.replaceState(null, '', location.pathname + location.search);
  const { session } = await finalizeAuthorization(params);
  const agent = new OAuthUserAgent(session);
  localStorage.setItem(STORAGE_DID, agent.sub);
  return sessionFrom(agent.sub, agent);
}

/**
 * Resume a previously stored session on page load. Returns null when there's no
 * stored DID, or when the stored session can't be made usable.
 *
 * Deliberately does NOT pass `allowStale`. That option makes atcute hand back
 * the stored session without ever attempting a refresh, so an account whose
 * refresh token had been revoked still resolved to a Session and the player was
 * rendered as signed in while holding a dead token. Every write then failed
 * with an auth error and nothing in the UI ever said "you are signed out".
 * Without the option atcute refreshes an expired access token and throws when
 * the refresh is refused, which is exactly the signal this function needs.
 */
export async function resumeSession(): Promise<Session | null> {
  ensureConfigured();
  const did = localStorage.getItem(STORAGE_DID);
  if (!did) return null;
  try {
    const session = await getSession(did as Did);
    const agent = new OAuthUserAgent(session);
    return sessionFrom(agent.sub, agent);
  } catch (err) {
    // A revoked session must not linger, or it gets retried on every load. A
    // transient failure (offline, PDS down) is not a sign-out, so the stored
    // session is left alone and a later reload can still resume it.
    if (err instanceof TokenRefreshError) forgetSession(did);
    return null;
  }
}

/** Drop every trace of a session we know is dead. */
function forgetSession(did: string): void {
  localStorage.removeItem(STORAGE_DID);
  deleteStoredSession(did as `did:${string}:${string}`);
}

/** Sign out: revoke the session if possible, then clear local state. */
export async function signOut(session: Session | null): Promise<void> {
  const did = session?.did ?? localStorage.getItem(STORAGE_DID);
  localStorage.removeItem(STORAGE_DID);
  if (!did) return;
  try {
    if (session) {
      await session.agent.signOut();
    } else {
      const s = await getSession(did as Did, { allowStale: true });
      await new OAuthUserAgent(s).signOut();
    }
  } catch {
    // Revocation is best-effort; the local session goes either way.
    forgetSession(did);
  }
}
