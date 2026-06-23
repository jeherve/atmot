/**
 * Tiny cast helpers for atcute's branded nominal string types. atcute types
 * DIDs / NSIDs / handles as template-literal/branded strings for safety; at the
 * boundaries where we hold plain `string` (parsed URIs, user input, config) we
 * assert the shape we've already validated.
 */
export const asDid = (s: string): `did:${string}:${string}` => s as `did:${string}:${string}`;
export const asNsid = (s: string): `${string}.${string}.${string}` =>
  s as `${string}.${string}.${string}`;
export const asActor = (s: string): `${string}.${string}` => s as `${string}.${string}`;
