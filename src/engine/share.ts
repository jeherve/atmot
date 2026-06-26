import { MAX_GUESSES, puzzleTarget, type Lang } from '../config.js';
import type { GameResult, TileState } from './types.js';

/**
 * The shared grid uses the STANDARD Unicode squares, NOT the in-app brand palette.
 * This is a deliberate split (see DECISIONS.md / spec §9): the styled board is our
 * own identity, but the shared grid must be instantly recognizable in any feed, and
 * Unicode squares can't be recoloured anyway. These are plain Unicode emoji — no IP.
 */
const SHARE_EMOJI: Record<TileState, string> = {
  correct: '🟩',
  present: '🟨',
  absent: '⬛', // default dark; ⬜ is the light-theme alternative
};

/** Brand name shown in the share header. Never "Wordle" / never NYT. */
export const BRAND = 'AT Mot';

/** One emoji row from tile states. */
function emojiRow(states: TileState[]): string {
  return states.map((s) => SHARE_EMOJI[s]).join('');
}

/** The full spoiler-free emoji grid (one row per guess). */
export function emojiGrid(rows: TileState[][]): string {
  return rows.map(emojiRow).join('\n');
}

/** Score string like "4/6" or "X/6" on a loss. */
export function scoreLabel(result: GameResult): string {
  const tries = result.solved ? String(result.guessCount ?? result.rows.length) : 'X';
  return `${tries}/${MAX_GUESSES}`;
}

/** Header line, e.g. "AT Mot 412 (FR) 4/6". */
export function shareHeader(result: GameResult): string {
  return `${BRAND} ${result.puzzleNumber} (${result.lang.toUpperCase()}) ${scoreLabel(result)}`;
}

/** The default editable note shown in the share dialog — the header line. */
export function defaultShareNote(result: GameResult): string {
  return shareHeader(result);
}

/**
 * Assemble the full post text from an editable `note` plus the fixed grid + permalink.
 *
 * The note is the only editable region. The emoji grid is the recognisable shared
 * artifact, and the permalink is LOAD-BEARING — it's the only linkage Constellation
 * uses to discover a shared post. The permalink always stays LAST so the link facet
 * and embed are unaffected by edits. An empty / whitespace-only note drops the note
 * line entirely, leaving `grid\n\n link`.
 */
export function assembleShareText(result: GameResult, note: string): string {
  const link = puzzleTarget(result.lang as Lang, result.puzzleNumber);
  const grid = emojiGrid(result.rows);
  const trimmed = note.trim();
  return trimmed ? `${trimmed}\n\n${grid}\n\n${link}` : `${grid}\n\n${link}`;
}

/**
 * The full post text for "Share to atproto" with the default header note.
 * Used by the clipboard "Copy grid" action.
 */
export function buildShareText(result: GameResult): string {
  return assembleShareText(result, defaultShareNote(result));
}

/** A Bluesky richtext link facet (UTF-8 byte offsets). */
export interface ShareFacet {
  index: { byteStart: number; byteEnd: number };
  features: Array<{ $type: 'app.bsky.richtext.facet#link'; uri: string }>;
}

/**
 * Build the link facet for the permalink inside the post text.
 *
 * This is LOAD-BEARING: a plain-text URL is not indexed by Constellation, so the
 * permalink must be a real richtext link feature for shared posts to be
 * discoverable as backlinks. Offsets are UTF-8 byte positions per the spec.
 */
export function buildShareFacets(
  result: GameResult,
  note: string = defaultShareNote(result),
): ShareFacet[] {
  const text = assembleShareText(result, note);
  const link = puzzleTarget(result.lang as Lang, result.puzzleNumber);
  const enc = new TextEncoder();
  const byteStart = enc.encode(text.slice(0, text.lastIndexOf(link))).length;
  const byteEnd = byteStart + enc.encode(link).length;
  return [
    {
      index: { byteStart, byteEnd },
      features: [{ $type: 'app.bsky.richtext.facet#link', uri: link }],
    },
  ];
}

/** External embed card for the permalink — a second Constellation discovery path. */
export function buildShareEmbed(result: GameResult): {
  $type: 'app.bsky.embed.external';
  external: { uri: string; title: string; description: string };
} {
  const link = puzzleTarget(result.lang as Lang, result.puzzleNumber);
  return {
    $type: 'app.bsky.embed.external',
    external: {
      uri: link,
      title: `${BRAND} ${result.puzzleNumber} (${result.lang.toUpperCase()})`,
      description: 'A bilingual daily word game on the AT Protocol. Play today’s puzzle.',
    },
  };
}

/** Bluesky caps an app.bsky.feed.post at 300 graphemes. */
export const POST_MAX_GRAPHEMES = 300;

/** Count user-perceived characters (graphemes), matching Bluesky's limit metric. */
export function countGraphemes(text: string): number {
  const seg = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
  return Array.from(seg.segment(text)).length;
}
