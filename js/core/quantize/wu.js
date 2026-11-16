// @ts-check
import { histogramBins } from '../histogram.js';
import { oklabToRgb8 } from '../color.js';

/** @typedef {import('../types.js').Histogram} Histogram */
/** @typedef {import('../types.js').HistogramBin} HistogramBin */

const GRID = 32;
const STRIDE = 33;
const SIZE = STRIDE * STRIDE * STRIDE;
const MIN_SPAN = 1e-4;

/**
 * @param {number} x
 * @param {number} y
 * @param {number} z
 */
function index(x, y, z) {
  return (x * STRIDE + y) * STRIDE + z;
}

/**
 * Moment-based Wu quantizer over a 3D grid in the selected working space.
 * sRGB uses the 5-bit histogram grid (0..255 in 32 steps); Oklab normalizes the
 * occupied L, a, b ranges onto the same 32 steps. The grid is only a splitting
 * structure; moments use the actual coordinates, and an occupancy prefix keeps
 * floating-point residuals from turning an empty box into a color.
 *
 * @param {Histogram} hist
 * @param {{ colors: number, space: 'oklab'|'srgb' }} params
 */
export function extractWu(hist, params) {
  const colors = normalizeLimit(params.colors);
  const space = params.space;
  const bins = histogramBins(hist);
  if (!bins.length) return [];
  const bounds = gridBounds(bins, space);

  const w = new Float64Array(SIZE);
  const sL = new Float64Array(SIZE);
  const sa = new Float64Array(SIZE);
  const sb = new Float64Array(SIZE);
  const sLL = new Float64Array(SIZE);
  const saa = new Float64Array(SIZE);
  const sbb = new Float64Array(SIZE);
  const sLa = new Float64Array(SIZE);
  const sLb = new Float64Array(SIZE);
  const sab = new Float64Array(SIZE);
  // Occupancy per grid cell. Inclusion–exclusion over the weight prefix can leave a
  // tiny positive residual for an empty box; a count prefix identifies empty boxes
  // exactly, so they never contribute a mean or block the split loop.
  const cells = new Int32Array(SIZE);

  for (const bin of bins) {
    const { x, y, z, coords } = gridOf(bin, space, bounds);
    const i = index(x + 1, y + 1, z + 1);
    const weight = bin.weight;
    const [a, b, c] = coords;
    cells[i] += 1;
    w[i] += weight;
    sL[i] += weight * a;
    sa[i] += weight * b;
    sb[i] += weight * c;
    sLL[i] += weight * a * a;
    saa[i] += weight * b * b;
    sbb[i] += weight * c * c;
    sLa[i] += weight * a * b;
    sLb[i] += weight * a * c;
    sab[i] += weight * b * c;
  }

  prefix(w);
  prefix(sL);
  prefix(sa);
  prefix(sb);
  prefix(sLL);
  prefix(saa);
  prefix(sbb);
  prefix(sLa);
  prefix(sLb);
  prefix(sab);
  prefix(cells);

  const moments = { w, sL, sa, sb, sLL, saa, sbb, sLa, sLb, sab, cells };

  /**
   * @typedef {{ id:number, x0:number, y0:number, z0:number, x1:number, y1:number, z1:number, splittable:boolean }} WuBox
   */
  /** @type {WuBox} */
  let full = { id: 0, x0: 0, y0: 0, z0: 0, x1: GRID - 1, y1: GRID - 1, z1: GRID - 1, splittable: true };
  /** @type {WuBox[]} */
  let boxes = [full];
  let nextId = 1;
  let guard = 0;

  while (guard++ < 4096) {
    const unique = uniqueColors(boxes, moments, space);
    if (unique.length >= colors) break;

    let bestIndex = -1;
    let bestVariance = -1;
    for (let i = 0; i < boxes.length; i++) {
      const box = boxes[i];
      if (!box.splittable) continue;
      const m = boxMoments(box, moments);
      if (m.weight <= 0) continue;
      if (m.variance > bestVariance || (m.variance === bestVariance && (bestIndex < 0 || box.id < boxes[bestIndex].id))) {
        bestIndex = i;
        bestVariance = m.variance;
      }
    }
    if (bestIndex < 0) break;

    const box = boxes[bestIndex];
    const split = splitBox(box, moments, nextId);
    if (!split) {
      box.splittable = false;
      continue;
    }
    nextId += 2;
    boxes = boxes.slice(0, bestIndex).concat(split, boxes.slice(bestIndex + 1));
  }

  return uniqueColors(boxes, moments, space);
}

/**
 * Grid bounds for the working space. sRGB already has one grid cell per 5-bit bin, so
 * it needs no normalization. Oklab has no such grid: the full gamut spans roughly
 * L 0..1 and a,b -0.4..0.4, which collapses a narrow hue or lightness range into a few
 * cells. Map the occupied range onto the grid instead, so a monochrome or single-hue
 * image can still split up to K boxes. A degenerate span is grown around its center.
 *
 * @param {HistogramBin[]} bins
 * @param {'oklab'|'srgb'} space
 * @returns {{ L: AxisBounds, a: AxisBounds, b: AxisBounds } | null}
 */
function gridBounds(bins, space) {
  if (space !== 'oklab') return null;
  let minL = Infinity;
  let maxL = -Infinity;
  let minA = Infinity;
  let maxA = -Infinity;
  let minB = Infinity;
  let maxB = -Infinity;
  for (const bin of bins) {
    const { L, a, b } = bin.oklab;
    if (L < minL) minL = L;
    if (L > maxL) maxL = L;
    if (a < minA) minA = a;
    if (a > maxA) maxA = a;
    if (b < minB) minB = b;
    if (b > maxB) maxB = b;
  }
  return { L: axisBounds(minL, maxL), a: axisBounds(minA, maxA), b: axisBounds(minB, maxB) };
}

/**
 * @typedef {{ min:number, size:number }} AxisBounds
 */

/**
 * @param {number} min
 * @param {number} max
 * @returns {AxisBounds}
 */
function axisBounds(min, max) {
  const span = max - min;
  if (span >= MIN_SPAN) return { min, size: span };
  const grow = (MIN_SPAN - span) / 2;
  return { min: min - grow, size: MIN_SPAN };
}

/**
 * @param {HistogramBin} bin
 * @param {'oklab'|'srgb'} space
 * @param {{ L: AxisBounds, a: AxisBounds, b: AxisBounds } | null} bounds
 */
function gridOf(bin, space, bounds) {
  if (space === 'oklab' && bounds) {
    const { L, a, b } = bin.oklab;
    return {
      x: clampGrid(Math.floor(((L - bounds.L.min) / bounds.L.size) * GRID)),
      y: clampGrid(Math.floor(((a - bounds.a.min) / bounds.a.size) * GRID)),
      z: clampGrid(Math.floor(((b - bounds.b.min) / bounds.b.size) * GRID)),
      coords: [L, a, b],
    };
  }
  return {
    x: bin.r >> 3,
    y: bin.g >> 3,
    z: bin.b >> 3,
    coords: [bin.r, bin.g, bin.b],
  };
}

/**
 * @param {number} value
 */
function clampGrid(value) {
  return value < 0 ? 0 : value >= GRID ? GRID - 1 : value;
}

/**
 * @param {Float64Array|Int32Array} array
 */
function prefix(array) {
  for (let x = 1; x <= GRID; x++) {
    for (let y = 1; y <= GRID; y++) {
      for (let z = 1; z <= GRID; z++) {
        const i = index(x, y, z);
        array[i] +=
          array[index(x - 1, y, z)] +
          array[index(x, y - 1, z)] +
          array[index(x, y, z - 1)] -
          array[index(x - 1, y - 1, z)] -
          array[index(x - 1, y, z - 1)] -
          array[index(x, y - 1, z - 1)] +
          array[index(x - 1, y - 1, z - 1)];
      }
    }
  }
}

/**
 * @param {{ x0:number,y0:number,z0:number,x1:number,y1:number,z1:number }} box
 * @param {{ w:Float64Array,sL:Float64Array,sa:Float64Array,sb:Float64Array,sLL:Float64Array,saa:Float64Array,sbb:Float64Array,sLa:Float64Array,sLb:Float64Array,sab:Float64Array,cells:Int32Array }} m
 */
function boxMoments(box, m) {
  if (boxCellCount(box, m) <= 0) {
    return { weight: 0, L: 0, a: 0, b: 0, variance: 0 };
  }
  const weight = boxSum(m.w, box);
  if (weight <= 0) {
    return { weight: 0, L: 0, a: 0, b: 0, variance: 0 };
  }
  const sL = boxSum(m.sL, box);
  const sa = boxSum(m.sa, box);
  const sb = boxSum(m.sb, box);
  const sLL = boxSum(m.sLL, box);
  const saa = boxSum(m.saa, box);
  const sbb = boxSum(m.sbb, box);
  const sLa = boxSum(m.sLa, box);
  const sLb = boxSum(m.sLb, box);
  const sab = boxSum(m.sab, box);

  const mL = sL / weight;
  const ma = sa / weight;
  const mb = sb / weight;
  const variance =
    sLL - (sL * sL) / weight +
    saa - (sa * sa) / weight +
    sbb - (sb * sb) / weight;

  // Keep the unused cross terms referenced so the moment set stays explicit and
  // documents the full 3D covariance structure used by Wu's method.
  void sLa;
  void sLb;
  void sab;

  return { weight, L: mL, a: ma, b: mb, variance: Math.max(0, variance) };
}

/**
 * @param {Float64Array|Int32Array} array
 * @param {{ x0:number,y0:number,z0:number,x1:number,y1:number,z1:number }} box
 */
function boxSum(array, box) {
  const x0 = box.x0;
  const y0 = box.y0;
  const z0 = box.z0;
  const x1 = box.x1 + 1;
  const y1 = box.y1 + 1;
  const z1 = box.z1 + 1;
  return (
    array[index(x1, y1, z1)] -
    array[index(x0, y1, z1)] -
    array[index(x1, y0, z1)] -
    array[index(x1, y1, z0)] +
    array[index(x0, y0, z1)] +
    array[index(x0, y1, z0)] +
    array[index(x1, y0, z0)] -
    array[index(x0, y0, z0)]
  );
}

/**
 * Occupied bins inside a box. Exact, unlike the weight residual left by
 * inclusion–exclusion over floating-point weights.
 *
 * @param {{ x0:number,y0:number,z0:number,x1:number,y1:number,z1:number }} box
 * @param {{ cells:Int32Array }} m
 */
function boxCellCount(box, m) {
  return boxSum(m.cells, box);
}

/**
 * @param {{ id:number,x0:number,y0:number,z0:number,x1:number,y1:number,z1:number,splittable:boolean }} box
 * @param {{ w:Float64Array,sL:Float64Array,sa:Float64Array,sb:Float64Array,sLL:Float64Array,saa:Float64Array,sbb:Float64Array,sLa:Float64Array,sLb:Float64Array,sab:Float64Array,cells:Int32Array }} m
 * @param {number} nextId
 */
function splitBox(box, m, nextId) {
  const base = boxMoments(box, m);
  let best = null;

  for (let axis = 0; axis < 3; axis++) {
    const lo = axis === 0 ? box.x0 : axis === 1 ? box.y0 : box.z0;
    const hi = axis === 0 ? box.x1 : axis === 1 ? box.y1 : box.z1;
    for (let cut = lo + 1; cut <= hi; cut++) {
      const left = { ...box, id: nextId };
      const right = { ...box, id: nextId + 1 };
      if (axis === 0) {
        left.x1 = cut - 1;
        right.x0 = cut;
      } else if (axis === 1) {
        left.y1 = cut - 1;
        right.y0 = cut;
      } else {
        left.z1 = cut - 1;
        right.z0 = cut;
      }
      const lm = boxMoments(left, m);
      const rm = boxMoments(right, m);
      if (lm.weight <= 0 || rm.weight <= 0) continue;
      const total = lm.variance + rm.variance;
      if (
        !best ||
        total < best.total - 1e-12 ||
        (Math.abs(total - best.total) <= 1e-12 &&
          (axis < best.axis || (axis === best.axis && cut < best.cut)))
      ) {
        best = { left, right, total, axis, cut };
      }
    }
  }

  if (!best || best.total >= base.variance - 1e-12) return null;
  return [best.left, best.right];
}

/**
 * @param {{ id:number,x0:number,y0:number,z0:number,x1:number,y1:number,z1:number }} box
 * @param {{ w:Float64Array,sL:Float64Array,sa:Float64Array,sb:Float64Array,cells:Int32Array }} m
 * @param {'oklab'|'srgb'} space
 */
function meanColor(box, m, space) {
  if (boxCellCount(box, m) <= 0) return { r: 0, g: 0, b: 0, weight: 0 };
  const weight = boxSum(m.w, box);
  if (weight <= 0) return { r: 0, g: 0, b: 0, weight: 0 };
  const L = boxSum(m.sL, box) / weight;
  const a = boxSum(m.sa, box) / weight;
  const b = boxSum(m.sb, box) / weight;
  if (space === 'oklab') {
    return { ...oklabToRgb8(L, a, b), weight };
  }
  return {
    r: clampByte(L),
    g: clampByte(a),
    b: clampByte(b),
    weight,
  };
}

/**
 * @param {{ id:number,x0:number,y0:number,z0:number,x1:number,y1:number,z1:number }[]} boxes
 * @param {{ w:Float64Array,sL:Float64Array,sa:Float64Array,sb:Float64Array,cells:Int32Array }} m
 * @param {'oklab'|'srgb'} space
 */
function uniqueColors(boxes, m, space) {
  /** @type {Map<number, { r:number,g:number,b:number,weight:number }>} */
  const byColor = new Map();
  for (const box of boxes) {
    const color = meanColor(box, m, space);
    if (color.weight <= 0) continue;
    const key = (color.r << 16) | (color.g << 8) | color.b;
    const existing = byColor.get(key);
    if (existing) existing.weight += color.weight;
    else byColor.set(key, color);
  }
  return [...byColor.values()];
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
