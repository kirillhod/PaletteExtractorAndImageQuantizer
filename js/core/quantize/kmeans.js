// @ts-check
import { histogramBins } from '../histogram.js';
import { createRng } from '../rng.js';
import { oklabToRgb8 } from '../color.js';

/** @typedef {import('../types.js').Histogram} Histogram */

/**
 * Deterministic weighted k-means++ over the occupied histogram bins.
 * @param {Histogram} hist
 * @param {{ colors: number, space: 'oklab'|'srgb', seed?: number, maxIters?: number }} params
 */
export function extractKMeans(hist, params) {
  const colors = normalizeLimit(params.colors);
  const space = params.space;
  const bins = histogramBins(hist);
  if (!bins.length) return [];
  if (bins.length <= colors) {
    return bins.map((bin) => ({ r: bin.r, g: bin.g, b: bin.b, weight: bin.weight }));
  }

  const coords = bins.map((bin) => coordsOf(bin, space));
  const weights = bins.map((bin) => bin.weight);
  const rng = createRng(params.seed ?? 0);

  const first = highestWeightIndex(bins);
  const chosen = new Set([first]);
  /** @type {[number, number, number][]} */
  const centroids = [coords[first].slice()];

  while (centroids.length < colors) {
    const distances = new Float64Array(bins.length);
    let total = 0;
    for (let i = 0; i < bins.length; i++) {
      let best = Infinity;
      for (const centroid of centroids) {
        const d = distanceSq(coords[i], centroid);
        if (d < best) best = d;
      }
      distances[i] = best;
      total += weights[i] * best;
    }

    if (total <= 0) {
      const fallback = highestWeightUnchosen(bins, chosen);
      if (fallback < 0) break;
      chosen.add(fallback);
      centroids.push(coords[fallback].slice());
      continue;
    }

    let target = rng.nextFloat() * total;
    let picked = -1;
    for (let i = 0; i < bins.length; i++) {
      target -= weights[i] * distances[i];
      if (target <= 0) {
        picked = i;
        break;
      }
    }
    if (picked < 0) picked = highestWeightUnchosen(bins, chosen);
    if (picked < 0 || chosen.has(picked)) {
      const fallback = highestWeightUnchosen(bins, chosen);
      if (fallback < 0) break;
      picked = fallback;
    }
    chosen.add(picked);
    centroids.push(coords[picked].slice());
  }

  const work = bins.length * centroids.length;
  const maxIters = Math.max(
    1,
    Math.min(params.maxIters ?? 20, Math.floor(60_000_000 / Math.max(1, work))),
  );

  /** @type {Float64Array} */
  let clusterWeights = new Float64Array(centroids.length);
  for (let iteration = 0; iteration < maxIters; iteration++) {
    const sums = new Float64Array(centroids.length * 3);
    clusterWeights = new Float64Array(centroids.length);

    for (let i = 0; i < bins.length; i++) {
      const nearest = nearestCentroid(coords[i], centroids);
      const w = weights[i];
      clusterWeights[nearest] += w;
      sums[nearest * 3] += coords[i][0] * w;
      sums[nearest * 3 + 1] += coords[i][1] * w;
      sums[nearest * 3 + 2] += coords[i][2] * w;
    }

    let maxMove = 0;
    for (let k = 0; k < centroids.length; k++) {
      if (clusterWeights[k] > 0) {
        const next = /** @type {[number, number, number]} */ ([
          sums[k * 3] / clusterWeights[k],
          sums[k * 3 + 1] / clusterWeights[k],
          sums[k * 3 + 2] / clusterWeights[k],
        ]);
        const move = distanceSq(centroids[k], next);
        if (move > maxMove) maxMove = move;
        centroids[k] = next;
      } else {
        // Re-seed an empty cluster at the most under-served bin.
        const far = farthestBin(coords, weights, centroids);
        if (far >= 0) {
          centroids[k] = coords[far].slice();
          maxMove = Math.max(maxMove, 1);
        }
      }
    }

    if (maxMove < 1e-10) break;
  }

  /** @type {Map<number, { r:number,g:number,b:number,weight:number }>} */
  const unique = new Map();
  centroids.forEach((centroid, index) => {
    const rgb = toRgb(centroid, space);
    const key = (rgb.r << 16) | (rgb.g << 8) | rgb.b;
    const existing = unique.get(key);
    if (existing) existing.weight += clusterWeights[index] ?? 0;
    else unique.set(key, { ...rgb, weight: clusterWeights[index] ?? 0 });
  });
  return [...unique.values()];
}

/**
 * @param {{ weight:number, r:number }[]} bins
 */
function highestWeightIndex(bins) {
  let best = 0;
  for (let i = 1; i < bins.length; i++) {
    if (bins[i].weight > bins[best].weight) best = i;
  }
  return best;
}

/**
 * @param {{ weight:number }[]} bins
 * @param {Set<number>} chosen
 */
function highestWeightUnchosen(bins, chosen) {
  let best = -1;
  for (let i = 0; i < bins.length; i++) {
    if (chosen.has(i)) continue;
    if (best < 0 || bins[i].weight > bins[best].weight || (bins[i].weight === bins[best].weight && i < best)) {
      best = i;
    }
  }
  return best;
}

/**
 * @param {[number,number,number]} point
 * @param {[number,number,number][]} centroids
 */
function nearestCentroid(point, centroids) {
  let best = 0;
  let bestDistance = Infinity;
  for (let i = 0; i < centroids.length; i++) {
    const d = distanceSq(point, centroids[i]);
    if (d < bestDistance) {
      bestDistance = d;
      best = i;
    }
  }
  return best;
}

/**
 * @param {[number,number,number][]} coords
 * @param {number[]} weights
 * @param {[number,number,number][]} centroids
 */
function farthestBin(coords, weights, centroids) {
  let best = -1;
  let bestScore = -1;
  for (let i = 0; i < coords.length; i++) {
    let nearest = Infinity;
    for (const centroid of centroids) {
      const d = distanceSq(coords[i], centroid);
      if (d < nearest) nearest = d;
    }
    const score = weights[i] * nearest;
    if (score > bestScore) {
      bestScore = score;
      best = i;
    }
  }
  return best;
}

/**
 * @param {[number,number,number]} a
 * @param {[number,number,number]} b
 */
function distanceSq(a, b) {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  const dz = a[2] - b[2];
  return dx * dx + dy * dy + dz * dz;
}

/**
 * @param {{ oklab: { L:number,a:number,b:number }, r:number,g:number,b:number }} bin
 * @param {'oklab'|'srgb'} space
 * @returns {[number,number,number]}
 */
function coordsOf(bin, space) {
  return space === 'oklab'
    ? [bin.oklab.L, bin.oklab.a, bin.oklab.b]
    : [bin.r, bin.g, bin.b];
}

/**
 * @param {[number,number,number]} coords
 * @param {'oklab'|'srgb'} space
 */
function toRgb(coords, space) {
  return space === 'oklab'
    ? oklabToRgb8(coords[0], coords[1], coords[2])
    : {
        r: clampByte(coords[0]),
        g: clampByte(coords[1]),
        b: clampByte(coords[2]),
      };
}

/**
 * @param {number} value
 */
function clampByte(value) {
  const rounded = Math.round(value);
  return rounded < 0 ? 0 : rounded > 255 ? 255 : rounded;
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
