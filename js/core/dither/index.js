// @ts-check
import { buildMapper, mapIndices } from '../map.js';
import { ditherErrorDiffusion } from './error-diffusion.js';
import { ditherOrdered } from './ordered.js';
import { ditherBlueNoise } from './blue-noise.js';

export const DITHER_METHODS = /** @type {const} */ ([
  'none',
  'floyd-steinberg',
  'atkinson',
  'stucki',
  'jarvis',
  'burkes',
  'sierra',
  'bayer2',
  'bayer4',
  'bayer8',
  'blue-noise',
]);

/**
 * @typedef {Object} DitherParams
 * @property {'none'|'floyd-steinberg'|'atkinson'|'stucki'|'jarvis'|'burkes'|'sierra'|'bayer2'|'bayer4'|'bayer8'|'blue-noise'} method
 * @property {number} strength
 * @property {boolean} serpentine
 * @property {number} edgeStop
 * @property {number} alphaThreshold
 * @property {number} transparentIndex
 */

/**
 * @param {import('../types.js').ImageDataLite} image
 * @param {import('../types.js').Palette} palette
 * @param {Partial<DitherParams> & { space?: 'oklab'|'srgb', mapper?: import('../map.js').Mapper }} [options]
 */
export function ditherPixels(image, palette, options = {}) {
  const space = options.space ?? 'oklab';
  const method = options.method ?? 'none';
  const mapper = options.mapper ?? buildMapper(palette, { space });
  const common = {
    space,
    strength: options.strength ?? 0.8,
    serpentine: options.serpentine ?? true,
    edgeStop: options.edgeStop ?? 0.5,
    alphaThreshold: options.alphaThreshold ?? 128,
    transparentIndex: options.transparentIndex ?? -1,
    mapper,
  };

  if (method === 'none') {
    return mapIndices(image, palette, common);
  }
  if (method === 'bayer2' || method === 'bayer4' || method === 'bayer8') {
    return ditherOrdered(image, palette, { ...common, method });
  }
  if (method === 'blue-noise') {
    return ditherBlueNoise(image, palette, common);
  }
  return ditherErrorDiffusion(image, palette, { ...common, method });
}
