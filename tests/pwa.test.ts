import { describe, expect, it } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Resolve paths relative to the repo root (this file is in tests/).
const root = fileURLToPath(new URL('..', import.meta.url));
const p = (rel: string) => root + rel;

/** Read width/height from a PNG's IHDR chunk (bytes 16–24, big-endian). */
function pngSize(path: string): { width: number; height: number } {
  const buf = readFileSync(path);
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

describe('PWA icons', () => {
  const icons: Array<[string, number]> = [
    ['public/icon-192.png', 192],
    ['public/icon-512.png', 512],
    ['public/apple-touch-icon.png', 180],
  ];

  for (const [rel, size] of icons) {
    it(`${rel} exists and is ${size}x${size}`, () => {
      expect(existsSync(p(rel)), `${rel} missing`).toBe(true);
      const { width, height } = pngSize(p(rel));
      expect(width).toBe(size);
      expect(height).toBe(size);
    });
  }
});
