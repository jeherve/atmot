/**
 * Identity resolution (handle <-> DID <-> PDS) and per-PDS read clients.
 *
 * Used by the read side: Constellation gives us DIDs / AT-URIs, and we resolve
 * each actor to its PDS to fetch the underlying record. Everything is cached in
 * memory for the page session and degrades gracefully (resolution failures just
 * drop that entry from the leaderboard rather than crashing it).
 */
import {
  CompositeDidDocumentResolver,
  LocalActorResolver,
  PlcDidDocumentResolver,
  WebDidDocumentResolver,
  XrpcHandleResolver,
  type ResolvedActor,
} from '@atcute/identity-resolver';
import { Client, simpleFetchHandler } from '@atcute/client';
import { APPVIEW_URL } from '../config.js';

const actorResolver = new LocalActorResolver({
  handleResolver: new XrpcHandleResolver({ serviceUrl: APPVIEW_URL }),
  didDocumentResolver: new CompositeDidDocumentResolver({
    methods: {
      plc: new PlcDidDocumentResolver(),
      web: new WebDidDocumentResolver(),
    },
  }),
});

const actorCache = new Map<string, Promise<ResolvedActor>>();
const pdsClients = new Map<string, Client>();

/** Resolve a handle or DID to { did, handle, pds }. Cached; may reject. */
export function resolveActor(identifier: string): Promise<ResolvedActor> {
  const key = identifier.trim().toLowerCase();
  let p = actorCache.get(key);
  if (!p) {
    p = actorResolver.resolve(identifier as Parameters<typeof actorResolver.resolve>[0]);
    actorCache.set(key, p);
  }
  return p;
}

/**
 * Whether a resolved PDS endpoint is an acceptable public AT Protocol host.
 *
 * The endpoint originates from an attacker-controllable DID document, and
 * rendering a leaderboard fans browser fetches out to it (F1 / CWE-918). We
 * therefore fail closed: only plain HTTPS on the default port, addressed by a
 * public DNS hostname, is allowed. Bare IP literals and private / loopback /
 * link-local / .local names — the useful request-forgery targets — are
 * rejected, as is any embedded credential.
 */
export function isPublicPdsEndpoint(endpoint: string): boolean {
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return false;
  }
  // HTTPS only (also blocks the http:// internal-IP targets mixed-content spares).
  if (url.protocol !== 'https:') return false;
  // Default port only. WHATWG strips an explicit :443, so any leftover port is non-standard.
  if (url.port !== '') return false;
  // A base URL must not smuggle credentials past the host check above.
  if (url.username !== '' || url.password !== '') return false;

  const host = url.hostname.toLowerCase();
  // IPv6 literals arrive bracketed; reject them (no public PDS is addressed by one).
  if (host.startsWith('[') || host.includes(':')) return false;
  // Reject bare IPv4 (all-numeric) literals — this closes loopback / private /
  // link-local address space in one shot, and real PDS hosts are named anyway.
  if (/^\d+(\.\d+)*$/.test(host)) return false;
  // Require a dotted public name; single-label / mDNS / .local hosts are internal.
  if (!host.includes('.')) return false;
  if (host.endsWith('.localhost') || host.endsWith('.local')) return false;

  return true;
}

/**
 * An unauthenticated read client pointed at a specific PDS (cached per host).
 * Throws for any endpoint that is not an acceptable public PDS (see
 * {@link isPublicPdsEndpoint}); callers of the read path already drop the entry
 * on any failure, so a hostile DID document simply falls out of the leaderboard.
 */
export function pdsClient(pds: string): Client {
  if (!isPublicPdsEndpoint(pds)) {
    throw new Error(`refusing to build a PDS client for a non-public endpoint: ${pds}`);
  }
  let c = pdsClients.get(pds);
  if (!c) {
    c = new Client({ handler: simpleFetchHandler({ service: pds }) });
    pdsClients.set(pds, c);
  }
  return c;
}

/** Best-effort handle for a DID; falls back to the DID on failure. */
export async function handleForDid(did: string): Promise<string> {
  try {
    const a = await resolveActor(did);
    return a.handle && a.handle !== 'handle.invalid' ? a.handle : did;
  } catch {
    return did;
  }
}
