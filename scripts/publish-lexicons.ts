/**
 * publish-lexicons.ts — publish AT Mot's lexicon schemas as
 * `com.atproto.lexicon.schema` records under the `bzh.herve.atmot.*` authority.
 *
 * Run by the OWNER of the account that controls the namespace authority. Requires:
 *   ATMOT_PUBLISH_IDENTIFIER  handle or DID of the publishing account
 *   ATMOT_PUBLISH_PASSWORD    app password (Settings → App Passwords)
 *   ATMOT_PDS                 optional PDS override; by default the account's PDS
 *                             is resolved from its DID document (works with any
 *                             host, including self-hosted PDSs)
 *
 * For lexicon resolution to work network-wide, the authority domain also needs a
 * `_lexicon` DNS TXT record (`did=<publishing did>`) — see README. Publishing the
 * records is idempotent (putRecord with rkey = the NSID).
 *
 * Usage:  ATMOT_PUBLISH_IDENTIFIER=... ATMOT_PUBLISH_PASSWORD=... npm run lexicons:publish
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const LEX_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../lexicons');
const SCHEMA_COLLECTION = 'com.atproto.lexicon.schema';

const identifier = process.env.ATMOT_PUBLISH_IDENTIFIER;
const password = process.env.ATMOT_PUBLISH_PASSWORD;

if (!identifier || !password) {
  console.error(
    'Set ATMOT_PUBLISH_IDENTIFIER and ATMOT_PUBLISH_PASSWORD (app password) to publish.',
  );
  process.exit(1);
}

const APPVIEW = 'https://public.api.bsky.app';

/** Resolve a handle or DID to its DID. */
async function resolveDid(id: string): Promise<string> {
  if (id.startsWith('did:')) return id;
  const res = await fetch(
    `${APPVIEW}/xrpc/com.atproto.identity.resolveHandle?handle=${encodeURIComponent(id)}`,
  );
  if (!res.ok) throw new Error(`could not resolve handle ${id}`);
  return ((await res.json()) as { did: string }).did;
}

/** Resolve a DID's PDS service endpoint from its DID document. */
async function resolvePds(did: string): Promise<string> {
  const docUrl = did.startsWith('did:web:')
    ? `https://${did.slice('did:web:'.length)}/.well-known/did.json`
    : `https://plc.directory/${did}`;
  const res = await fetch(docUrl);
  if (!res.ok) throw new Error(`could not fetch DID document for ${did}`);
  const doc = (await res.json()) as {
    service?: Array<{ id: string; type: string; serviceEndpoint: string }>;
  };
  const svc = (doc.service ?? []).find(
    (s) => s.id.endsWith('#atproto_pds') || s.type === 'AtprotoPersonalDataServer',
  );
  if (!svc?.serviceEndpoint) throw new Error(`no PDS endpoint in DID document for ${did}`);
  return svc.serviceEndpoint;
}

// Resolve the account's real PDS (honour an explicit override if provided).
const did0 = await resolveDid(identifier);
const pds = process.env.ATMOT_PDS ?? (await resolvePds(did0));
console.log(`publishing to PDS ${pds}`);

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = resolve(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (name.endsWith('.json')) out.push(p);
  }
  return out;
}

async function xrpc(method: string, body: unknown, token?: string): Promise<any> {
  const res = await fetch(`${pds}/xrpc/${method}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`${method} -> ${res.status}: ${JSON.stringify(data)}`);
  return data;
}

const session = await xrpc('com.atproto.server.createSession', { identifier, password });
const did: string = session.did;
const token: string = session.accessJwt;
console.log(`authenticated as ${did}`);

for (const file of walk(LEX_DIR)) {
  const doc = JSON.parse(readFileSync(file, 'utf8'));
  const record = { ...doc, $type: SCHEMA_COLLECTION };
  await xrpc(
    'com.atproto.repo.putRecord',
    { repo: did, collection: SCHEMA_COLLECTION, rkey: doc.id, record },
    token,
  );
  console.log(`published ${doc.id}`);
}
console.log('done.');
