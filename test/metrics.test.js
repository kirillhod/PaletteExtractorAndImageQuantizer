// @ts-check
import test from 'node:test';
import assert from 'node:assert/strict';

import { deltaE00, rgb8ToLab } from '../js/core/color.js';
import { computeQuality } from '../js/core/metrics/index.js';
import { makeImage, solidImage } from './helpers.js';

const RED = { r: 255, g: 0, b: 0 };
const BLUE = { r: 0, g: 0, b: 255 };

test('quality summary reports the mean, p95, and max ΔE00', () => {
  const original = solidImage(4, 4, RED);
  const mapped = solidImage(4, 4, BLUE);
  const expected = deltaE00(rgb8ToLab(RED.r, RED.g, RED.b), rgb8ToLab(BLUE.r, BLUE.g, BLUE.b));
  const result = computeQuality({ original, mapped, width: 4, height: 4 });
  assert.equal(result.pixels, 16);
  assert.ok(Math.abs(result.deltaE00Mean - expected) < 1e-9);
  assert.ok(Math.abs(result.deltaE00Max - expected) < 1e-9);
  assert.ok(Math.abs(result.deltaE00P95 - expected) <= 0.1);
  assert.equal(result.errorMap.width, 4);
  assert.equal(result.errorMap.height, 4);
  assert.equal(result.errorMap.data[3], 255);
});

test('quality skips transparent source and mapped pixels', () => {
  const original = makeImage(3, 1, (x) =>
    x === 0 ? RED : { r: 0, g: 255, b: 0, a: 0 },
  );
  const mapped = makeImage(3, 1, (x) =>
    x === 0 ? BLUE : { r: 0, g: 0, b: 255 },
  );
  const result = computeQuality({ original, mapped, width: 3, height: 1 });
  assert.equal(result.pixels, 1);
  assert.equal(result.errorMap.data[3], 255);
  assert.equal(result.errorMap.data[7], 0);
  assert.equal(result.errorMap.data[11], 0);
});

test('worst pixels keep 20 entries with a (y, x) tie-break', () => {
  const original = solidImage(5, 5, RED);
  const mapped = solidImage(5, 5, BLUE);
  const result = computeQuality({ original, mapped, width: 5, height: 5 });
  assert.equal(result.worstPixels.length, 20);
  assert.deepEqual(
    result.worstPixels.slice(0, 2).map((pixel) => [pixel.x, pixel.y]),
    [[0, 0], [1, 0]],
  );
  assert.deepEqual(
    [result.worstPixels[19].x, result.worstPixels[19].y],
    [4, 3],
  );
});

test('an exact match has zero error', () => {
  const original = solidImage(2, 2, RED);
  const mapped = solidImage(2, 2, RED);
  const result = computeQuality({ original, mapped, width: 2, height: 2 });
  assert.equal(result.deltaE00Mean, 0);
  assert.equal(result.deltaE00P95, 0);
  assert.equal(result.deltaE00Max, 0);
  assert.equal(result.pixels, 4);
});
