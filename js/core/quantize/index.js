// @ts-check
import { extractMedianCut } from './median-cut.js';
import { extractPopularity } from './popularity.js';
import { extractWu } from './wu.js';
import { extractOctree } from './octree.js';
import { extractKMeans } from './kmeans.js';
import { refinePalette } from './refine.js';

/** @typedef {import('../types.js').Histogram} Histogram */
/** @typedef {import('../types.js').ExtractParams} ExtractParams */

/**
 * @param {Histogram} hist
 * @param {ExtractParams} params
 * @returns {{ r:number, g:number, b:number, weight:number }[]}
 */
export function extractPalette(hist, params) {
  const colors = params.colors;
  if (!Number.isInteger(colors) || colors < 1 || colors > 256) {
    throw new RangeError('colors must be an integer in 1..256');
  }

  let palette;
  switch (params.method) {
    case 'popularity':
      palette = extractPopularity(hist, { colors });
      break;
    case 'median-cut':
      palette = extractMedianCut(hist, { colors, space: params.space });
      break;
    case 'wu':
      palette = extractWu(hist, { colors, space: params.space });
      break;
    case 'octree':
      palette = extractOctree(hist, { colors });
      break;
    case 'kmeans':
      palette = extractKMeans(hist, {
        colors,
        space: params.space,
        seed: params.seed ?? 0,
        maxIters: params.maxIters ?? 20,
      });
      break;
    default:
      throw new Error(`unsupported extraction method: ${String(params.method)}`);
  }

  const refineDefault = params.method === 'median-cut' || params.method === 'wu';
  if ((params.refine ?? refineDefault) && palette.length > 1) {
    palette = refinePalette(hist, palette, { space: params.space, passes: 2 });
  }
  return palette;
}
