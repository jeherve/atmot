/**
 * Colour-blind mode: an opt-in preference that adds a non-colour symbol
 * (✓ / ○ / ✕) to each scored tile and legend chip. Off by default — the tiles
 * are colour-only — so the glyphs don't clutter the board for players who
 * don't need them. The preference is stored locally and applied as a `cb-safe`
 * class on <html>, which the glyph CSS keys off.
 */
const KEY = 'atmot:cb-safe';
const CLASS = 'cb-safe';

/** Whether the player has opted into colour-blind mode. */
export function colorBlindEnabled(): boolean {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

/** Reflect the given state onto <html> so the glyph CSS applies (or doesn't). */
function applyColorBlind(enabled: boolean): void {
  document.documentElement.classList.toggle(CLASS, enabled);
}

/** Persist and apply the preference. */
export function setColorBlind(enabled: boolean): void {
  try {
    if (enabled) localStorage.setItem(KEY, '1');
    else localStorage.removeItem(KEY);
  } catch {
    /* storage unavailable — still apply for this session */
  }
  applyColorBlind(enabled);
}

/** Apply the saved preference. Call once on boot, before the first render. */
export function initColorBlind(): void {
  applyColorBlind(colorBlindEnabled());
}
