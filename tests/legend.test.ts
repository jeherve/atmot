// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { renderLegend } from '../src/ui/legend.js';

describe('renderLegend', () => {
  it('shows a tile + label for each of the three states', () => {
    const legend = renderLegend('en');
    expect(legend.querySelectorAll('.legend-item')).toHaveLength(3);
    expect(legend.querySelector('.tile.correct')).not.toBeNull();
    expect(legend.querySelector('.tile.present')).not.toBeNull();
    expect(legend.querySelector('.tile.absent')).not.toBeNull();
    expect(legend.textContent).toContain('Right spot');
    expect(legend.textContent).toContain('Wrong spot');
    expect(legend.textContent).toContain('Not in word');
  });

  it('uses the French labels in fr', () => {
    const legend = renderLegend('fr');
    expect(legend.textContent).toContain('Bien placée');
    expect(legend.textContent).toContain('Mal placée');
    expect(legend.textContent).toContain('Absente');
  });

  it('marks the decorative sample tiles aria-hidden', () => {
    const legend = renderLegend('en');
    legend.querySelectorAll('.tile').forEach((tile) => {
      expect(tile.getAttribute('aria-hidden')).toBe('true');
    });
  });
});
