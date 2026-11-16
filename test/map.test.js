// @ts-check
import test from 'node:test';
import assert from 'node:assert/strict';

import { createPalette } from '../js/core/palette.js';
import { buildNearestLut, indicesToRgba, mapPixels } from '../js/core/map.js';
import { makeImage } from './helpers.js';

const palette = createPalette([
  { r: 255, g: 0, b: 0 },
  { r: 0, g: 255, b: 0 },
  { r: 0, g: 0, b: 255 },
]);

test('mapper returns exact palette colors for exact inputs', () => {
  const image = makeImage(3, 1, (x) =>
    x === 0
      ? { r: 255, g: 0, b: 0 }
      : x === 1
        ? { r: 0, g: 255, b: 0 }
        : { r: 0, g: 0, b: 255 },
  );
  const mapped = mapPixels(image, palette);
  assert.deepEqual([...mapped.data], [
    255, 0, 0, 255,
    0, 255, 0, 255,
    0, 0, 255, 255,
  ]);
});

test('fully transparent pixels stay transparent', () => {
  const image = makeImage(1, 1, () => ({ r: 12, g: 34, b: 56, a: 0 }));
  const mapped = mapPixels(image, palette);
  assert.deepEqual([...mapped.data], [0, 0, 0, 0]);
});

test('semi-transparent pixels keep their alpha', () => {
  const image = makeImage(1, 1, () => ({ r: 255, g: 0, b: 0, a: 128 }));
  const mapped = mapPixels(image, palette);
  assert.deepEqual([...mapped.data], [255, 0, 0, 128]);
});

test('opaque pixels mapped to the transparent index become transparent in the preview', () => {
  const image = makeImage(3, 1, (x) =>
    x === 0
      ? { r: 255, g: 0, b: 0 }
      : x === 1
        ? { r: 0, g: 255, b: 0 }
        : { r: 0, g: 0, b: 255 },
  );
  const mapped = mapPixels(image, palette, { transparentIndex: 1 });
  assert.deepEqual([...mapped.data], [
    255, 0, 0, 255,
    0, 0, 0, 0,
    0, 0, 255, 255,
  ]);
});

test('the 6-bit LUT has 262144 entries and is deterministic', () => {
  const a = buildNearestLut(palette, { space: 'oklab', bits: 6 });
  const b = buildNearestLut(palette, { space: 'oklab', bits: 6 });
  assert.equal(a.size, 262144);
  assert.deepEqual(a.nearest, b.nearest);
});

test('index maps are opaque unless an alpha source is supplied', () => {
  const source = new Uint8ClampedArray([12, 34, 56, 0, 78, 90, 12, 128]);
  const indices = new Uint8Array([0, 1]);

  const binary = indicesToRgba(indices, 2, 1, palette);
  assert.deepEqual([...binary.data], [
    255, 0, 0, 255,
    0, 255, 0, 255,
  ]);

  const preview = indicesToRgba(indices, 2, 1, palette, { alphaSource: source });
  assert.deepEqual([...preview.data], [
    255, 0, 0, 0,
    0, 255, 0, 128,
  ]);
});

test('the reserved index stays transparent even with an alpha source', () => {
  const source = new Uint8ClampedArray([255, 0, 0, 255, 0, 255, 0, 255]);
  const indices = new Uint8Array([1, 0]);
  const result = indicesToRgba(indices, 2, 1, palette, {
    transparentIndex: 1,
    alphaSource: source,
  });
  assert.deepEqual([...result.data], [
    0, 0, 0, 0,
    255, 0, 0, 255,
  ]);
});

test('index map conversion rejects malformed input', () => {
  assert.throws(() => indicesToRgba(new Uint8Array(3), 2, 2, palette), RangeError);
  assert.throws(() => indicesToRgba(new Uint8Array([0, 1]), 2, 1, palette, {
    alphaSource: new Uint8ClampedArray(4),
  }), RangeError);
  assert.throws(() => indicesToRgba(new Uint8Array([9]), 1, 1, palette), RangeError);
});
