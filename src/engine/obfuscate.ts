/**
 * Light obfuscation for the daily-answer sequence.
 *
 * This is a deliberate SPEED BUMP, not encryption. AT Mot has no backend — the
 * full answer list must ship to every browser so the daily word can be computed
 * offline. Any key that decodes it at runtime also ships in the bundle, so a
 * determined reader can always recover the list. The only goal here is to stop
 * the trivial cheat: opening the shipped JSON / JS and reading tomorrow's word in
 * plain English (or grepping the repo for it). Encoded, the answer list is no
 * longer human-readable or greppable.
 *
 * Encoding: join words with "\n", XOR each byte against a fixed repeating key,
 * then base64. Symmetric and isomorphic (used by both the Node build script and
 * the browser runtime), so the two can never drift. All inputs are ASCII A–Z, so
 * btoa/atob (Latin-1) are safe.
 */

// Fixed repeating XOR key. Changing it only changes the on-disk encoding; the
// decoded words are unaffected, so history stays intact. Re-run `npm run
// build:words` after any change here so the committed JSON matches.
const XOR_KEY = [0x41, 0x54, 0x6d, 0x6f, 0x74, 0x9c, 0x3b, 0xd7, 0x1e, 0xa5, 0x62, 0xc9];

const SEPARATOR = '\n';

/** XOR a Latin-1 string against the repeating key, returning a Latin-1 string. */
function xor(input: string): string {
  let out = '';
  for (let i = 0; i < input.length; i++) {
    out += String.fromCharCode(input.charCodeAt(i) ^ XOR_KEY[i % XOR_KEY.length]!);
  }
  return out;
}

/** Encode an ordered list of (ASCII) answer words into an opaque base64 blob. */
export function encodeAnswers(words: readonly string[]): string {
  return btoa(xor(words.join(SEPARATOR)));
}

/** Decode a blob produced by {@link encodeAnswers} back to the original words. */
export function decodeAnswers(blob: string): string[] {
  return blob === '' ? [] : xor(atob(blob)).split(SEPARATOR);
}
