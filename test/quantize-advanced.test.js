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

test('k-means uses the seed deterministically', () => {
  const image = quadrantsImage(16);
  const a = extract(image, { method: 'kmeans', colors: 3, space: 'oklab', seed: 7, maxIters: 10 });
  const b = extract(image, { method: 'kmeans', colors: 3, space: 'oklab', seed: 7, maxIters: 10 });
  assert.deepEqual(a, b);
});
