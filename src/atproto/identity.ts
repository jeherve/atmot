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

/** An unauthenticated read client pointed at a specific PDS (cached per host). */
export function pdsClient(pds: string): Client {
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
