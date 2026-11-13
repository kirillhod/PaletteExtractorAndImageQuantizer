// @ts-check
import { formatHex, rgb8ToOklab } from './color.js';
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
    color: { r: color.r, g: color.g, b: color.b, a: color.a ?? 255 },
    hex: formatHex(color),
    name: null,
    role: null,
    locked: false,
  }));
}

/**
 * Return a new palette in the requested order. IDs survive; indices are reassigned.
 * `source` uses the stable id, so switching back restores extraction order.
 *
 * Orders:
 * - `source`
 * - `hue-asc` / `hue-desc` — achromatic first, then hue groups in a circular order,
 *   with lightness ascending/descending inside each group.
 * - `lightness-asc` / `lightness-desc`
 *
 * @param {Palette} palette
 * @param {'source'|'hue-asc'|'hue-desc'|'lightness-asc'|'lightness-desc'} order
 * @returns {Palette}
 */
export function sortPalette(palette, order = 'source') {
  if (order === 'source' || !palette.length) {
    return palette
      .map((entry, index) => ({ ...entry, index }))
      .sort((a, b) => a.id - b.id)
      .map((entry, index) => ({ ...entry, index }));
  }

  const items = palette.map((entry) => {
    const oklab = rgb8ToOklab(entry.color.r, entry.color.g, entry.color.b);
    const chroma = Math.hypot(oklab.a, oklab.b);
    const hue = ((Math.atan2(oklab.b, oklab.a) * 180) / Math.PI + 360) % 360;
    return {
      entry,
      id: entry.id,
      L: oklab.L,
      chroma,
      hue,
      achromatic: chroma < 0.02,
    };
  });

  const descending = order.endsWith('desc');
  const lightnessDir = descending ? -1 : 1;

  if (order.startsWith('lightness')) {
    items.sort(
      (a, b) =>
        lightnessDir * (a.L - b.L) ||
        hueCompare(a, b) ||
        b.chroma - a.chroma ||
        a.id - b.id,
    );
  } else {
    const achromatic = items
      .filter((item) => item.achromatic)
      .sort((a, b) => lightnessDir * (a.L - b.L) || a.id - b.id);
    const hueDir = descending ? -1 : 1;
    const chromatic = circularHueOrder(
      items.filter((item) => !item.achromatic),
      hueDir,
      lightnessDir,
    );
    items.length = 0;
    items.push(...achromatic, ...chromatic);
  }

  return items.map((item, index) => ({ ...item.entry, index }));
}

/**
 * Achromatic first, then chromatic sorted by circular hue. The largest hue gap
 * becomes the boundary so reds near 0° and 360° stay adjacent. Within a hue group,
 * lightness follows the requested direction.
 * @param {{ entry: any, id:number, L:number, chroma:number, hue:number }[]} items
 * @param {1|-1} hueDir
 * @param {1|-1} lightnessDir
 */
function circularHueOrder(items, hueDir, lightnessDir) {
  if (items.length <= 1) return items.slice();
  const sorted = items.slice().sort((a, b) => a.hue - b.hue || a.id - b.id);
  let bestGap = -1;
  let bestIndex = 0;
  for (let i = 0; i < sorted.length; i++) {
    const next = sorted[(i + 1) % sorted.length];
    const gap = (next.hue - sorted[i].hue + 360) % 360;
    if (gap > bestGap) {
      bestGap = gap;
      bestIndex = i;
    }
  }
  const startHue = sorted[(bestIndex + 1) % sorted.length].hue;
  return sorted
    .map((item) => ({
      ...item,
      key: hueDir === 1
        ? (item.hue - startHue + 360) % 360
        : (startHue - item.hue + 360) % 360,
    }))
    .sort(
      (a, b) =>
        a.key - b.key ||
        lightnessDir * (a.L - b.L) ||
        b.chroma - a.chroma ||
        a.id - b.id,
    );
}

/**
 * @param {{ hue:number, entry:any, id:number }} a
 * @param {{ hue:number, entry:any, id:number }} b
 */
function hueCompare(a, b) {
  return a.hue - b.hue || a.id - b.id;
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
