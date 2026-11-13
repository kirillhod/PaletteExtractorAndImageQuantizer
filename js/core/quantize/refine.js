// @ts-check
import { histogramBins } from '../histogram.js';
import { coordsOf } from '../map.js';
import { oklabToRgb8 } from '../color.js';

/** @typedef {import('../types.js').Histogram} Histogram */
/** @typedef {import('../types.js').RGBA8} RGBA8 */

/**
 * Lloyd/Voronoi refinement over the extraction histogram. Used after median cut and Wu
 * when `refine` is on (the default for those methods).
 *
 * @param {Histogram} hist
 * @param {RGBA8[]} colors
 * @param {{ space:'oklab'|'srgb', passes?:number }} options
 * @returns {RGBA8[]}
 */
export function refinePalette(hist, colors, options) {
  if (colors.length <= 1) return colors;
  const passes = options.passes ?? 2;
  const bins = histogramBins(hist);
  if (bins.length === 0) return colors;
  const space = options.space;

  /** @type {{ L:number, a:number, b:number }[]} */
  let centroids = colors.map((color) => coordsOf({ ...color, a: color.a ?? 255 }, space));

  for (let pass = 0; pass < passes; pass++) {
    const sums = Array.from({ length: centroids.length }, () => ({
      weight: 0,
      L: 0,
      a: 0,
      b: 0,
    }));

    for (const bin of bins) {
      const point = coordsOf({ r: bin.r, g: bin.g, b: bin.b, a: 255 }, space);
      let best = 0;
      let bestDistance = Infinity;
      for (let i = 0; i < centroids.length; i++) {
        const d = distanceSq(point, centroids[i]);
        if (d < bestDistance) {
          bestDistance = d;
          best = i;
        }
      }
      const weight = bin.weight;
      sums[best].weight += weight;
      sums[best].L += point.L * weight;
      sums[best].a += point.a * weight;
      sums[best].b += point.b * weight;
    }

    centroids = centroids.map((centroid, index) => {
      const sum = sums[index];
      if (sum.weight <= 0) return centroid;
      return {
        L: sum.L / sum.weight,
        a: sum.a / sum.weight,
        b: sum.b / sum.weight,
      };
    });
  }

  /** @type {Map<number, RGBA8>} */
  const unique = new Map();
  for (const centroid of centroids) {
    const rgb = space === 'oklab'
      ? oklabToRgb8(centroid.L, centroid.a, centroid.b)
      : {
          r: clampByte(centroid.L),
          g: clampByte(centroid.a),
          b: clampByte(centroid.b),
        };
    const key = (rgb.r << 16) | (rgb.g << 8) | rgb.b;
    if (!unique.has(key)) unique.set(key, { ...rgb, a: 255 });
  }
  return [...unique.values()];
}

/**
 * @param {{L:number,a:number,b:number}} a
 * @param {{L:number,a:number,b:number}} b
 */
function distanceSq(a, b) {
  const dL = a.L - b.L;
  const da = a.a - b.a;
  const db = a.b - b.b;
  return dL * dL + da * da + db * db;
}

/**
 * @param {number} value
 */
function clampByte(value) {
  const rounded = Math.round(value);
  return rounded < 0 ? 0 : rounded > 255 ? 255 : rounded;
}
