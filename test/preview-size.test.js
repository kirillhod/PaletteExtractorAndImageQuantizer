// @ts-check
import test from 'node:test';
import assert from 'node:assert/strict';

import { PREVIEW_FULL_PIXELS, previewSize } from '../js/core/preview-size.js';

test('the preview keeps images at or below the pixel budget', () => {
  assert.deepEqual(previewSize(1500, 900), { width: 1500, height: 900, scaled: false });
  assert.deepEqual(previewSize(2048, 2048), { width: 2048, height: 2048, scaled: false });
  assert.deepEqual(previewSize(512, 512), { width: 512, height: 512, scaled: false });
  assert.deepEqual(previewSize(1, 1), { width: 1, height: 1, scaled: false });
});

test('larger images are scaled by area to fill the budget', () => {
  const cases = [
    [4000, 3000],
    [4096, 4096],
    [8000, 2000],
    [3000, 2000],
    [12000, 9000],
    [16000, 1000],
  ];
  for (const [width, height] of cases) {
    const size = previewSize(width, height);
    assert.equal(size.scaled, true, `${width}x${height}`);
    assert.ok(
      size.width * size.height <= PREVIEW_FULL_PIXELS,
      `${width}x${height} -> ${size.width}x${size.height} over budget`,
    );
    // "About 4 MP" means the result must not be far below the allowance either.
    assert.ok(
      size.width * size.height > PREVIEW_FULL_PIXELS * 0.99,
      `${width}x${height} -> ${size.width}x${size.height} wastes the budget`,
    );
    const aspect = width / height;
    assert.ok(
      Math.abs(size.width / size.height - aspect) < 0.01,
      `${width}x${height} -> ${size.width}x${size.height} aspect drift`,
    );
  }
});

test('the long edge is not fixed at 2048', () => {
  // A 3:2 source fits more than 2048 pixels across under a 4 MP budget.
  const size = previewSize(4000, 3000);
  assert.ok(size.width > 2048, `${size.width}`);
  assert.equal(size.width, 2364);
  assert.equal(size.height, 1773);
  // A wide panorama stays wide instead of being squeezed to a square.
  const wide = previewSize(8000, 2000);
  assert.ok(wide.width > 2048, `${wide.width}`);
  assert.equal(wide.width, 4096);
  assert.equal(wide.height, 1024);
});

test('one pixel over the budget must scale', () => {
  const over = previewSize(2048, 2049);
  assert.equal(over.scaled, true);
  assert.ok(over.width * over.height <= PREVIEW_FULL_PIXELS);
});

test('invalid dimensions are rejected', () => {
  for (const [width, height] of [
    [0, 10],
    [10, 0],
    [-5, 10],
    [10.5, 10],
    [Number.NaN, 10],
    [Number.POSITIVE_INFINITY, 10],
  ]) {
    assert.throws(() => previewSize(width, height), RangeError, `${width}x${height}`);
  }
});
