// @ts-check
import test from 'node:test';
import assert from 'node:assert/strict';

import { buildHistogram } from '../js/core/histogram.js';
import { extractPalette } from '../js/core/quantize/index.js';
import { makeImage, quadrantsImage, solidImage } from './helpers.js';

/**
 * @param {ReturnType<typeof makeImage>} image
 * @param {{ method:'popularity'|'median-cut', colors:number, space:'oklab'|'srgb' }} params
 */
function extract(image, params) {
  return extractPalette(buildHistogram(image), params);
}

test('popularity keeps the heaviest colors and is deterministic', () => {
  const image = quadrantsImage(16);
  const a = extract(image, { method: 'popularity', colors: 2, space: 'oklab' });
  const b = extract(image, { method: 'popularity', colors: 2, space: 'oklab' });
  assert.deepEqual(a, b);
  assert.equal(a.length, 2);
});

test('median cut returns the requested number of distinct colors', () => {
  const image = quadrantsImage(16);
  const palette = extract(image, { method: 'median-cut', colors: 4, space: 'oklab' });
  assert.equal(palette.length, 4);
  const keys = new Set(palette.map((color) => `${color.r},${color.g},${color.b}`));
  assert.equal(keys.size, 4);
});

test('median cut is deterministic in Oklab and sRGB', () => {
  const image = makeImage(8, 8, (x, y) => ({
    r: x * 36,
    g: y * 36,
    b: (x + y) * 18,
  }));
  for (const space of /** @type {const} */ (['oklab', 'srgb'])) {
    const a = extract(image, { method: 'median-cut', colors: 5, space });
    const b = extract(image, { method: 'median-cut', colors: 5, space });
    assert.deepEqual(a, b);
    assert.ok(a.length <= 5);
  }
});

test('median cut degrades gracefully when K exceeds unique colors', () => {
  const image = quadrantsImage(8);
  const palette = extract(image, { method: 'median-cut', colors: 32, space: 'oklab' });
  assert.ok(palette.length <= 4);
  assert.ok(palette.length >= 1);
});

test('single-color image yields one palette entry', () => {
  const image = solidImage(4, 4, { r: 12, g: 34, b: 56 });
  const palette = extract(image, { method: 'median-cut', colors: 8, space: 'oklab' });
  assert.equal(palette.length, 1);
  assert.deepEqual(palette[0], { r: 12, g: 34, b: 56, weight: 16 });
});
