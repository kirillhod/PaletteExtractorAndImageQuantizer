// @ts-check
import { histogramBins } from '../histogram.js';
import { oklabToRgb8 } from '../color.js';

/** @typedef {import('../types.js').Histogram} Histogram */
/** @typedef {import('../types.js').HistogramBin} HistogramBin */

/**
 * @typedef {Object} Box
 * @property {number} id
 * @property {HistogramBin[]} bins
 * @property {number} weight
 * @property {[number, number, number]} mean
 * @property {[number, number, number]} sse
 * @property {boolean} unsplittable
 */

/**
 * Median-cut extraction in the selected working space.
 * Box choice: largest weighted SSE. Split axis: largest weighted SSE axis.
 * Split point: weighted median. Deterministic ties by box id, axis, bin id.
 *
 * @param {Histogram} hist
 * @param {{ colors: number, space: 'oklab'|'srgb' }} params
 */
export function extractMedianCut(hist, params) {
  const colors = normalizeLimit(params.colors);
  const space = params.space;
  const bins = histogramBins(hist);
  if (bins.length === 0) return [];
  if (bins.length <= colors) {
    return bins.map((bin) => ({ r: bin.r, g: bin.g, b: bin.b, weight: bin.weight }));
  }

  /** @type {Box[]} */
  let boxes = [makeBox(0, bins, space)];
  let nextId = 1;
  let guard = 0;

  while (boxes.length < colors) {
    const index = bestSplittableIndex(boxes);
    if (index < 0) break;
    const split = splitBox(boxes[index], space, nextId);
    if (!split) {
      boxes[index].unsplittable = true;
      continue;
    }
    nextId += 2;
    boxes = boxes.slice(0, index).concat(split, boxes.slice(index + 1));
    if (++guard > 4096) break;
  }

  // If duplicate representatives reduced the count, keep splitting the next best box.
  while (uniqueColors(boxes, space).length < colors) {
    const index = bestSplittableIndex(boxes);
    if (index < 0) break;
    const split = splitBox(boxes[index], space, nextId);
    if (!split) {
      boxes[index].unsplittable = true;
      continue;
    }
    nextId += 2;
    boxes = boxes.slice(0, index).concat(split, boxes.slice(index + 1));
    if (++guard > 4096) break;
  }

  return uniqueColors(boxes, space);
}

/**
 * @param {number} id
 * @param {HistogramBin[]} bins
 * @param {'oklab'|'srgb'} space
 * @returns {Box}
 */
function makeBox(id, bins, space) {
  let weight = 0;
  let mx = 0;
  let my = 0;
  let mz = 0;

  for (const bin of bins) {
    const coords = coordsOf(bin, space);
    const w = bin.weight;
    weight += w;
    mx += coords[0] * w;
    my += coords[1] * w;
    mz += coords[2] * w;
  }

  if (weight > 0) {
    mx /= weight;
    my /= weight;
    mz /= weight;
  }

  let sx = 0;
  let sy = 0;
  let sz = 0;
  for (const bin of bins) {
    const coords = coordsOf(bin, space);
    const w = bin.weight;
    const dx = coords[0] - mx;
    const dy = coords[1] - my;
    const dz = coords[2] - mz;
    sx += w * dx * dx;
    sy += w * dy * dy;
    sz += w * dz * dz;
  }

  return {
    id,
    bins,
    weight,
    mean: [mx, my, mz],
    sse: [sx, sy, sz],
    unsplittable: bins.length < 2,
  };
}

/**
 * @param {Box[]} boxes
 * @returns {number} index of the best splittable box, or -1
 */
function bestSplittableIndex(boxes) {
  let best = -1;
  let bestScore = -1;
  for (let i = 0; i < boxes.length; i++) {
    const box = boxes[i];
    if (box.unsplittable || box.bins.length < 2) continue;
    const score = box.sse[0] + box.sse[1] + box.sse[2];
    if (score > bestScore || (score === bestScore && (best < 0 || box.id < boxes[best].id))) {
      best = i;
      bestScore = score;
    }
  }
  return best;
}

/**
 * @param {Box} box
 * @param {'oklab'|'srgb'} space
 * @param {number} nextId
 * @returns {[Box, Box] | null}
 */
function splitBox(box, space, nextId) {
  const axes = [0, 1, 2].sort((a, b) => box.sse[b] - box.sse[a] || a - b);

  for (const axis of axes) {
    const sorted = box.bins
      .slice()
      .sort((a, b) => coordsOf(a, space)[axis] - coordsOf(b, space)[axis] || a.bin - b.bin);

    const total = box.weight;
    let cumulative = 0;
    let splitAt = -1;
    for (let i = 0; i < sorted.length - 1; i++) {
      cumulative += sorted[i].weight;
      if (cumulative >= total / 2) {
        splitAt = i + 1;
        break;
      }
    }
    if (splitAt <= 0 || splitAt >= sorted.length) splitAt = Math.floor(sorted.length / 2);
    if (splitAt <= 0 || splitAt >= sorted.length) continue;

    return [
      makeBox(nextId, sorted.slice(0, splitAt), space),
      makeBox(nextId + 1, sorted.slice(splitAt), space),
    ];
  }

  return null;
}

/**
 * @param {Box[]} boxes
 * @param {'oklab'|'srgb'} space
 * @returns {{ r:number, g:number, b:number, weight:number }[]}
 */
function uniqueColors(boxes, space) {
  /** @type {Map<number, { r:number, g:number, b:number, weight:number }>} */
  const byColor = new Map();
  for (const box of boxes) {
    const rgb = meanToRgb(box.mean, space);
    const key = (rgb.r << 16) | (rgb.g << 8) | rgb.b;
    const existing = byColor.get(key);
    if (existing) existing.weight += box.weight;
    else byColor.set(key, { ...rgb, weight: box.weight });
  }
  return [...byColor.values()];
}

/**
 * @param {HistogramBin} bin
 * @param {'oklab'|'srgb'} space
 * @returns {[number, number, number]}
 */
function coordsOf(bin, space) {
  return space === 'oklab'
    ? [bin.oklab.L, bin.oklab.a, bin.oklab.b]
    : [bin.r, bin.g, bin.b];
}

/**
 * @param {[number, number, number]} mean
 * @param {'oklab'|'srgb'} space
 * @returns {{ r:number, g:number, b:number }}
 */
function meanToRgb(mean, space) {
  if (space === 'oklab') {
    return oklabToRgb8(mean[0], mean[1], mean[2]);
  }
  return {
    r: clampByte(mean[0]),
    g: clampByte(mean[1]),
    b: clampByte(mean[2]),
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
