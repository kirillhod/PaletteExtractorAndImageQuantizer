// @ts-check
import { oklabToRgb8 } from '../color.js';
import { buildMapper, coordsOf } from '../map.js';
import { getErrorDiffusionKernel } from './kernels.js';

/**
 * @param {import('../types.js').ImageDataLite} image
 * @param {import('../types.js').Palette} palette
 * @param {{
 *   space?: 'oklab'|'srgb',
 *   method?: string,
 *   strength?: number,
 *   serpentine?: boolean,
 *   edgeStop?: number,
 *   alphaThreshold?: number,
 *   transparentIndex?: number,
 *   mapper?: import('../map.js').Mapper,
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

  const { data, width, height } = image;
  const indices = new Uint8Array(width * height);
  const rowSize = width * 3;
  let rows = [
    new Float32Array(rowSize),
    new Float32Array(rowSize),
    new Float32Array(rowSize),
  ];
  const maxError = space === 'oklab' ? 0.5 : 64;

  for (let y = 0; y < height; y++) {
    const current = rows[0];
    const next1 = rows[1];
    const next2 = rows[2];
    const direction = serpentine && (y & 1) === 1 ? -1 : 1;
    const startX = direction === 1 ? 0 : width - 1;

    for (let step = 0; step < width; step++) {
      const x = startX + step * direction;
      const p = y * width + x;
      const i = p * 4;
      const alpha = data[i + 3];

      if (alpha === 0) {
        indices[p] = transparentIndex >= 0 ? transparentIndex : 0;
        continue;
      }
      if (alpha < alphaThreshold && transparentIndex >= 0) {
        indices[p] = transparentIndex;
        continue;
      }

      const source = coordsOf({ r: data[i], g: data[i + 1], b: data[i + 2], a: alpha }, space);
      const corrected = [
        source.L + current[x * 3],
        source.a + current[x * 3 + 1],
        source.b + current[x * 3 + 2],
      ];
      clampCoords(corrected, space);

      const rgb = space === 'oklab'
        ? oklabToRgb8(corrected[0], corrected[1], corrected[2])
        : { r: clampByte(corrected[0]), g: clampByte(corrected[1]), b: clampByte(corrected[2]) };
      const index = mapper.nearestRgb(rgb.r, rgb.g, rgb.b);
      indices[p] = index;

      const paletteColor = mapper.paletteCoords[index];
      let er = corrected[0] - paletteColor.L;
      let ea = corrected[1] - paletteColor.a;
      let eb = corrected[2] - paletteColor.b;

      const factor = edgeFactor(data, width, height, x, y, edgeStop);
      er *= strength * factor;
      ea *= strength * factor;
      eb *= strength * factor;

      const magnitude = Math.hypot(er, ea, eb);
      if (magnitude > maxError) {
        const scale = maxError / magnitude;
        er *= scale;
        ea *= scale;
        eb *= scale;
      }

      for (const tap of kernel.taps) {
        const nx = x + tap.dx * direction;
        const ny = y + tap.dy;
        if (nx < 0 || nx >= width || ny >= height) continue;
        const target = tap.dy === 0 ? current : tap.dy === 1 ? next1 : next2;
        const offset = nx * 3;
        const weight = tap.weight / kernel.denominator;
        target[offset] += er * weight;
        target[offset + 1] += ea * weight;
        target[offset + 2] += eb * weight;
      }
    }

    current.fill(0);
    rows = [next1, next2, current];
  }

  return { indices, width, height, mapper };
}

/**
 * @param {Uint8ClampedArray} data
 * @param {number} width
 * @param {number} height
 * @param {number} x
 * @param {number} y
 * @param {number} edgeStop
 */
function edgeFactor(data, width, height, x, y, edgeStop) {
  if (edgeStop <= 0) return 1;
  const i = (y * width + x) * 4;
  const right = (y * width + Math.min(width - 1, x + 1)) * 4;
  const down = (Math.min(height - 1, y + 1) * width + x) * 4;
  let gradient = 0;
  for (let c = 0; c < 3; c++) {
    gradient = Math.max(gradient, Math.abs(data[i + c] - data[right + c]));
    gradient = Math.max(gradient, Math.abs(data[i + c] - data[down + c]));
  }
  return 1 - edgeStop * Math.min(1, gradient / 255 / 0.08);
}

/**
 * @param {number[]} coords
 * @param {'oklab'|'srgb'} space
 */
function clampCoords(coords, space) {
  if (space === 'oklab') {
    coords[0] = Math.min(1, Math.max(0, coords[0]));
    coords[1] = Math.min(0.5, Math.max(-0.5, coords[1]));
    coords[2] = Math.min(0.5, Math.max(-0.5, coords[2]));
  } else {
    coords[0] = Math.min(255, Math.max(0, coords[0]));
    coords[1] = Math.min(255, Math.max(0, coords[1]));
    coords[2] = Math.min(255, Math.max(0, coords[2]));
  }
}

/**
 * @param {number} value
 */
function clampByte(value) {
  const rounded = Math.round(value);
  return rounded < 0 ? 0 : rounded > 255 ? 255 : rounded;
}
