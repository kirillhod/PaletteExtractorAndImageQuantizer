// @ts-check
import { buildMapper } from '../map.js';
import { BLUE_NOISE_64_B64 } from './blue-noise-mask.js';

let cachedMask = null;

/**
 * @returns {Uint8Array}
 */
export function blueNoiseMask64() {
  if (cachedMask) return cachedMask;
  if (typeof globalThis.atob !== 'function') {
    throw new Error('atob is required to decode the blue-noise mask');
  }
  const binary = globalThis.atob(BLUE_NOISE_64_B64);
  if (binary.length !== 64 * 64) throw new Error('invalid blue-noise mask length');
  const mask = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) mask[i] = binary.charCodeAt(i);
  cachedMask = mask;
  return mask;
}

/**
 * @param {import('../types.js').ImageDataLite} image
 * @param {import('../types.js').Palette} palette
 * @param {{
 *   space?: 'oklab'|'srgb',
 *   strength?: number,
 *   alphaThreshold?: number,
 *   transparentIndex?: number,
 *   mapper?: import('../map.js').Mapper,
 * }} [options]
 */
export function ditherBlueNoise(image, palette, options = {}) {
  const space = options.space ?? 'oklab';
  const strength = options.strength ?? 1;
  const alphaThreshold = options.alphaThreshold ?? 128;
  const transparentIndex = options.transparentIndex ?? -1;
  const mapper = options.mapper ?? buildMapper(palette, { space });
  const mask = blueNoiseMask64();

  const { data, width, height } = image;
  const indices = new Uint8Array(width * height);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const p = y * width + x;
      const i = p * 4;
      const alpha = data[i + 3];
      if (alpha === 0) {
        indices[p] = transparentIndex >= 0 ? transparentIndex : 0;
        continue;
      }
      if (alpha < alphaThreshold && transparentIndex >= 0) {
        indices[p] = transparentIndex;
        continue;
      }

      const candidates = mapper.candidatesRgb(data[i], data[i + 1], data[i + 2]);
      const threshold = mask[((y & 63) << 6) | (x & 63)] / 255;
      const probability = (candidates.probSecond / 255) * strength;
      indices[p] = threshold < probability ? candidates.second : candidates.first;
    }
  }

  return { indices, width, height, mapper };
}
