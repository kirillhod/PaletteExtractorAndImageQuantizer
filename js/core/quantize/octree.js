// @ts-check
import { histogramBins } from '../histogram.js';

/** @typedef {import('../types.js').Histogram} Histogram */

/**
 * @typedef {Object} OctreeNode
 * @property {number} id
 * @property {OctreeNode|null} parent
 * @property {OctreeNode[]} children
 * @property {number} weight
 * @property {number} sumR
 * @property {number} sumG
 * @property {number} sumB
 * @property {boolean} isLeaf
 * @property {boolean} removed
 * @property {number} depth
 */

/**
 * Streaming-style octree quantizer. Depth 5 over the 5-bit histogram. Leaves are
 * reduced by repeatedly removing the lightest leaf; a parent becomes a leaf when its
 * last active child is removed.
 *
 * @param {Histogram} hist
 * @param {{ colors: number }} params
 */
export function extractOctree(hist, params) {
  const colors = normalizeLimit(params.colors);
  const bins = histogramBins(hist);
  if (!bins.length) return [];

  let nextId = 0;
  /** @param {OctreeNode|null} parent @param {number} depth @returns {OctreeNode} */
  function node(parent, depth) {
    return {
      id: nextId++,
      parent,
      children: [],
      weight: 0,
      sumR: 0,
      sumG: 0,
      sumB: 0,
      isLeaf: false,
      removed: false,
      depth,
    };
  }

  const root = node(null, 0);
  /** @type {OctreeNode[]} */
  const leaves = [];

  for (const bin of bins) {
    let current = root;
    for (let bit = 4; bit >= 0; bit--) {
      const childIndex = (((bin.r >> 3) >> bit) & 1) * 4 + (((bin.g >> 3) >> bit) & 1) * 2 + (((bin.b >> 3) >> bit) & 1);
      let child = current.children[childIndex];
      if (!child) {
        child = node(current, current.depth + 1);
        current.children[childIndex] = child;
      }
      current = child;
    }

    // Accumulate on every node so a parent already holds its subtree's totals.
    let walk = /** @type {OctreeNode|null} */ (current);
    while (walk) {
      walk.weight += bin.weight;
      walk.sumR += bin.r * bin.weight;
      walk.sumG += bin.g * bin.weight;
      walk.sumB += bin.b * bin.weight;
      walk = walk.parent;
    }
    if (!current.isLeaf) {
      current.isLeaf = true;
      leaves.push(current);
    }
  }

  const heap = new MinHeap((a, b) => a.weight - b.weight || a.id - b.id);
  for (const leaf of leaves) heap.push(leaf);
  let leafCount = leaves.length;

  while (leafCount > colors && heap.size > 0) {
    const leaf = heap.pop();
    if (!leaf || leaf.removed || !leaf.isLeaf) continue;
    const parent = leaf.parent;
    if (!parent) break;

    leaf.removed = true;
    leaf.isLeaf = false;
    leafCount--;

    const activeSibling = parent.children.some((child) => child && !child.removed);
    if (!activeSibling) {
      parent.isLeaf = true;
      heap.push(parent);
      leafCount++;
    }
  }

  return collectLeaves(root)
    .filter((leaf) => leaf.weight > 0)
    .map((leaf) => ({
      r: clampByte(leaf.sumR / leaf.weight),
      g: clampByte(leaf.sumG / leaf.weight),
      b: clampByte(leaf.sumB / leaf.weight),
      weight: leaf.weight,
    }));
}

/**
 * @param {OctreeNode} node
 * @returns {OctreeNode[]}
 */
function collectLeaves(node) {
  if (node.removed) return [];
  if (node.isLeaf) return [node];
  /** @type {OctreeNode[]} */
  const out = [];
  for (const child of node.children) {
    if (child) out.push(...collectLeaves(child));
  }
  return out;
}

class MinHeap {
  /**
   * @param {(a: OctreeNode, b: OctreeNode) => number} compare
   */
  constructor(compare) {
    this.compare = compare;
    /** @type {OctreeNode[]} */
    this.items = [];
  }

  get size() {
    return this.items.length;
  }

  /** @param {OctreeNode} value */
  push(value) {
    this.items.push(value);
    this.up(this.items.length - 1);
  }

  /** @returns {OctreeNode|undefined} */
  pop() {
    if (this.items.length === 0) return undefined;
    const first = this.items[0];
    const last = this.items.pop();
    if (this.items.length > 0 && last) {
      this.items[0] = last;
      this.down(0);
    }
    return first;
  }

  /** @param {number} index */
  up(index) {
    while (index > 0) {
      const parent = (index - 1) >> 1;
      if (this.compare(this.items[index], this.items[parent]) >= 0) break;
      [this.items[index], this.items[parent]] = [this.items[parent], this.items[index]];
      index = parent;
    }
  }

  /** @param {number} index */
  down(index) {
    const length = this.items.length;
    while (true) {
      let smallest = index;
      const left = index * 2 + 1;
      const right = left + 1;
      if (left < length && this.compare(this.items[left], this.items[smallest]) < 0) smallest = left;
      if (right < length && this.compare(this.items[right], this.items[smallest]) < 0) smallest = right;
      if (smallest === index) break;
      [this.items[index], this.items[smallest]] = [this.items[smallest], this.items[index]];
      index = smallest;
    }
  }
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
