// @ts-check
import test from 'node:test';
import assert from 'node:assert/strict';

import { createPalette } from '../js/core/palette.js';
import { buildNearestLut, mapPixels } from '../js/core/map.js';
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

test('the 6-bit LUT has 262144 entries and is deterministic', () => {
  const a = buildNearestLut(palette, { space: 'oklab', bits: 6 });
  const b = buildNearestLut(palette, { space: 'oklab', bits: 6 });
  assert.equal(a.size, 262144);
  assert.deepEqual(a.nearest, b.nearest);
});
