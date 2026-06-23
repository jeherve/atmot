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

describe('manifest', () => {
  const manifest = JSON.parse(readFileSync(p('public/manifest.webmanifest'), 'utf8'));

  it('has the required installability fields', () => {
    expect(manifest.name).toBe('AT Mot — a daily word game on atproto');
    expect(manifest.short_name).toBe('AT Mot');
    expect(manifest.start_url).toBe('/');
    expect(manifest.display).toBe('standalone');
    expect(manifest.background_color).toBe('#0e1116');
  });

  it('declares 192 and 512 PNG icons that exist on disk', () => {
    const sizes = manifest.icons.map((i: { sizes: string }) => i.sizes);
    expect(sizes).toContain('192x192');
    expect(sizes).toContain('512x512');
    for (const icon of manifest.icons as Array<{ src: string; type: string }>) {
      expect(icon.type).toBe('image/png');
      expect(existsSync(p('public' + icon.src)), `${icon.src} missing`).toBe(true);
    }
  });
});

describe('index.html PWA wiring', () => {
  const html = readFileSync(p('index.html'), 'utf8');

  it('links the manifest and apple-touch-icon', () => {
    expect(html).toContain('rel="manifest"');
    expect(html).toContain('href="/manifest.webmanifest"');
    expect(html).toContain('rel="apple-touch-icon"');
    expect(html).toContain('href="/apple-touch-icon.png"');
  });

  it('declares mobile-web-app capability and iOS app title', () => {
    expect(html).toContain('name="mobile-web-app-capable"');
    expect(html).toContain('name="apple-mobile-web-app-title"');
  });
});
