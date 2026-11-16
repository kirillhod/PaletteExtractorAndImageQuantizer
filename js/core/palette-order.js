// @ts-check
import { deltaE00, rgb8ToLab, rgb8ToOklab } from './color.js';

/** @typedef {import('./types.js').Palette} Palette */
/** @typedef {import('./types.js').PaletteEntry} PaletteEntry */
/** @typedef {{ L: number, a: number, b: number }} Lab */
/** @typedef {{ entry: PaletteEntry, id: number, lab: Lab, oklabL: number }} Item */
/** @typedef {'perceptual'|'perceptual-path'|'perceptual-flow'} PerceptualOrder */

const EPSILON = 1e-12;
const MAX_PASSES = 32;

/**
 * Sort a palette by perceptual distance. IDs survive; the caller assigns export
 * indices after merging locked slots.
 *
 * - `perceptual` keeps the lightness direction and removes local jumps with 2-opt.
 * - `perceptual-path` builds a shortest-ish path from the darkest to the lightest
 *   color, then refines it with 2-opt.
 * - `perceptual-flow` builds a cycle, cuts its largest edge, and orients it
 *   dark-to-light; this is the DCCW single-palette idea without LKH.
 *
 * @param {Palette} entries
 * @param {PerceptualOrder} mode
 * @param {Palette} [lightnessSeed]
 * @returns {Palette}
 */
export function perceptualOrder(entries, mode, lightnessSeed) {
  if (entries.length <= 1) return entries.slice();

  const items = entries.map((entry) => ({
    entry,
    id: entry.id,
    lab: rgb8ToLab(entry.color.r, entry.color.g, entry.color.b),
    oklabL: rgb8ToOklab(entry.color.r, entry.color.g, entry.color.b).L,
  }));
  const count = items.length;
  const distances = buildDistances(items);
  let order;

  if (mode === 'perceptual') {
    order = lightnessSeeded(items, distances, lightnessSeed);
  } else if (mode === 'perceptual-path') {
    order = fixedEndpointPath(items, distances);
  } else {
    order = dccwFlow(items, distances);
  }

  return order.map((index) => items[index].entry);
}

/**
 * @param {Item[]} items
 * @returns {Float64Array}
 */
function buildDistances(items) {
  const count = items.length;
  const distances = new Float64Array(count * count);
  for (let i = 0; i < count; i++) {
    for (let j = i + 1; j < count; j++) {
      const value = deltaE00(items[i].lab, items[j].lab);
      distances[i * count + j] = value;
      distances[j * count + i] = value;
    }
  }
  return distances;
}

/**
 * @param {Item[]} items
 * @param {Float64Array} distances
 * @param {Palette | undefined} seed
 * @returns {number[]}
 */
function lightnessSeeded(items, distances, seed) {
  const count = items.length;
  const indexById = new Map(items.map((item, index) => [item.id, index]));
  let order = lightnessOrder(items);

  if (seed && seed.length === count) {
    const seeded = [];
    for (const entry of seed) {
      const index = indexById.get(entry.id);
      if (index === undefined) {
        seeded.length = 0;
        break;
      }
      seeded.push(index);
    }
    if (seeded.length === count) order = seeded;
  }

  return twoOptPath(order, distances, count);
}

/**
 * Oklab lightness is the existing user-facing order, so the fallback seed matches
 * the Lightness sort; the same axis orients the perceptual paths.
 *
 * @param {Item[]} items
 * @returns {number[]}
 */
function lightnessOrder(items) {
  return items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => a.item.oklabL - b.item.oklabL || a.item.id - b.item.id)
    .map(({ index }) => index);
}

/**
 * @param {Item[]} items
 * @param {Float64Array} distances
 * @returns {number[]}
 */
function fixedEndpointPath(items, distances) {
  const count = items.length;
  const { start, end } = endpoints(items);
  const forward = nearestNeighborPath(items, distances, start, end);
  const backward = nearestNeighborPath(items, distances, end, start).reverse();
  twoOptPath(forward, distances, count);
  twoOptPath(backward, distances, count);
  return betterPath(backward, forward, distances, count, items) ? backward : forward;
}

/**
 * @param {Item[]} items
 * @returns {{ start: number, end: number }}
 */
function endpoints(items) {
  let start = 0;
  let end = 0;
  for (let index = 1; index < items.length; index++) {
    if (
      items[index].oklabL < items[start].oklabL - EPSILON ||
      (Math.abs(items[index].oklabL - items[start].oklabL) <= EPSILON &&
        items[index].id < items[start].id)
    ) {
      start = index;
    }
    if (
      items[index].oklabL > items[end].oklabL + EPSILON ||
      (Math.abs(items[index].oklabL - items[end].oklabL) <= EPSILON &&
        items[index].id < items[end].id)
    ) {
      end = index;
    }
  }
  if (start === end) {
    let min = 0;
    let max = 0;
    for (let index = 1; index < items.length; index++) {
      if (items[index].id < items[min].id) min = index;
      if (items[index].id > items[max].id) max = index;
    }
    start = min;
    end = max;
  }
  return { start, end };
}

/**
 * @param {Item[]} items
 * @param {Float64Array} distances
 * @param {number} start
 * @param {number} end
 * @returns {number[]}
 */
function nearestNeighborPath(items, distances, start, end) {
  const count = items.length;
  if (count === 2) return [start, end];
  const used = new Uint8Array(count);
  const order = [start];
  used[start] = 1;
  used[end] = 1;
  let current = start;

  for (let step = 1; step < count - 1; step++) {
    let best = -1;
    let bestDistance = Infinity;
    for (let index = 0; index < count; index++) {
      if (used[index]) continue;
      const distance = distances[current * count + index];
      if (
        distance < bestDistance - EPSILON ||
        (Math.abs(distance - bestDistance) <= EPSILON &&
          (best < 0 || items[index].id < items[best].id))
      ) {
        bestDistance = distance;
        best = index;
      }
    }
    if (best < 0) break;
    order.push(best);
    used[best] = 1;
    current = best;
  }

  order.push(end);
  return order;
}

/**
 * @param {Item[]} items
 * @param {Float64Array} distances
 * @returns {number[]}
 */
function dccwFlow(items, distances) {
  const count = items.length;
  let best = null;
  let bestCost = Infinity;

  for (let start = 0; start < count; start++) {
    const candidate = nearestNeighborCycle(items, distances, start);
    const cost = cycleCost(candidate, distances, count);
    if (
      cost < bestCost - EPSILON ||
      (Math.abs(cost - bestCost) <= EPSILON &&
        (best === null || lexicographicLess(candidate, best, items)))
    ) {
      best = candidate;
      bestCost = cost;
    }
  }

  if (!best) return lightnessOrder(items);
  twoOptCycle(best, distances, count);
  return cutLargestEdge(best, distances, count, items);
}

/**
 * @param {Item[]} items
 * @param {Float64Array} distances
 * @param {number} start
 * @returns {number[]}
 */
function nearestNeighborCycle(items, distances, start) {
  const count = items.length;
  const used = new Uint8Array(count);
  const order = [start];
  used[start] = 1;
  let current = start;

  for (let step = 1; step < count; step++) {
    let best = -1;
    let bestDistance = Infinity;
    for (let index = 0; index < count; index++) {
      if (used[index]) continue;
      const distance = distances[current * count + index];
      if (
        distance < bestDistance - EPSILON ||
        (Math.abs(distance - bestDistance) <= EPSILON &&
          (best < 0 || items[index].id < items[best].id))
      ) {
        bestDistance = distance;
        best = index;
      }
    }
    if (best < 0) break;
    order.push(best);
    used[best] = 1;
    current = best;
  }

  return order;
}

/**
 * @param {number[]} order
 * @param {Float64Array} distances
 * @param {number} count
 * @returns {number}
 */
function cycleCost(order, distances, count) {
  let sum = 0;
  for (let index = 0; index < order.length; index++) {
    const next = (index + 1) % order.length;
    sum += distances[order[index] * count + order[next]];
  }
  return sum;
}

/**
 * @param {number[]} order
 * @param {Float64Array} distances
 * @param {number} count
 * @returns {number}
 */
function pathCost(order, distances, count) {
  let sum = 0;
  for (let index = 0; index + 1 < order.length; index++) {
    sum += distances[order[index] * count + order[index + 1]];
  }
  return sum;
}

/**
 * @param {number[]} candidate
 * @param {number[]} current
 * @param {Float64Array} distances
 * @param {number} count
 * @param {Item[]} items
 * @returns {boolean}
 */
function betterPath(candidate, current, distances, count, items) {
  const candidateCost = pathCost(candidate, distances, count);
  const currentCost = pathCost(current, distances, count);
  if (candidateCost < currentCost - EPSILON) return true;
  if (candidateCost > currentCost + EPSILON) return false;
  return lexicographicLess(candidate, current, items);
}

/**
 * @param {number[]} candidate
 * @param {number[]} current
 * @param {Item[]} items
 * @returns {boolean}
 */
function lexicographicLess(candidate, current, items) {
  const length = Math.min(candidate.length, current.length);
  for (let index = 0; index < length; index++) {
    const candidateId = items[candidate[index]].id;
    const currentId = items[current[index]].id;
    if (candidateId !== currentId) return candidateId < currentId;
  }
  return candidate.length < current.length;
}

/**
 * Improve an open path while keeping its first and last entries fixed.
 *
 * @param {number[]} order
 * @param {Float64Array} distances
 * @param {number} count
 * @returns {number[]}
 */
function twoOptPath(order, distances, count) {
  for (let pass = 0; pass < MAX_PASSES; pass++) {
    let improved = false;
    for (let left = 0; left < count - 2; left++) {
      for (let right = left + 2; right < count - 1; right++) {
        const a = order[left];
        const b = order[left + 1];
        const c = order[right];
        const d = order[right + 1];
        const before = distances[a * count + b] + distances[c * count + d];
        const after = distances[a * count + c] + distances[b * count + d];
        if (after < before - EPSILON) {
          reverseRange(order, left + 1, right);
          improved = true;
        }
      }
    }
    if (!improved) break;
  }
  return order;
}

/**
 * Improve a closed cycle with 2-opt. Reversing the whole cycle is a no-op.
 *
 * @param {number[]} order
 * @param {Float64Array} distances
 * @param {number} count
 * @returns {number[]}
 */
function twoOptCycle(order, distances, count) {
  for (let pass = 0; pass < MAX_PASSES; pass++) {
    let improved = false;
    for (let left = 0; left < count - 1; left++) {
      for (let right = left + 2; right < count; right++) {
        if (left === 0 && right === count - 1) continue;
        const a = order[left];
        const b = order[(left + 1) % count];
        const c = order[right];
        const d = order[(right + 1) % count];
        const before = distances[a * count + b] + distances[c * count + d];
        const after = distances[a * count + c] + distances[b * count + d];
        if (after < before - EPSILON) {
          reverseRange(order, left + 1, right);
          improved = true;
        }
      }
    }
    if (!improved) break;
  }
  return order;
}

/**
 * @param {number[]} order
 * @param {Float64Array} distances
 * @param {number} count
 * @param {Item[]} items
 * @returns {number[]}
 */
function cutLargestEdge(order, distances, count, items) {
  let cut = 0;
  let largest = -1;
  let startId = Infinity;
  let endId = Infinity;

  for (let index = 0; index < count; index++) {
    const a = order[index];
    const b = order[(index + 1) % count];
    const distance = distances[a * count + b];
    const aId = items[a].id;
    const bId = items[b].id;
    if (
      distance > largest + EPSILON ||
      (Math.abs(distance - largest) <= EPSILON &&
        (aId < startId || (aId === startId && bId < endId)))
    ) {
      largest = distance;
      cut = index;
      startId = aId;
      endId = bId;
    }
  }

  const path = order.slice(cut + 1).concat(order.slice(0, cut + 1));
  const first = path[0];
  const last = path[path.length - 1];
  if (
    items[first].oklabL > items[last].oklabL + EPSILON ||
    (Math.abs(items[first].oklabL - items[last].oklabL) <= EPSILON &&
      items[first].id > items[last].id)
  ) {
    path.reverse();
  }
  return path;
}

/**
 * @param {number[]} values
 * @param {number} left
 * @param {number} right
 */
function reverseRange(values, left, right) {
  while (left < right) {
    const swap = values[left];
    values[left] = values[right];
    values[right] = swap;
    left++;
    right--;
  }
}
