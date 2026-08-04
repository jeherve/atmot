// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';

// The whole point of these tests is which options `resumeSession` passes to
// atcute's `getSession`, and what it cleans up when the session turns out to be
// dead — so atcute is mocked and the calls are inspected directly.
const getSession = vi.fn();
const deleteStoredSession = vi.fn();
const createAuthorizationUrl = vi.fn(async () => 'https://pds.example/oauth/authorize?x=1');

class FakeTokenRefreshError extends Error {
  name = 'TokenRefreshError';
}

vi.mock('@atcute/oauth-browser-client', () => ({
  configureOAuth: vi.fn(),
  createAuthorizationUrl: (...args: unknown[]) => createAuthorizationUrl(...(args as [])),
  finalizeAuthorization: vi.fn(),
  getSession: (...args: unknown[]) => getSession(...(args as [])),
  deleteStoredSession: (...args: unknown[]) => deleteStoredSession(...(args as [])),
  TokenRefreshError: FakeTokenRefreshError,
  OAuthUserAgent: class {
    session: unknown;
    constructor(session: { info: { sub: string } }) {
      this.session = session;
    }
    get sub(): string {
      return (this.session as { info: { sub: string } }).info.sub;
    }
  },
}));

vi.mock('@atcute/identity-resolver', () => ({
  CompositeDidDocumentResolver: class {},
  LocalActorResolver: class {},
  PlcDidDocumentResolver: class {},
  WebDidDocumentResolver: class {},
  XrpcHandleResolver: class {},
}));

vi.mock('@atcute/client', () => ({ Client: class {} }));

const DID = 'did:plc:4i6hvdii3km3kbnj3losmwnt';
const { resumeSession, signIn } = await import('../src/atproto/oauth.js');

describe('resumeSession', () => {
  beforeEach(() => {
    localStorage.clear();
    getSession.mockReset();
    deleteStoredSession.mockReset();
    localStorage.setItem('atmot:did', DID);
  });

  // The bug this file exists for: `allowStale: true` makes atcute hand back a
  // stored session without ever attempting a refresh, so an account whose
  // refresh token had been revoked still rendered as signed in. Every write then
  // failed with an auth error for eight days without the UI ever saying so.
  it('never asks atcute for a stale session', async () => {
    getSession.mockResolvedValue({ info: { sub: DID } });

    await resumeSession();

    expect(getSession).toHaveBeenCalledTimes(1);
    const options = getSession.mock.calls[0]![1] as { allowStale?: boolean } | undefined;
    expect(options?.allowStale ?? false).toBe(false);
  });

  it('returns a session when the token is still usable', async () => {
    getSession.mockResolvedValue({ info: { sub: DID } });

    const session = await resumeSession();

    expect(session?.did).toBe(DID);
  });

  it('reports signed-out and clears local state when the refresh is refused', async () => {
    getSession.mockRejectedValue(new FakeTokenRefreshError('session was revoked'));

    const session = await resumeSession();

    expect(session).toBeNull();
    expect(localStorage.getItem('atmot:did')).toBeNull();
    expect(deleteStoredSession).toHaveBeenCalledWith(DID);
  });

  // Being offline is not the same as being signed out: throwing the stored
  // session away would force a needless re-login on the next reload.
  it('keeps the stored session when the refresh fails for a transient reason', async () => {
    getSession.mockRejectedValue(new Error('NetworkError: failed to fetch'));

    const session = await resumeSession();

    expect(session).toBeNull();
    expect(localStorage.getItem('atmot:did')).toBe(DID);
    expect(deleteStoredSession).not.toHaveBeenCalled();
  });
});

describe('signIn', () => {
  beforeEach(() => {
    createAuthorizationUrl.mockClear();
  });

  // atcute persists the PKCE/DPoP state through synchronous localStorage writes
  // before `createAuthorizationUrl` resolves, so there is nothing to wait for.
  // The old fixed 200 ms sleep was a race dressed as a safeguard.
  it('redirects without waiting on a timer', async () => {
    const assign = vi.fn();
    Object.defineProperty(globalThis, 'location', {
      value: { ...globalThis.location, assign },
      writable: true,
      configurable: true,
    });

    const timers = vi.spyOn(globalThis, 'setTimeout');
    await signIn('jeremy.herve.bzh');

    expect(assign).toHaveBeenCalledWith('https://pds.example/oauth/authorize?x=1');
    expect(timers).not.toHaveBeenCalled();
    timers.mockRestore();
  });
});
