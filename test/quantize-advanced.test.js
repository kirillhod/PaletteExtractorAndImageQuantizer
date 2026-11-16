// @ts-check
import test from 'node:test';
import assert from 'node:assert/strict';

import { buildHistogram } from '../js/core/histogram.js';
import { extractPalette } from '../js/core/quantize/index.js';
import { makeImage, quadrantsImage, solidImage } from './helpers.js';

/**
 * @param {ReturnType<typeof makeImage>} image
 * @param {any} params
 */
function extract(image, params) {
  return extractPalette(buildHistogram(image), params);
}

const methods = /** @type {const} */ (['wu', 'octree', 'kmeans']);

for (const method of methods) {
  test(`${method} returns the requested number of colors and is deterministic`, () => {
    const image = quadrantsImage(16);
    const params = { method, colors: 4, space: 'oklab', seed: 0, maxIters: 10 };
    const a = extract(image, params);
    const b = extract(image, params);
    assert.deepEqual(a, b);
    assert.equal(a.length, 4);
    for (const color of a) {
      for (const channel of [color.r, color.g, color.b]) {
        assert.ok(Number.isInteger(channel) && channel >= 0 && channel <= 255);
      }
    }
  });

  test(`${method} degrades gracefully when K exceeds unique colors`, () => {
    const image = quadrantsImage(8);
    const palette = extract(image, { method, colors: 32, space: 'oklab', seed: 1, maxIters: 10 });
    assert.ok(palette.length >= 1);
    assert.ok(palette.length <= 4);
  });

  test(`${method} handles a single-color image`, () => {
    const image = solidImage(4, 4, { r: 12, g: 34, b: 56 });
    const palette = extract(image, { method, colors: 8, space: 'oklab', seed: 1, maxIters: 10 });
    assert.equal(palette.length, 1);
    assert.deepEqual([palette[0].r, palette[0].g, palette[0].b], [12, 34, 56]);
  });
}

test('Wu works in sRGB as well as Oklab', () => {
  const image = makeImage(8, 8, (x, y) => ({ r: x * 36, g: y * 36, b: (x + y) * 18 }));
  const oklab = extract(image, { method: 'wu', colors: 5, space: 'oklab' });
  const srgb = extract(image, { method: 'wu', colors: 5, space: 'srgb' });
  assert.ok(oklab.length <= 5);
  assert.ok(srgb.length <= 5);
});

test('Wu Oklab splits a narrow color range up to K', () => {
  // 23 distinct 5-bit bins that differ mostly in lightness. The fixed full-gamut
  // Oklab grid collapsed them into a few cells, so Wu returned fewer colors and
  // filled the gap with clipped empty-box means.
  const image = makeImage(23, 1, (x) => ({ r: 40 + x * 8, g: 150, b: 70 }));
  const params = { method: 'wu', colors: 16, space: 'oklab' };
  const palette = extract(image, params);
  assert.equal(palette.length, 16);
  for (const color of palette) {
    assert.ok(color.r >= 20 && color.r <= 240, `r ${color.r}`);
    assert.ok(color.g >= 120 && color.g <= 180, `g ${color.g}`);
    assert.ok(color.b >= 40 && color.b <= 100, `b ${color.b}`);
  }
  assert.deepEqual(extract(image, params), palette);
});

test('Wu Oklab handles an almost achromatic range', () => {
  const image = makeImage(16, 1, (x) => {
    const value = 16 + x * 14;
    return { r: value, g: value, b: value };
  });
  const palette = extract(image, { method: 'wu', colors: 8, space: 'oklab' });
  assert.equal(palette.length, 8);
  for (const color of palette) {
    assert.ok(Math.abs(color.r - color.g) <= 2, JSON.stringify(color));
    assert.ok(Math.abs(color.g - color.b) <= 2, JSON.stringify(color));
  }
});

test('Wu Oklab ignores empty boxes left by floating-point moments', () => {
  // Alpha weights are not binary fractions, so inclusion–exclusion leaves a tiny
  // residual for a box with no bins. Without an occupancy check that residual was
  // divided into the moment sums and produced clipped colors such as #000200.
  const image = makeImage(60, 2, (x) => {
    const t = x % 20;
    return {
      r: 30 + t * 6,
      g: 120 + t * 2,
      b: 50 + t,
      a: x < 20 ? 255 : x < 40 ? 128 : 0,
    };
  });
  const params = { method: 'wu', colors: 16, space: 'oklab' };
  const palette = extract(image, params);
  assert.equal(palette.length, 16);
  for (const color of palette) {
    assert.ok(color.r >= 25 && color.r <= 160, `r ${color.r}`);
    assert.ok(color.g >= 110 && color.g <= 170, `g ${color.g}`);
    assert.ok(color.b >= 40 && color.b <= 90, `b ${color.b}`);
  }
  assert.deepEqual(extract(image, params), palette);
});

test('k-means uses the seed deterministically', () => {
  const image = quadrantsImage(16);
  const a = extract(image, { method: 'kmeans', colors: 3, space: 'oklab', seed: 7, maxIters: 10 });
  const b = extract(image, { method: 'kmeans', colors: 3, space: 'oklab', seed: 7, maxIters: 10 });
  assert.deepEqual(a, b);
});
