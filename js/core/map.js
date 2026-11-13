// @ts-check
import { oklabDistanceSq, rgb8ToOklab } from './color.js';

/** @typedef {import('./types.js').Palette} Palette */
/** @typedef {import('./types.js').ImageDataLite} ImageDataLite */

/**
 * @typedef {Object} Mapper
 * @property {Uint8Array} nearest
 * @property {Uint8Array} second
 * @property {Uint8Array} probSecond 0..255 (d1/(d1+d2))
 * @property {number} bits
 * @property {'oklab'|'srgb'} space
 * @property {number} size
 * @property {{ L:number, a:number, b:number }[]} paletteCoords
 * @property {(r:number,g:number,b:number) => number} nearestRgb
 * @property {(r:number,g:number,b:number) => { first:number, second:number, probSecond:number }} candidatesRgb
 */

/**
 * Build a nearest/second-nearest lookup table over an sRGB 2^bits grid. Distances are
 * computed in the selected working space, so the lookup stays O(1) and the grid error
 * stays small (6 bits = 4 sRGB levels per channel).
 *
 * @param {Palette} palette
 * @param {{ space?: 'oklab'|'srgb', bits?: number }} [options]
 * @returns {Mapper}
 */
export function buildMapper(palette, options = {}) {
  if (palette.length === 0) throw new Error('palette must not be empty');
  const space = options.space ?? 'oklab';
  const bits = options.bits ?? 6;
  if (!Number.isInteger(bits) || bits < 1 || bits > 8) {
    throw new RangeError('bits must be an integer in 1..8');
  }

  const size = 1 << (bits * 3);
  const nearest = new Uint8Array(size);
  const second = new Uint8Array(size);
  const probSecond = new Uint8Array(size);
  const paletteCoords = palette.map((entry) => coordsOf(entry.color, space));
  const shift = 8 - bits;
  const step = 1 << shift;
  const mask = (1 << bits) - 1;

  let index = 0;
  for (let r = 0; r < 256; r += step) {
    for (let g = 0; g < 256; g += step) {
      for (let b = 0; b < 256; b += step) {
        const center = {
          r: Math.min(255, r + (step >> 1)),
          g: Math.min(255, g + (step >> 1)),
          b: Math.min(255, b + (step >> 1)),
          a: 255,
        };
        const q = coordsOf(center, space);
        let best = 0;
        let secondBest = 0;
        let d1 = Infinity;
        let d2 = Infinity;

        for (let i = 0; i < paletteCoords.length; i++) {
          const distance = oklabDistanceSq(q, paletteCoords[i]);
          if (distance < d1) {
            d2 = d1;
            secondBest = best;
            d1 = distance;
            best = i;
          } else if (distance < d2) {
            d2 = distance;
            secondBest = i;
          }
        }

        nearest[index] = best;
        second[index] = secondBest;
        probSecond[index] = Number.isFinite(d2) && d1 + d2 > 0
          ? Math.round((d1 / (d1 + d2)) * 255)
          : 0;
        index++;
      }
    }
  }

  /**
   * @param {number} r
   * @param {number} g
   * @param {number} b
   */
  function lutIndex(r, g, b) {
    return (
      ((r >> shift) & mask) * (1 << (bits * 2)) +
      ((g >> shift) & mask) * (1 << bits) +
      ((b >> shift) & mask)
    );
  }

  return {
    nearest,
    second,
    probSecond,
    bits,
    space,
    size,
    paletteCoords,
    nearestRgb(r, g, b) {
      return nearest[lutIndex(r, g, b)];
    },
    candidatesRgb(r, g, b) {
      const at = lutIndex(r, g, b);
      return { first: nearest[at], second: second[at], probSecond: probSecond[at] };
    },
  };
}

/**
 * Compatibility wrapper for callers that only need the LUT.
 * @param {Palette} palette
 * @param {{ space?: 'oklab'|'srgb', bits?: number }} [options]
 */
export function buildNearestLut(palette, options = {}) {
  return buildMapper(palette, options);
}

/**
 * Build an exact map for small unique-color images (pixel art). Returns null when the
 * image exceeds the unique-color cap; callers then use the LUT.
 *
 * @param {ImageDataLite} image
 * @param {Palette} palette
 * @param {{ space?: 'oklab'|'srgb', maxUnique?: number }} [options]
 * @returns {{ map: Map<number, number>, uniqueCount: number } | null}
 */
export function buildExactMap(image, palette, options = {}) {
  const space = options.space ?? 'oklab';
  const maxUnique = options.maxUnique ?? 65_536;
  const unique = new Map();
  const { data } = image;

  for (let i = 0; i < data.length; i += 4) {
    const key = (data[i] << 16) | (data[i + 1] << 8) | data[i + 2];
    if (!unique.has(key)) {
      unique.set(key, true);
      if (unique.size > maxUnique) return null;
    }
  }

  const paletteCoords = palette.map((entry) => coordsOf(entry.color, space));
  const map = new Map();
  for (const key of unique.keys()) {
    const r = (key >> 16) & 0xff;
    const g = (key >> 8) & 0xff;
    const b = key & 0xff;
    const point = coordsOf({ r, g, b, a: 255 }, space);
    let best = 0;
    let bestDistance = Infinity;
    for (let i = 0; i < paletteCoords.length; i++) {
      const distance = oklabDistanceSq(point, paletteCoords[i]);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = i;
      }
    }
    map.set(key, best);
  }

  return { map, uniqueCount: unique.size };
}

/**
 * @param {ImageDataLite} image
 * @param {Palette} palette
 * @param {{ space?: 'oklab'|'srgb', alphaThreshold?: number, transparentIndex?: number, mapper?: Mapper, exact?: boolean }} [options]
 * @returns {{ data: Uint8ClampedArray, width: number, height: number, mapper: Mapper }}
 */
export function mapPixels(image, palette, options = {}) {
  const space = options.space ?? 'oklab';
  const mapper = options.mapper ?? buildMapper(palette, { space });
  const transparentIndex = options.transparentIndex ?? -1;
  const alphaThreshold = options.alphaThreshold ?? 128;
  const exact = options.exact === false || palette.length <= 1
    ? null
    : buildExactMap(image, palette, { space });

  const { data, width, height } = image;
  if (data.length !== width * height * 4) {
    throw new RangeError('image.data length must be width * height * 4');
  }

  const out = new Uint8ClampedArray(data.length);
  const colors = palette.map((entry) => entry.color);

  for (let i = 0; i < data.length; i += 4) {
    const alpha = data[i + 3];
    if (alpha === 0) {
      out[i + 3] = 0;
      continue;
    }
    if (alpha < alphaThreshold && transparentIndex >= 0) {
      continue;
    }

    const key = (data[i] << 16) | (data[i + 1] << 8) | data[i + 2];
    const index = exact?.map.get(key) ?? mapper.nearestRgb(data[i], data[i + 1], data[i + 2]);
    const color = colors[index];
    out[i] = color.r;
    out[i + 1] = color.g;
    out[i + 2] = color.b;
    out[i + 3] = alpha;
  }

  return { data: out, width, height, mapper };
}

/**
 * Map every pixel to a palette index, applying the alpha threshold and reserved index.
 * @param {ImageDataLite} image
 * @param {Palette} palette
 * @param {{ space?: 'oklab'|'srgb', alphaThreshold?: number, transparentIndex?: number, mapper?: Mapper, exact?: boolean }} [options]
 * @returns {{ indices: Uint8Array, width:number, height:number, mapper: Mapper }}
 */
export function mapIndices(image, palette, options = {}) {
  const space = options.space ?? 'oklab';
  const mapper = options.mapper ?? buildMapper(palette, { space });
  const transparentIndex = options.transparentIndex ?? -1;
  const alphaThreshold = options.alphaThreshold ?? 128;
  const exact = options.exact === false || palette.length <= 1
    ? null
    : buildExactMap(image, palette, { space });
  const { data, width, height } = image;
  const indices = new Uint8Array(width * height);

  for (let p = 0, i = 0; i < data.length; i += 4, p++) {
    const alpha = data[i + 3];
    if (alpha < alphaThreshold && transparentIndex >= 0) {
      indices[p] = transparentIndex;
      continue;
    }
    const key = (data[i] << 16) | (data[i + 1] << 8) | data[i + 2];
    indices[p] = exact?.map.get(key) ?? mapper.nearestRgb(data[i], data[i + 1], data[i + 2]);
  }

  return { indices, width, height, mapper };
}

/**
 * Convert an index map to an RGBA preview. The reserved index is fully transparent.
 * @param {Uint8Array} indices
 * @param {number} width
 * @param {number} height
 * @param {Palette} palette
 * @param {{ transparentIndex?: number }} [options]
 */
export function indicesToRgba(indices, width, height, palette, options = {}) {
  const transparentIndex = options.transparentIndex ?? -1;
  const out = new Uint8ClampedArray(width * height * 4);
  for (let p = 0; p < indices.length; p++) {
    const index = indices[p];
    const offset = p * 4;
    if (index === transparentIndex && transparentIndex >= 0) continue;
    const color = palette[index].color;
    out[offset] = color.r;
    out[offset + 1] = color.g;
    out[offset + 2] = color.b;
    out[offset + 3] = color.a ?? 255;
  }
  return { data: out, width, height };
}

/**
 * @param {{ r:number,g:number,b:number,a:number }} color
 * @param {'oklab'|'srgb'} space
 * @returns {{ L:number, a:number, b:number }}
 */
export function coordsOf(color, space) {
  if (space === 'oklab') return rgb8ToOklab(color.r, color.g, color.b);
  return { L: color.r, a: color.g, b: color.b };
}
