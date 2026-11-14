// @ts-check
import { formatHex, parseHex, rgb8ToOklab } from './color.js';
import { sha256Hex, stableStringify } from './hash.js';

/** @typedef {import('./types.js').RGB8} RGB8 */
/** @typedef {import('./types.js').Palette} Palette */
/** @typedef {import('./types.js').PaletteEntry} PaletteEntry */

const MAX_PALETTE_COLORS = 256;

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
 * Add a color at the end of the palette. The new id is one past the current maximum,
 * so manual order stays stable across add/remove and `source` sorting.
 *
 * @param {Palette} palette
 * @param {string} hex
 * @returns {Palette}
 */
export function addPaletteEntry(palette, hex) {
  if (palette.length >= MAX_PALETTE_COLORS) {
    throw new Error(`palette is limited to ${MAX_PALETTE_COLORS} colors`);
  }
  const color = parseHex(hex);
  assertUniqueColor(palette, color, -1);
  const id = palette.reduce((max, entry) => Math.max(max, entry.id), 0) + 1;
  return [
    ...palette,
    {
      id,
      index: palette.length,
      color,
      hex: formatHex(color),
      name: null,
      role: null,
      locked: false,
    },
  ];
}

/**
 * Replace one entry's color. Identity, index, and lock state stay unchanged.
 *
 * @param {Palette} palette
 * @param {number} id
 * @param {string} hex
 * @returns {Palette}
 */
export function updatePaletteEntry(palette, id, hex) {
  const position = palette.findIndex((entry) => entry.id === id);
  if (position < 0) throw new Error('palette entry not found');
  const color = parseHex(hex);
  assertUniqueColor(palette, color, position);
  return palette.map((entry) =>
    entry.id === id ? { ...entry, color, hex: formatHex(color) } : entry,
  );
}

/**
 * Remove an unlocked entry and renumber export indices deterministically.
 *
 * @param {Palette} palette
 * @param {number} id
 * @returns {Palette}
 */
export function removePaletteEntry(palette, id) {
  const entry = palette.find((candidate) => candidate.id === id);
  if (!entry) throw new Error('palette entry not found');
  if (entry.locked) throw new Error('locked color cannot be removed');
  if (palette.length <= 1) throw new Error('palette must keep at least one color');
  return palette
    .filter((candidate) => candidate.id !== id)
    .map((candidate, index) => ({ ...candidate, index }));
}

/**
 * Set or clear a lock. Unlocked entries participate in sorting; locked entries keep
 * their current display slot.
 *
 * @param {Palette} palette
 * @param {number} id
 * @param {boolean} locked
 * @returns {Palette}
 */
export function setPaletteLock(palette, id, locked) {
  if (!palette.some((entry) => entry.id === id)) {
    throw new Error('palette entry not found');
  }
  return palette.map((entry) => (entry.id === id ? { ...entry, locked } : entry));
}

/**
 * Move an unlocked entry one slot left or right. Locked entries keep their slot, so
 * a move that would cross a locked entry is refused. IDs survive; indices are
 * reassigned after a successful move.
 *
 * @param {Palette} palette
 * @param {number} id
 * @param {'left'|'right'} direction
 * @returns {Palette}
 */
export function movePaletteEntry(palette, id, direction) {
  const position = palette.findIndex((entry) => entry.id === id);
  if (position < 0) throw new Error('palette entry not found');
  if (palette[position].locked) throw new Error('locked color cannot be moved');
  const target = position + (direction === 'left' ? -1 : 1);
  if (target < 0 || target >= palette.length) return palette;
  if (palette[target].locked) throw new Error('locked color blocks this move');
  const next = palette.slice();
  [next[position], next[target]] = [next[target], next[position]];
  return next.map((entry, index) => ({ ...entry, index }));
}

/**
 * @param {Palette} palette
 * @param {{ r:number,g:number,b:number,a:number }} color
 * @param {number} skipPosition
 */
function assertUniqueColor(palette, color, skipPosition) {
  const duplicate = palette.some(
    (entry, position) =>
      position !== skipPosition &&
      entry.color.r === color.r &&
      entry.color.g === color.g &&
      entry.color.b === color.b &&
      entry.color.a === color.a,
  );
  if (duplicate) throw new Error('color already exists in the palette');
}

/**
 * Return a new palette in the requested order. IDs survive; indices are reassigned.
 * `source` uses the stable id, so switching back restores extraction order.
 *
 * Locks pin entries to their current display slot. Unlocked entries fill the
 * remaining slots in the requested order, so a locked color never moves and its
 * palette identity never changes.
 *
 * Orders:
 * - `source`
 * - `manual` — keep the current array order (used by the move buttons)
 * - `hue-asc` / `hue-desc` — achromatic first, then hue groups in a circular order,
 *   with lightness ascending/descending inside each group.
 * - `lightness-asc` / `lightness-desc`
 *
 * @param {Palette} palette
 * @param {'source'|'manual'|'hue-asc'|'hue-desc'|'lightness-asc'|'lightness-desc'} order
 * @returns {Palette}
 */
export function sortPalette(palette, order = 'source') {
  if (!palette.length) return [];
  const unlocked = sortUnlockedEntries(
    palette.filter((entry) => !entry.locked),
    order,
  );
  let next = 0;
  return palette.map((entry, index) => {
    const chosen = entry.locked ? entry : unlocked[next++];
    return { ...chosen, index };
  });
}

/**
 * Sort only the entries that are free to move. The result has no index changes;
 * `sortPalette` assigns indices after merging with locked slots.
 *
 * @param {Palette} entries
 * @param {'source'|'manual'|'hue-asc'|'hue-desc'|'lightness-asc'|'lightness-desc'} order
 * @returns {Palette}
 */
function sortUnlockedEntries(entries, order) {
  if (order === 'manual') return entries.slice();
  if (order === 'source') {
    return entries.slice().sort((a, b) => a.id - b.id);
  }
  if (entries.length <= 1) return entries.slice();

  const items = entries.map((entry) => {
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

  return items.map((item) => item.entry);
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
