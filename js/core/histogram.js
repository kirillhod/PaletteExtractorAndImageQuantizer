// @ts-check
import { rgb8ToOklab } from './color.js';

/** @typedef {import('./types.js').Histogram} Histogram */
/** @typedef {import('./types.js').HistogramBin} HistogramBin */
/** @typedef {import('./types.js').ImageDataLite} ImageDataLite */

const BIN_COUNT = 1 << 15;

/**
 * Build a 5-bit-per-channel, alpha-weighted histogram.
 * @param {ImageDataLite} image
 * @param {{ bits?: 5 }} [options]
 * @returns {Histogram}
 */
export function buildHistogram(image, options = {}) {
  const bits = options.bits ?? 5;
  if (bits !== 5) throw new RangeError('only 5-bit histograms are supported');
  const { data, width, height } = image;
  if (!(data instanceof Uint8ClampedArray) && !(data instanceof Uint8Array)) {
    throw new TypeError('image.data must be a Uint8ClampedArray or Uint8Array');
  }
  if (data.length !== width * height * 4) {
    throw new RangeError('image.data length must be width * height * 4');
  }

  const weight = new Float64Array(BIN_COUNT);
  const sumR = new Float64Array(BIN_COUNT);
  const sumG = new Float64Array(BIN_COUNT);
  const sumB = new Float64Array(BIN_COUNT);
  let opaquePixels = 0;

  for (let i = 0; i < data.length; i += 4) {
    const alpha = data[i + 3];
    if (alpha === 0) continue;
    const w = alpha / 255;
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const bin = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
    weight[bin] += w;
    sumR[bin] += r * w;
    sumG[bin] += g * w;
    sumB[bin] += b * w;
    opaquePixels++;
  }

  const occupied = [];
  for (let i = 0; i < BIN_COUNT; i++) {
    if (weight[i] > 0) occupied.push(i);
  }

  return {
    bits,
    width,
    height,
    weight,
    sumR,
    sumG,
    sumB,
    occupied,
    opaquePixels,
    pixelCount: width * height,
  };
}

/**
 * Materialize occupied bins with weighted mean colors and Oklab coordinates.
 * @param {Histogram} hist
 * @returns {HistogramBin[]}
 */
export function histogramBins(hist) {
  /** @type {HistogramBin[]} */
  const bins = new Array(hist.occupied.length);
  for (let i = 0; i < hist.occupied.length; i++) {
    const bin = hist.occupied[i];
    const weight = hist.weight[bin];
    const r = clampByte(hist.sumR[bin] / weight);
    const g = clampByte(hist.sumG[bin] / weight);
    const b = clampByte(hist.sumB[bin] / weight);
    bins[i] = {
      bin,
      r,
      g,
      b,
      weight,
      oklab: rgb8ToOklab(r, g, b),
    };
  }
  return bins;
}

/**
 * @param {number} value
 * @returns {number}
 */
function clampByte(value) {
  const rounded = Math.round(value);
  return rounded < 0 ? 0 : rounded > 255 ? 255 : rounded;
}
