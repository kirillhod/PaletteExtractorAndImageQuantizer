// @ts-check
import { extractMedianCut } from './median-cut.js';
import { extractPopularity } from './popularity.js';

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
  switch (params.method) {
    case 'popularity':
      return extractPopularity(hist, { colors });
    case 'median-cut':
      return extractMedianCut(hist, { colors, space: params.space });
    default:
      throw new Error(`unsupported extraction method: ${String(params.method)}`);
  }
}
