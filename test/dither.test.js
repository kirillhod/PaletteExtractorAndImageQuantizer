// @ts-check
import test from 'node:test';
import assert from 'node:assert/strict';

import { createPalette } from '../js/core/palette.js';
import { mapIndices } from '../js/core/map.js';
import {
  DITHER_METHODS,
  ditherPixels,
} from '../js/core/dither/index.js';
import {
  BAYER_2,
  BAYER_4,
  BAYER_8,
  ERROR_DIFFUSION_KERNELS,
  bayerMatrix,
} from '../js/core/dither/kernels.js';
import { blueNoiseMask64 } from '../js/core/dither/blue-noise.js';
import { makeImage } from './helpers.js';

const palette = createPalette([
  { r: 0, g: 0, b: 0 },
  { r: 255, g: 255, b: 255 },
  { r: 255, g: 0, b: 0 },
  { r: 0, g: 128, b: 255 },
]);

const image = makeImage(18, 12, (x, y) => ({
  r: Math.round((x / 17) * 255),
  g: Math.round((y / 11) * 255),
  b: 128,
}));

test('error-diffusion kernel sums match the documented fractions', () => {
  const expected = {
    'floyd-steinberg': 1,
    atkinson: 6 / 8,
    stucki: 1,
    jarvis: 1,
    burkes: 1,
    sierra: 1,
  };
  for (const [name, kernel] of Object.entries(ERROR_DIFFUSION_KERNELS)) {
    const sum = kernel.taps.reduce((value, tap) => value + tap.weight, 0) / kernel.denominator;
    assert.ok(Math.abs(sum - expected[name]) < 1e-12, name);
  }
});

test('Bayer matrices match the published 2x2 and 4x4 values', () => {
  assert.deepEqual(BAYER_2, [
    [0, 2],
    [3, 1],
  ]);
  assert.deepEqual(BAYER_4, [
    [0, 8, 2, 10],
    [12, 4, 14, 6],
    [3, 11, 1, 9],
    [15, 7, 13, 5],
  ]);
  assert.equal(new Set(BAYER_8.flat()).size, 64);
  assert.deepEqual(bayerMatrix(8), BAYER_8);
});

test('blue-noise mask is 64x64 and covers the full byte range', () => {
  const mask = blueNoiseMask64();
  assert.equal(mask.length, 4096);
  assert.equal(Math.min(...mask), 0);
  assert.equal(Math.max(...mask), 255);
});

test('every dither method is deterministic and palette-compliant', () => {
  for (const method of DITHER_METHODS) {
    const a = ditherPixels(image, palette, {
      method,
      space: 'oklab',
      strength: 0.8,
      serpentine: true,
      edgeStop: 0.5,
      transparentIndex: -1,
    });
    const b = ditherPixels(image, palette, {
      method,
      space: 'oklab',
      strength: 0.8,
      serpentine: true,
      edgeStop: 0.5,
      transparentIndex: -1,
    });
    assert.deepEqual(a.indices, b.indices, method);
    assert.equal(a.indices.length, image.width * image.height, method);
    for (const index of a.indices) assert.ok(index < palette.length, method);
  }
});

test('strength 0 reduces ordered and error diffusion to the LUT nearest mapping', () => {
  const nearest = mapIndices(image, palette, { space: 'oklab', exact: false });
  for (const method of /** @type {const} */ (['floyd-steinberg', 'bayer4', 'blue-noise'])) {
    const dithered = ditherPixels(image, palette, {
      method,
      space: 'oklab',
      strength: 0,
      serpentine: true,
      edgeStop: 0.5,
      transparentIndex: -1,
    });
    assert.deepEqual(dithered.indices, nearest.indices, method);
  }
});

test('transparent pixels use the reserved index', () => {
  const alphaImage = makeImage(2, 1, (x) =>
    x === 0
      ? { r: 255, g: 0, b: 0, a: 0 }
      : { r: 0, g: 0, b: 0, a: 255 },
  );
  for (const method of DITHER_METHODS) {
    const result = ditherPixels(alphaImage, palette, {
      method,
      space: 'oklab',
      strength: 0.8,
      transparentIndex: 0,
    });
    assert.equal(result.indices[0], 0, method);
  }
});

test('error diffusion keeps the average tone of a flat field', () => {
  // A working nearest-color table must keep the mean: mid-gray under a black/white palette
  // becomes about 60% white in Oklab (L(128,128,128) = 0.6), not one flat color.
  const gray = makeImage(32, 32, () => ({ r: 128, g: 128, b: 128 }));
  const blackWhite = createPalette([
    { r: 0, g: 0, b: 0 },
    { r: 255, g: 255, b: 255 },
  ]);
  const result = ditherPixels(gray, blackWhite, {
    method: 'floyd-steinberg',
    space: 'oklab',
    strength: 1,
    serpentine: true,
    edgeStop: 0,
    transparentIndex: -1,
  });
  const whitePixels = result.indices.reduce((sum, index) => sum + index, 0);
  const share = whitePixels / result.indices.length;
  assert.ok(share > 0.55 && share < 0.7, `white share ${share.toFixed(3)}`);
});

test('error diffusion follows a gradient instead of collapsing to one entry', () => {
  const ramp = makeImage(48, 8, (x) => {
    const value = Math.round((x / 47) * 255);
    return { r: value, g: value, b: value };
  });
  const blackWhite = createPalette([
    { r: 0, g: 0, b: 0 },
    { r: 255, g: 255, b: 255 },
  ]);
  const result = ditherPixels(ramp, blackWhite, {
    method: 'floyd-steinberg',
    space: 'oklab',
    strength: 1,
    serpentine: true,
    edgeStop: 0,
    transparentIndex: -1,
  });
  const counts = (from, to) => {
    const total = [0, 0];
    for (let y = 0; y < 8; y++) {
      for (let x = from; x < to; x++) total[result.indices[y * 48 + x]]++;
    }
    return total;
  };
  const left = counts(0, 16);
  const middle = counts(16, 32);
  const right = counts(32, 48);
  assert.ok(left[0] > left[1] * 2, `left ${left}`);
  assert.ok(right[1] > right[0] * 2, `right ${right}`);
  assert.ok(middle[0] > 0 && middle[1] > 0, `middle ${middle}`);
});
