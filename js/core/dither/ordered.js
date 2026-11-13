// @ts-check
import { buildMapper } from '../map.js';
import { BAYER_2, BAYER_4, BAYER_8 } from './kernels.js';

/**
 * Palette-aware ordered dithering. Uses the nearest and second-nearest palette entries
 * and the Bayer threshold to choose between them.
 *
 * @param {import('../types.js').ImageDataLite} image
 * @param {import('../types.js').Palette} palette
 * @param {{
 *   space?: 'oklab'|'srgb',
 *   method?: 'bayer2'|'bayer4'|'bayer8',
 *   strength?: number,
 *   alphaThreshold?: number,
 *   transparentIndex?: number,
 *   mapper?: import('../map.js').Mapper,
 * }} [options]
 */
export function ditherOrdered(image, palette, options = {}) {
  const space = options.space ?? 'oklab';
  const method = options.method ?? 'bayer4';
  const strength = options.strength ?? 1;
  const alphaThreshold = options.alphaThreshold ?? 128;
  const transparentIndex = options.transparentIndex ?? -1;
  const mapper = options.mapper ?? buildMapper(palette, { space });

  const matrix = method === 'bayer2' ? BAYER_2 : method === 'bayer8' ? BAYER_8 : BAYER_4;
  const size = matrix.length;
  const denominator = size * size;
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
      const threshold = (matrix[y % size][x % size] + 0.5) / denominator;
      const probability = (candidates.probSecond / 255) * strength;
      indices[p] = threshold < probability ? candidates.second : candidates.first;
    }
  }

  return { indices, width, height, mapper };
}
