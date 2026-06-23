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
  // Give the browser a tick to persist the PKCE/DPoP state to storage.
  await new Promise((r) => setTimeout(r, 200));
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
 * Resume a previously stored session on page load. Returns null if there's no
 * stored DID or the session can't be restored (e.g. expired without refresh).
 */
export async function resumeSession(): Promise<Session | null> {
  ensureConfigured();
  const did = localStorage.getItem(STORAGE_DID);
  if (!did) return null;
  try {
    const session = await getSession(did as Did, { allowStale: true });
    const agent = new OAuthUserAgent(session);
    return sessionFrom(agent.sub, agent);
  } catch {
    localStorage.removeItem(STORAGE_DID);
    return null;
  }
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
    deleteStoredSession(did as `did:${string}:${string}`);
  }
}
