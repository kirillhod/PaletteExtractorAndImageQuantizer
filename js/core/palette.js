// @ts-check
import { formatHex } from './color.js';
import { sha256Hex, stableStringify } from './hash.js';

/** @typedef {import('./types.js').RGB8} RGB8 */
/** @typedef {import('./types.js').Palette} Palette */

/**
 * Turn extraction colors into a palette with stable ids and export indices.
 * @param {RGB8[]} colors
 * @param {{ space?: 'oklab'|'srgb' }} [options]
 * @returns {Palette}
 */
export function createPalette(colors, options = {}) {
  return colors.map((color, index) => ({
    id: index + 1,
    index,
    color: { r: color.r, g: color.g, b: color.b, a: 255 },
    hex: formatHex(color),
    name: null,
    role: null,
    locked: false,
  }));
}

/**
 * @param {Palette} palette
 * @returns {string} one #rrggbb per line
 */
export function paletteHexList(palette) {
  return palette.map((entry) => entry.hex).join('\n');
}

/**
 * @param {Palette} palette
 * @param {{ order?: string, space?: string }} [options]
 */
export function palettePayload(palette, options = {}) {
  return {
    order: options.order ?? 'source',
    space: options.space ?? 'oklab',
    entries: palette.map((entry) => ({
      index: entry.index,
      rgb: [entry.color.r, entry.color.g, entry.color.b],
      alpha: entry.color.a,
    })),
  };
}

/**
 * @param {Palette} palette
 * @param {{ order?: string, space?: string }} [options]
 * @returns {Promise<string>} `sha256:<hex>` or `fnv1a64:<hex>`
 */
export async function paletteHash(palette, options = {}) {
  const payload = palettePayload(palette, options);
  const canonical = stableStringify(payload);
  const cryptoSubtle = globalThis.crypto?.subtle;
  const hash = await sha256Hex(canonical);
  return `${cryptoSubtle ? 'sha256' : 'fnv1a64'}:${hash}`;
}
