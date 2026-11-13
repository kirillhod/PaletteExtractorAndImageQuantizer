// @ts-check
import { oklabDistanceSq, rgb8ToOklab } from './color.js';

/** @typedef {import('./types.js').Palette} Palette */
/** @typedef {import('./types.js').ImageDataLite} ImageDataLite */

/**
 * @typedef {Object} NearestLut
 * @property {Uint8Array} lut
 * @property {number} bits
 * @property {'oklab'|'srgb'} space
 * @property {number} size
 */

/**
 * Build a nearest-color lookup table over a 2^bits grid.
 * @param {Palette} palette
 * @param {{ space?: 'oklab'|'srgb', bits?: number }} [options]
 * @returns {NearestLut}
 */
export function buildNearestLut(palette, options = {}) {
  if (palette.length === 0) throw new Error('palette must not be empty');
  const space = options.space ?? 'oklab';
  const bits = options.bits ?? 6;
  if (!Number.isInteger(bits) || bits < 1 || bits > 8) {
    throw new RangeError('bits must be an integer in 1..8');
  }

  const size = 1 << (bits * 3);
  const lut = new Uint8Array(size);
  const coords = palette.map((entry) => coordsOf(entry.color, space));
  const shift = 8 - bits;
  const step = 1 << shift;

  let index = 0;
  for (let r = 0; r < 256; r += step) {
    for (let g = 0; g < 256; g += step) {
      for (let b = 0; b < 256; b += step) {
        const q = coordsOf({ r, g, b, a: 255 }, space);
        let best = 0;
        let bestDistance = Infinity;
        for (let i = 0; i < coords.length; i++) {
          const distance = oklabDistanceSq(q, coords[i]);
          if (distance < bestDistance) {
            bestDistance = distance;
            best = i;
          }
        }
        lut[index++] = best;
      }
    }
  }

  return { lut, bits, space, size };
}

/**
 * Map every pixel to the nearest palette entry. Alpha is preserved; fully transparent
 * pixels stay transparent. Preview and M1 export use the same mapping.
 *
 * @param {ImageDataLite} image
 * @param {Palette} palette
 * @param {{ space?: 'oklab'|'srgb', alphaThreshold?: number, lut?: NearestLut }} [options]
 * @returns {{ data: Uint8ClampedArray, width: number, height: number, lut: NearestLut }}
 */
export function mapPixels(image, palette, options = {}) {
  if (palette.length === 0) throw new Error('palette must not be empty');
  const space = options.space ?? 'oklab';
  const bits = options.lut?.bits ?? 6;
  const lut = options.lut ?? buildNearestLut(palette, { space, bits });
  if (lut.space !== space) throw new Error('LUT space does not match mapping space');

  const { data, width, height } = image;
  if (data.length !== width * height * 4) {
    throw new RangeError('image.data length must be width * height * 4');
  }

  const shift = 8 - lut.bits;
  const out = new Uint8ClampedArray(data.length);
  const colors = palette.map((entry) => entry.color);

  for (let i = 0; i < data.length; i += 4) {
    const alpha = data[i + 3];
    if (alpha === 0) continue;

    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const lutIndex = ((r >> shift) << (lut.bits * 2)) | ((g >> shift) << lut.bits) | (b >> shift);
    const color = colors[lut.lut[lutIndex]];

    out[i] = color.r;
    out[i + 1] = color.g;
    out[i + 2] = color.b;
    out[i + 3] = alpha;
  }

  return { data: out, width, height, lut };
}

/**
 * @param {{ r:number, g:number, b:number, a:number }} color
 * @param {'oklab'|'srgb'} space
 * @returns {{ L:number, a:number, b:number }}
 */
function coordsOf(color, space) {
  if (space === 'oklab') return rgb8ToOklab(color.r, color.g, color.b);
  return { L: color.r, a: color.g, b: color.b };
}
