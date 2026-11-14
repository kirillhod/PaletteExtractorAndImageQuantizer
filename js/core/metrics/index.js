// @ts-check
import { deltaE00, rgb8ToLab } from '../color.js';

/** @typedef {import('../types.js').ImageDataLite} ImageDataLite */

const HISTOGRAM_BUCKETS = 2000;
const HISTOGRAM_STEP = 0.1;
const TOP_PIXELS = 20;
const ERROR_MAP_MAX = 20;
const RAMP_SIZE = 256;

/**
 * @typedef {Object} QualityResult
 * @property {number} deltaE00Mean
 * @property {number} deltaE00P95
 * @property {number} deltaE00Max
 * @property {number} pixels
 * @property {{x:number,y:number,deltaE00:number}[]} worstPixels
 * @property {ImageDataLite} errorMap
 */

/** @type {Uint8Array|null} */
let rampCache = null;

/**
 * Compute CIEDE2000 statistics and an error map between the source preview and the
 * mapped preview. Transparent pixels are skipped. The p95 value comes from 0.1-wide
 * buckets; the error map clamps at 20 ΔE.
 *
 * @param {{
 *   original: ImageDataLite,
 *   mapped: ImageDataLite,
 *   width: number,
 *   height: number,
 * }} input
 * @returns {QualityResult}
 */
export function computeQuality(input) {
  const { original, mapped, width, height } = input;
  if (
    original.width !== width ||
    original.height !== height ||
    mapped.width !== width ||
    mapped.height !== height
  ) {
    throw new Error('quality inputs must have matching dimensions');
  }
  if (original.data.length !== width * height * 4 || mapped.data.length !== width * height * 4) {
    throw new Error('quality inputs must be width * height * 4');
  }

  const histogram = new Uint32Array(HISTOGRAM_BUCKETS);
  const errorMap = new Uint8ClampedArray(width * height * 4);
  const ramp = errorRamp();
  /** @type {Map<number, {L:number,a:number,b:number}>} */
  const labCache = new Map();
  const worst = /** @type {{x:number,y:number,deltaE00:number}[]} */ ([]);

  const labFor = (r, g, b) => {
    const key = (r << 16) | (g << 8) | b;
    let lab = labCache.get(key);
    if (!lab) {
      lab = rgb8ToLab(r, g, b);
      labCache.set(key, lab);
    }
    return lab;
  };

  let sum = 0;
  let count = 0;
  let max = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const offset = (y * width + x) * 4;
      const sourceAlpha = original.data[offset + 3];
      const mappedAlpha = mapped.data[offset + 3];
      if (sourceAlpha === 0 || mappedAlpha === 0) continue;

      const delta = deltaE00(
        labFor(original.data[offset], original.data[offset + 1], original.data[offset + 2]),
        labFor(mapped.data[offset], mapped.data[offset + 1], mapped.data[offset + 2]),
      );

      sum += delta;
      count++;
      if (delta > max) max = delta;
      const bucket = Math.min(
        HISTOGRAM_BUCKETS - 1,
        Math.floor(delta / HISTOGRAM_STEP),
      );
      histogram[bucket]++;

      const rampIndex = Math.min(
        RAMP_SIZE - 1,
        Math.round(Math.min(delta, ERROR_MAP_MAX) / ERROR_MAP_MAX * (RAMP_SIZE - 1)),
      );
      errorMap[offset] = ramp[rampIndex * 3];
      errorMap[offset + 1] = ramp[rampIndex * 3 + 1];
      errorMap[offset + 2] = ramp[rampIndex * 3 + 2];
      errorMap[offset + 3] = 255;

      if (qualifiesForWorst(worst, x, y, delta)) {
        worst.push({ x, y, deltaE00: delta });
        worst.sort(
          (a, b) => b.deltaE00 - a.deltaE00 || a.y - b.y || a.x - b.x,
        );
        if (worst.length > TOP_PIXELS) worst.pop();
      }
    }
  }

  return {
    deltaE00Mean: count > 0 ? sum / count : 0,
    deltaE00P95: percentile(histogram, count),
    deltaE00Max: max,
    pixels: count,
    worstPixels: worst,
    errorMap: { data: errorMap, width, height },
  };
}

/**
 * @param {{deltaE00:number,y:number,x:number}[]} worst
 * @param {number} x
 * @param {number} y
 * @param {number} delta
 */
function qualifiesForWorst(worst, x, y, delta) {
  if (worst.length < TOP_PIXELS) return true;
  const last = worst[worst.length - 1];
  if (delta > last.deltaE00) return true;
  if (delta < last.deltaE00) return false;
  return y < last.y || (y === last.y && x < last.x);
}

/**
 * @param {Uint32Array} histogram
 * @param {number} count
 */
function percentile(histogram, count) {
  if (count === 0) return 0;
  const target = count * 0.95;
  let seen = 0;
  for (let i = 0; i < histogram.length; i++) {
    seen += histogram[i];
    if (seen >= target) return i * HISTOGRAM_STEP;
  }
  return (histogram.length - 1) * HISTOGRAM_STEP;
}

/** @returns {Uint8Array} 256 RGB entries */
function errorRamp() {
  if (rampCache) return rampCache;
  /** @type {[number, [number,number,number]][]} */
  const stops = [
    [0, [24, 28, 42]],
    [0.2, [35, 90, 210]],
    [0.4, [0, 190, 170]],
    [0.6, [70, 210, 50]],
    [0.8, [255, 200, 0]],
    [1, [235, 40, 40]],
  ];
  const ramp = new Uint8Array(RAMP_SIZE * 3);
  for (let i = 0; i < RAMP_SIZE; i++) {
    const t = i / (RAMP_SIZE - 1);
    let left = stops[0];
    let right = stops[stops.length - 1];
    for (let s = 1; s < stops.length; s++) {
      if (t <= stops[s][0]) {
        left = stops[s - 1];
        right = stops[s];
        break;
      }
    }
    const span = right[0] - left[0] || 1;
    const local = (t - left[0]) / span;
    ramp[i * 3] = Math.round(left[1][0] + (right[1][0] - left[1][0]) * local);
    ramp[i * 3 + 1] = Math.round(left[1][1] + (right[1][1] - left[1][1]) * local);
    ramp[i * 3 + 2] = Math.round(left[1][2] + (right[1][2] - left[1][2]) * local);
  }
  rampCache = ramp;
  return ramp;
}
