// @ts-check
import { buildMapper, mapIndices } from '../map.js';
import { rgb8ToOklab } from '../color.js';
import { getErrorDiffusionKernel } from './kernels.js';

/** @typedef {import('../types.js').ImageDataLite} ImageDataLite */
/** @typedef {import('../types.js').Palette} Palette */
/** @typedef {import('../map.js').Mapper} Mapper */

/**
 * Source samples per RGB axis in the cached working-space grid. 6 bits matches the
 * mapper's own table and stays finer than the histogram.
 */
const SOURCE_LEVELS = 64;
const SOURCE_SHIFT = 8 - Math.log2(SOURCE_LEVELS);
const SOURCE_MASK = SOURCE_LEVELS - 1;
const SOURCE_STEP = 256 / SOURCE_LEVELS;

/**
 * Cells per axis for the corrected-color cache. Oklab has no native grid, so it gets 128
 * steps (finer than one sRGB level); sRGB reuses the mapper's 6-bit grid, which is what
 * the lookup table already rounds to.
 */
const OKLAB_CELL_LEVELS = 128;
const SRGB_CELL_LEVELS = 64;

/** @type {Map<string, Float32Array>} */
const sourceGrids = new Map();

/**
 * Working-space coordinates of every 6-bit source color, built once per space. Converting
 * each pixel with `rgb8ToOklab` costs three cube roots; the decisions downstream already
 * collapse the image to 5-bit bins and 6-bit lookup cells, so a 6-bit source table loses
 * nothing that a per-pixel conversion would keep.
 *
 * @param {'oklab'|'srgb'} space
 * @returns {Float32Array}
 */
function sourceGrid(space) {
  const cached = sourceGrids.get(space);
  if (cached) return cached;
  const grid = new Float32Array(SOURCE_LEVELS * SOURCE_LEVELS * SOURCE_LEVELS * 3);
  const byteOf = (cell) => Math.min(255, Math.round(cell * SOURCE_STEP + SOURCE_STEP / 2));
  let at = 0;
  for (let r = 0; r < SOURCE_LEVELS; r++) {
    for (let g = 0; g < SOURCE_LEVELS; g++) {
      for (let b = 0; b < SOURCE_LEVELS; b++) {
        if (space === 'oklab') {
          const lab = rgb8ToOklab(byteOf(r), byteOf(g), byteOf(b));
          grid[at++] = lab.L;
          grid[at++] = lab.a;
          grid[at++] = lab.b;
        } else {
          grid[at++] = byteOf(r);
          grid[at++] = byteOf(g);
          grid[at++] = byteOf(b);
        }
      }
    }
  }
  sourceGrids.set(space, grid);
  return grid;
}

/**
 * @typedef {Object} WorkingDomain
 * @property {number} max0 Upper bound of the first axis (L or red).
 * @property {number} min1 Lower bound of the other two axes (a,b or green,blue).
 * @property {number} max1 Upper bound of the other two axes.
 * @property {number} span0
 * @property {number} span1
 * @property {number} maxError
 * @property {number} cellLevels
 * @property {number} cellMask
 */

/**
 * @param {'oklab'|'srgb'} space
 * @returns {WorkingDomain}
 */
function workingDomain(space) {
  const cellLevels = space === 'oklab' ? OKLAB_CELL_LEVELS : SRGB_CELL_LEVELS;
  return space === 'oklab'
    ? {
        max0: 1,
        min1: -0.5,
        max1: 0.5,
        span0: 1,
        span1: 1,
        maxError: 0.5,
        cellLevels,
        cellMask: cellLevels - 1,
      }
    : {
        max0: 255,
        min1: 0,
        max1: 255,
        span0: 255,
        span1: 255,
        // sRGB errors are not perceptual distances. The Oklab 0.5 radius would clamp
        // ordinary grayscale errors and flatten shadows and highlights, so the sRGB
        // bound is the channel range: a full black-to-white ramp stays intact while
        // multi-channel runaway is still bounded.
        maxError: 255,
        cellLevels,
        cellMask: cellLevels - 1,
      };
}

/**
 * Error-diffusion dithering.
 *
 * Decisions come from a nearest-color cell grid over the working space instead of a
 * per-pixel conversion plus the 6-bit sRGB lookup: a cell is 1/128 of each axis, finer
 * than the 4 sRGB levels that lookup already collapses, and the pass no longer pays three
 * cube roots and an Oklab-to-sRGB round trip per pixel. Cells are filled on demand and
 * always resolve from their own center, so the result does not depend on visit order.
 *
 * @param {ImageDataLite} image
 * @param {Palette} palette
 * @param {{
 *   space?: 'oklab'|'srgb',
 *   method?: string,
 *   strength?: number,
 *   serpentine?: boolean,
 *   edgeStop?: number,
 *   alphaThreshold?: number,
 *   transparentIndex?: number,
 *   mapper?: Mapper,
 * }} [options]
 */
export function ditherErrorDiffusion(image, palette, options = {}) {
  const space = options.space ?? 'oklab';
  const method = options.method ?? 'floyd-steinberg';
  const strength = options.strength ?? 0.8;
  const serpentine = options.serpentine ?? true;
  const edgeStop = options.edgeStop ?? 0.5;
  const alphaThreshold = options.alphaThreshold ?? 128;
  const transparentIndex = options.transparentIndex ?? -1;
  const mapper = options.mapper ?? buildMapper(palette, { space });
  const kernel = getErrorDiffusionKernel(method);
  if (!kernel) throw new Error(`unsupported error-diffusion kernel: ${method}`);

  // Zero strength means "nearest color only": no error ever leaves a pixel, so answer with
  // the same mapping the plain preview uses. Omitting `exact: false` keeps the exact map
  // for small unique-color images, where the 6-bit LUT can answer a few pixels differently.
  if (strength === 0) {
    const mapped = mapIndices(image, palette, {
      space,
      alphaThreshold,
      transparentIndex,
      mapper,
    });
    return { indices: mapped.indices, width: image.width, height: image.height, mapper };
  }

  const domain = workingDomain(space);
  const source = sourceGrid(space);
  const cellLevels = domain.cellLevels;
  const cellMask = domain.cellMask;
  const cells = new Uint16Array(cellLevels * cellLevels * cellLevels);
  const coords = mapper.paletteCoords;

  const taps = kernel.taps;
  const tapCount = taps.length;
  const dx = new Int32Array(tapCount);
  const dy = new Int32Array(tapCount);
  const weights = new Float64Array(tapCount);
  for (let i = 0; i < tapCount; i++) {
    dx[i] = taps[i].dx;
    dy[i] = taps[i].dy;
    weights[i] = taps[i].weight / kernel.denominator;
  }

  const { data, width, height } = image;
  const indices = new Uint8Array(width * height);
  let rowA = new Float32Array(width * 3);
  let rowB = new Float32Array(width * 3);
  let rowC = new Float32Array(width * 3);
  const { max0, min1, max1, span0, span1, maxError } = domain;
  const maxErrorSq = maxError * maxError;
  const checkEdges = edgeStop > 0;

  for (let y = 0; y < height; y++) {
    const current = rowA;
    const next1 = rowB;
    const next2 = rowC;
    const direction = serpentine && (y & 1) === 1 ? -1 : 1;
    const startX = direction === 1 ? 0 : width - 1;
    const rowOffset = y * width;

    for (let stepX = 0; stepX < width; stepX++) {
      const x = startX + stepX * direction;
      const p = rowOffset + x;
      const i = p << 2;
      const alpha = data[i + 3];
      if (alpha === 0) {
        indices[p] = transparentIndex >= 0 ? transparentIndex : 0;
        continue;
      }
      if (alpha < alphaThreshold && transparentIndex >= 0) {
        indices[p] = transparentIndex;
        continue;
      }

      const sourceAt =
        ((((data[i] >> SOURCE_SHIFT) & SOURCE_MASK) * SOURCE_LEVELS +
          ((data[i + 1] >> SOURCE_SHIFT) & SOURCE_MASK)) *
          SOURCE_LEVELS +
          ((data[i + 2] >> SOURCE_SHIFT) & SOURCE_MASK)) *
        3;
      const o = x * 3;
      let L = source[sourceAt] + current[o];
      let a = source[sourceAt + 1] + current[o + 1];
      let b = source[sourceAt + 2] + current[o + 2];

      if (L < 0) L = 0;
      else if (L > max0) L = max0;
      if (a < min1) a = min1;
      else if (a > max1) a = max1;
      if (b < min1) b = min1;
      else if (b > max1) b = max1;

      let cellL = ((L / span0) * cellLevels) | 0;
      let cellA = (((a - min1) / span1) * cellLevels) | 0;
      let cellB = (((b - min1) / span1) * cellLevels) | 0;
      if (cellL > cellMask) cellL = cellMask;
      if (cellA > cellMask) cellA = cellMask;
      if (cellB > cellMask) cellB = cellMask;
      const cell = (cellL * cellLevels + cellA) * cellLevels + cellB;

      let stored = cells[cell];
      if (stored === 0) {
        const centerL = ((cellL + 0.5) / cellLevels) * span0;
        const centerA = min1 + ((cellA + 0.5) / cellLevels) * span1;
        const centerB = min1 + ((cellB + 0.5) / cellLevels) * span1;
        let best = 0;
        let bestDistance = Infinity;
        for (let k = 0; k < coords.length; k++) {
          const point = coords[k];
          const dL = centerL - point.L;
          const da = centerA - point.a;
          const db = centerB - point.b;
          const distance = dL * dL + da * da + db * db;
          if (distance < bestDistance) {
            bestDistance = distance;
            best = k;
          }
        }
        stored = best + 1;
        cells[cell] = stored;
      }
      const index = stored - 1;
      indices[p] = index;

      const paletteColor = coords[index];
      let er = L - paletteColor.L;
      let ea = a - paletteColor.a;
      let eb = b - paletteColor.b;

      if (checkEdges) {
        const right = (rowOffset + (x + 1 < width ? x + 1 : x)) << 2;
        const down = ((y + 1 < height ? y + 1 : y) * width + x) << 2;
        let gradient = Math.abs(data[i] - data[right]);
        let value = Math.abs(data[i] - data[down]);
        if (value > gradient) gradient = value;
        value = Math.abs(data[i + 1] - data[right + 1]);
        if (value > gradient) gradient = value;
        value = Math.abs(data[i + 1] - data[down + 1]);
        if (value > gradient) gradient = value;
        value = Math.abs(data[i + 2] - data[right + 2]);
        if (value > gradient) gradient = value;
        value = Math.abs(data[i + 2] - data[down + 2]);
        if (value > gradient) gradient = value;
        const factor = 1 - edgeStop * Math.min(1, gradient / 255 / 0.08);
        er *= strength * factor;
        ea *= strength * factor;
        eb *= strength * factor;
      } else {
        er *= strength;
        ea *= strength;
        eb *= strength;
      }

      const magnitudeSq = er * er + ea * ea + eb * eb;
      if (magnitudeSq > maxErrorSq) {
        const scale = maxError / Math.sqrt(magnitudeSq);
        er *= scale;
        ea *= scale;
        eb *= scale;
      }

      for (let t = 0; t < tapCount; t++) {
        const nx = x + dx[t] * direction;
        const ny = y + dy[t];
        if (nx < 0 || nx >= width || ny >= height) continue;
        const target = dy[t] === 0 ? current : dy[t] === 1 ? next1 : next2;
        const offset = nx * 3;
        const w = weights[t];
        target[offset] += er * w;
        target[offset + 1] += ea * w;
        target[offset + 2] += eb * w;
      }
    }

    current.fill(0);
    rowA = next1;
    rowB = next2;
    rowC = current;
  }

  return { indices, width, height, mapper };
}
