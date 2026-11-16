// @ts-check
import test from 'node:test';
import assert from 'node:assert/strict';

import { deltaE00, rgb8ToLab, rgb8ToOklab } from '../js/core/color.js';
import {
  createPalette,
  setPaletteLock,
  sortPalette,
} from '../js/core/palette.js';

const colors = [
  { r: 10, g: 10, b: 10 },
  { r: 240, g: 240, b: 240 },
  { r: 220, g: 20, b: 20 },
  { r: 20, g: 160, b: 20 },
  { r: 20, g: 20, b: 220 },
  { r: 200, g: 180, b: 20 },
  { r: 120, g: 120, b: 120 },
  { r: 30, g: 80, b: 200 },
  { r: 210, g: 80, b: 30 },
  { r: 80, g: 40, b: 120 },
];

const palette = createPalette(colors);
const modes = /** @type {const} */ ([
  'perceptual',
  'perceptual-path',
  'perceptual-flow',
]);

/**
 * @param {import('../js/core/types.js').PaletteEntry} a
 * @param {import('../js/core/types.js').PaletteEntry} b
 */
function distance(a, b) {
  return deltaE00(
    rgb8ToLab(a.color.r, a.color.g, a.color.b),
    rgb8ToLab(b.color.r, b.color.g, b.color.b),
  );
}

/**
 * @param {import('../js/core/types.js').Palette} ordered
 */
function adjacentCost(ordered) {
  let sum = 0;
  for (let index = 0; index + 1 < ordered.length; index++) {
    sum += distance(ordered[index], ordered[index + 1]);
  }
  return sum;
}

/**
 * @param {import('../js/core/types.js').Palette} ordered
 */
function lightness(ordered) {
  return ordered.map((entry) => rgb8ToOklab(entry.color.r, entry.color.g, entry.color.b).L);
}

test('perceptual modes are deterministic and preserve ids and indices', () => {
  const before = palette.map((entry) => entry.hex);
  for (const mode of modes) {
    const first = sortPalette(palette, mode);
    const second = sortPalette(palette, mode);
    assert.deepEqual(first, second);
    assert.deepEqual(
      first.map((entry) => entry.id).sort((a, b) => a - b),
      palette.map((entry) => entry.id),
    );
    assert.deepEqual(first.map((entry) => entry.index), palette.map((_, index) => index));
    assert.deepEqual(
      first.map((entry) => entry.hex).sort(),
      palette.map((entry) => entry.hex).sort(),
    );
  }
  assert.deepEqual(palette.map((entry) => entry.hex), before);
});

test('perceptual and perceptual-path keep the dark-to-light endpoints', () => {
  for (const mode of /** @type {const} */ (['perceptual', 'perceptual-path'])) {
    const ordered = sortPalette(palette, mode);
    const values = lightness(ordered);
    assert.equal(values[0], Math.min(...values));
    assert.equal(values[values.length - 1], Math.max(...values));
  }
});

test('perceptual-flow orients the cut path from dark to light', () => {
  const ordered = sortPalette(palette, 'perceptual-flow');
  const values = lightness(ordered);
  assert.ok(values[0] <= values[values.length - 1]);
});

test('perceptual modes reduce the adjacent CIEDE2000 cost of the lightness order', () => {
  const baseline = adjacentCost(sortPalette(palette, 'lightness-asc'));
  for (const mode of modes) {
    const cost = adjacentCost(sortPalette(palette, mode));
    assert.ok(cost <= baseline + 1e-9, `${mode}: ${cost} > ${baseline}`);
  }
});

test('perceptual-flow cuts the largest edge of its cycle', () => {
  const ordered = sortPalette(palette, 'perceptual-flow');
  const cut = distance(ordered[ordered.length - 1], ordered[0]);
  for (let index = 0; index + 1 < ordered.length; index++) {
    assert.ok(cut >= distance(ordered[index], ordered[index + 1]) - 1e-9);
  }
});

test('locked entries keep their slot in every perceptual mode', () => {
  const locked = setPaletteLock(palette, palette[2].id, true);
  for (const mode of modes) {
    const ordered = sortPalette(locked, mode);
    assert.equal(ordered[2].id, palette[2].id);
    assert.deepEqual(
      ordered.map((entry) => entry.id).sort((a, b) => a - b),
      palette.map((entry) => entry.id),
    );
  }
});

test('perceptual modes handle one, two, and 256 colors', () => {
  const single = createPalette([{ r: 12, g: 34, b: 56 }]);
  const pair = createPalette([
    { r: 240, g: 240, b: 240 },
    { r: 10, g: 10, b: 10 },
  ]);
  const many = createPalette(
    Array.from({ length: 256 }, (_, index) => ({
      r: (index * 37) % 256,
      g: (index * 73) % 256,
      b: (index * 109) % 256,
    })),
  );

  for (const mode of modes) {
    assert.deepEqual(sortPalette(single, mode).map((entry) => entry.id), [1]);
    const orderedPair = sortPalette(pair, mode);
    assert.deepEqual(
      orderedPair.map((entry) => entry.id).sort((a, b) => a - b),
      [1, 2],
    );
    const orderedMany = sortPalette(many, mode);
    assert.equal(orderedMany.length, 256);
    assert.equal(new Set(orderedMany.map((entry) => entry.id)).size, 256);
  }
});
