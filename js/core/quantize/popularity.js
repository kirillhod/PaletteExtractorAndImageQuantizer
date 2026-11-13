// @ts-check
import { histogramBins } from '../histogram.js';

/** @typedef {import('../types.js').Histogram} Histogram */
/** @typedef {import('../types.js').HistogramBin} HistogramBin */

/**
 * Keep the most frequent occupied bins, deduplicated by exact RGB.
 * @param {Histogram} hist
 * @param {{ colors: number }} params
 */
export function extractPopularity(hist, params) {
  const limit = normalizeLimit(params.colors);
  const bins = histogramBins(hist);
  bins.sort((a, b) => b.weight - a.weight || a.bin - b.bin);

  /** @type {{ r:number, g:number, b:number, weight:number }[]} */
  const out = [];
  const seen = new Set();
  for (const bin of bins) {
    const key = (bin.r << 16) | (bin.g << 8) | bin.b;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ r: bin.r, g: bin.g, b: bin.b, weight: bin.weight });
    if (out.length >= limit) break;
  }
  return out;
}

/**
 * @param {number} value
 */
function normalizeLimit(value) {
  if (!Number.isInteger(value) || value < 1 || value > 256) {
    throw new RangeError('colors must be an integer in 1..256');
  }
  return value;
}
