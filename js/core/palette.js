// @ts-check
import {
  deltaE00,
  formatHex,
  parseHex,
  rgb8ToLab,
  rgb8ToOklab,
} from './color.js';
import { perceptualOrder } from './palette-order.js';
import { sha256Hex, stableStringify } from './hash.js';

/** @typedef {import('./types.js').RGB8} RGB8 */
/** @typedef {import('./types.js').Palette} Palette */
/** @typedef {import('./types.js').PaletteEntry} PaletteEntry */
/** @typedef {'source'|'manual'|'hue-asc'|'hue-desc'|'hue-perceptual-asc'|'hue-perceptual-desc'|'lightness-asc'|'lightness-desc'|'perceptual'|'perceptual-path'|'perceptual-flow'} SortOrder */

/**
 * @typedef {Object} HueItem
 * @property {PaletteEntry} entry
 * @property {number} id
 * @property {number} L
 * @property {number} chroma
 * @property {number} hue
 * @property {boolean} achromatic
 */

const MAX_PALETTE_COLORS = 256;
const EPSILON = 1e-9;
// A band wider than this is split at its most balanced internal hue gap, biased toward
// wider gaps. Narrower palettes stay one band, and each resulting band is narrow enough
// for a meaningful ramp.
const HUE_BAND_MAX_SPAN = 30;
const HUE_SPLIT_GAP_WEIGHT = 2;

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
 * Find the entry that already holds a color. A refused duplicate can then be pointed at
 * instead of only reported, and the caller keeps the exact-match rule of
 * `assertUniqueColor` without using an exception as control flow.
 *
 * @param {Palette} palette
 * @param {string|{ r:number,g:number,b:number,a:number }} value
 * @returns {PaletteEntry|null}
 */
export function findPaletteEntryByColor(palette, value) {
  const color = typeof value === 'string' ? parseHex(value) : value;
  const match = palette.find(
    (entry) =>
      entry.color.r === color.r &&
      entry.color.g === color.g &&
      entry.color.b === color.b &&
      entry.color.a === color.a,
  );
  return match ?? null;
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

const DIRECTIONAL_SORT_FAMILIES = new Set(['hue', 'hue-perceptual', 'lightness']);

/**
 * Map a stored sort key to the family shown in the sort select. Directional orders
 * share one select entry and use the direction button.
 * @param {string} order
 * @returns {string}
 */
export function sortFamily(order) {
  if (order === 'hue-asc' || order === 'hue-desc') return 'hue';
  if (order === 'hue-perceptual-asc' || order === 'hue-perceptual-desc') {
    return 'hue-perceptual';
  }
  if (order === 'lightness-asc' || order === 'lightness-desc') return 'lightness';
  return order;
}

/**
 * @param {string} order
 * @returns {'asc'|'desc'|null}
 */
export function sortDirection(order) {
  if (order.endsWith('-desc')) return 'desc';
  if (order.endsWith('-asc')) return 'asc';
  return null;
}

/**
 * @param {string} family
 * @param {'asc'|'desc'|null|undefined} [direction]
 * @returns {string}
 */
export function sortOrderFor(family, direction) {
  if (!DIRECTIONAL_SORT_FAMILIES.has(family)) return family;
  return `${family}-${direction === 'desc' ? 'desc' : 'asc'}`;
}

/**
 * @param {string} value full sort key or select family
 * @returns {boolean}
 */
export function isDirectionalSort(value) {
  return DIRECTIONAL_SORT_FAMILIES.has(sortFamily(value));
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
 * - `hue-perceptual-asc` / `hue-perceptual-desc` — the same hue bands with a
 *   CIEDE2000 path inside each band and a smoother join between bands.
 * - `lightness-asc` / `lightness-desc`
 * - `perceptual` — lightness seed refined by CIEDE2000 2-opt
 * - `perceptual-path` — fixed-endpoint TSP path by CIEDE2000
 * - `perceptual-flow` — DCCW-style cycle cut by CIEDE2000
 *
 * @param {Palette} palette
 * @param {SortOrder} order
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
 * @param {SortOrder} order
 * @returns {Palette}
 */
function sortUnlockedEntries(entries, order) {
  if (order === 'manual') return entries.slice();
  if (order === 'source') {
    return entries.slice().sort((a, b) => a.id - b.id);
  }
  if (entries.length <= 1) return entries.slice();
  if (order === 'perceptual' || order === 'perceptual-path' || order === 'perceptual-flow') {
    const seed =
      order === 'perceptual' ? sortUnlockedEntries(entries, 'lightness-asc') : undefined;
    return perceptualOrder(entries, order, seed);
  }

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
    return items.map((item) => item.entry);
  }

  const achromatic = items
    .filter((item) => item.achromatic)
    .sort((a, b) => lightnessDir * (a.L - b.L) || a.id - b.id)
    .map((item) => item.entry);
  const chromatic = circularHueOrder(
    items.filter((item) => !item.achromatic),
    lightnessDir,
    order.startsWith('hue-perceptual'),
    achromatic[achromatic.length - 1] ?? null,
  );
  return [...achromatic, ...chromatic];
}

/**
 * Achromatic entries are handled by the caller. Chromatic entries are split into
 * circular hue bands. A plain hue order sorts each band by lightness. The perceptual hue
 * order builds a CIEDE2000 path inside each band and chooses each band's direction so the
 * joins stay close; this avoids a large jump between two narrow L ramps.
 * @param {HueItem[]} items
 * @param {1|-1} lightnessDir
 * @param {boolean} perceptual
 * @param {PaletteEntry|null} anchor last achromatic entry before the bands
 * @returns {PaletteEntry[]}
 */
function circularHueOrder(items, lightnessDir, perceptual, anchor) {
  if (items.length <= 1) return items.map((item) => item.entry);
  const sorted = items.slice().sort((a, b) => a.hue - b.hue || a.id - b.id);
  let wrapGap = -1;
  let wrapIndex = 0;
  for (let index = 0; index < sorted.length; index++) {
    const next = sorted[(index + 1) % sorted.length];
    const gap = (next.hue - sorted[index].hue + 360) % 360;
    if (gap > wrapGap) {
      wrapGap = gap;
      wrapIndex = index;
    }
  }
  const circular = sorted
    .slice(wrapIndex + 1)
    .concat(sorted.slice(0, wrapIndex + 1));
  const bands = hueBands(circular, wrapGap);
  if (perceptual) return perceptualBands(bands, lightnessDir, anchor);
  /** @type {PaletteEntry[]} */
  const ordered = [];
  for (const band of bands) ordered.push(...bandSeed(band, lightnessDir));
  return ordered;
}

/**
 * Order each band with CIEDE2000 2-opt and choose one of its two directions. The small
 * direction penalty only breaks exact ties; the DP still picks the smoother join when the
 * opposite direction is closer to the previous band.
 *
 * @param {HueItem[][]} bands
 * @param {1|-1} lightnessDir
 * @param {PaletteEntry|null} anchor
 * @returns {PaletteEntry[]}
 */
function perceptualBands(bands, lightnessDir, anchor) {
  const paths = bands.map((band) => {
    const entries = band.map((item) => item.entry);
    return [
      perceptualOrder(entries, 'perceptual', bandSeed(band, lightnessDir)),
      perceptualOrder(entries, 'perceptual', bandSeed(band, -lightnessDir)),
    ];
  });
  const count = paths.length;
  /** @type {number[][]} */
  const cost = Array.from({ length: count }, () => [Infinity, Infinity]);
  /** @type {number[][]} */
  const previous = Array.from({ length: count }, () => [-1, -1]);
  for (let direction = 0; direction < 2; direction++) {
    const start = paths[0][direction][0];
    const join = anchor ? colorDistance(anchor, start) : 0;
    cost[0][direction] = join + (direction === 0 ? 0 : EPSILON);
  }
  for (let index = 1; index < count; index++) {
    for (let direction = 0; direction < 2; direction++) {
      for (let prior = 0; prior < 2; prior++) {
        const before = paths[index - 1][prior];
        const join = colorDistance(
          before[before.length - 1],
          paths[index][direction][0],
        );
        const value =
          cost[index - 1][prior] +
          join +
          (direction === 0 ? 0 : EPSILON);
        if (value < cost[index][direction]) {
          cost[index][direction] = value;
          previous[index][direction] = prior;
        }
      }
    }
  }
  let direction = cost[count - 1][0] <= cost[count - 1][1] ? 0 : 1;
  const chosen = new Array(count);
  chosen[count - 1] = direction;
  for (let index = count - 1; index > 0; index--) {
    direction = previous[index][direction];
    chosen[index - 1] = direction;
  }
  /** @type {PaletteEntry[]} */
  const ordered = [];
  for (let index = 0; index < count; index++) {
    ordered.push(...paths[index][chosen[index]]);
  }
  return ordered;
}

/**
 * @param {HueItem[]} band
 * @param {1|-1} lightnessDir
 * @returns {PaletteEntry[]}
 */
function bandSeed(band, lightnessDir) {
  return band
    .slice()
    .sort(
      (a, b) =>
        lightnessDir * (a.L - b.L) ||
        b.chroma - a.chroma ||
        a.id - b.id,
    )
    .map((item) => item.entry);
}

/**
 * @param {PaletteEntry} a
 * @param {PaletteEntry} b
 * @returns {number}
 */
function colorDistance(a, b) {
  return deltaE00(
    rgb8ToLab(a.color.r, a.color.g, a.color.b),
    rgb8ToLab(b.color.r, b.color.g, b.color.b),
  );
}

/**
 * Split a circular hue sequence into contiguous bands. The sequence starts after the
 * largest hue gap, so that wrap gap is the outer boundary and never an internal split.
 * A band wider than `HUE_BAND_MAX_SPAN` is split at its most balanced internal gap,
 * biased toward wider gaps. This keeps a continuous blue-purple region from becoming one
 * giant band that only has L order.
 *
 * @param {HueItem[]} items
 * @param {number} wrapGap
 * @returns {HueItem[][]}
 */
function hueBands(items, wrapGap) {
  const count = items.length;
  if (count <= 1) return [items.slice()];
  // A zero wrap gap means every hue is identical; the palette covers no arc at all.
  const span = wrapGap > 0 ? 360 - wrapGap : 0;
  if (span <= HUE_BAND_MAX_SPAN) return [items.slice()];

  /** @type {HueItem[][]} */
  const bands = [items.slice()];
  for (let guard = 0; guard < count; guard++) {
    let target = -1;
    let targetSpan = HUE_BAND_MAX_SPAN;
    for (let index = 0; index < bands.length; index++) {
      const bandSpan = hueSpan(bands[index]);
      if (bandSpan > targetSpan + EPSILON) {
        target = index;
        targetSpan = bandSpan;
      }
    }
    if (target < 0) break;
    const band = bands[target];
    const split = hueSplitIndex(band);
    if (split < 0) break;
    bands.splice(
      target,
      1,
      band.slice(0, split + 1),
      band.slice(split + 1),
    );
  }
  return bands;
}

/**
 * Split a band near its middle. A largest-gap-only rule can peel a single color off an
 * evenly spaced sweep or an edge gap, leaving the rest still too wide and then
 * interleaving hue and lightness. The score balances both halves and still favors a
 * wider gap, so a real family break wins over a mid-band zero gap.
 *
 * @param {HueItem[]} band
 * @returns {number} index of the gap after `band[index]`, or -1
 */
function hueSplitIndex(band) {
  const total = hueSpan(band);
  const firstHue = band[0].hue;
  let best = -1;
  let bestScore = Infinity;
  for (let index = 0; index + 1 < band.length; index++) {
    const gap = (band[index + 1].hue - band[index].hue + 360) % 360;
    const left = (band[index].hue - firstHue + 360) % 360;
    const right = total - left - gap;
    // A wider gap is a stronger family boundary, but a gap at the edge should not
    // peel one color off and leave the rest still too wide. Balance keeps both halves
    // usable as ramps; the weight keeps a real hue break ahead of a mid-band zero gap.
    const score = Math.abs(left - right) - HUE_SPLIT_GAP_WEIGHT * gap;
    if (score < bestScore - EPSILON) {
      best = index;
      bestScore = score;
    }
  }
  return best;
}

/**
 * @param {HueItem[]} band
 * @returns {number}
 */
function hueSpan(band) {
  if (band.length <= 1) return 0;
  return (band[band.length - 1].hue - band[0].hue + 360) % 360;
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
