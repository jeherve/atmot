import type { Lang } from '../config.js';
import { t } from '../i18n.js';
import type { TileState } from '../engine/types.js';
import { el } from './dom.js';

/** The three scored states, each with a sample letter and its short label key. */
const ITEMS: { state: TileState; sample: string; key: 'legendCorrect' | 'legendPresent' | 'legendAbsent' }[] = [
  { state: 'correct', sample: 'A', key: 'legendCorrect' },
  { state: 'present', sample: 'B', key: 'legendPresent' },
  { state: 'absent', sample: 'C', key: 'legendAbsent' },
];

/**
 * Compact colour + symbol key shown under the board during play, so a new
 * player can read the tiles without having to open the help modal. The sample
 * tiles are decorative (the label carries the meaning), hence aria-hidden.
 */
export function renderLegend(lang: Lang): HTMLElement {
  const s = t(lang);
  const legend = el('div', { class: 'legend', role: 'list', ariaLabel: s.helpOpen });
  for (const item of ITEMS) {
    legend.append(
      el(
        'div',
        { class: 'legend-item', role: 'listitem' },
        el('div', { class: `tile ${item.state}`, 'aria-hidden': 'true' }, item.sample),
        el('span', {}, s[item.key]),
      ),
    );
  }
  return legend;
}
