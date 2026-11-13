// @ts-check
import test from 'node:test';
import assert from 'node:assert/strict';

import { parseHex, rgb8ToOklab } from '../js/core/color.js';
import { createPalette, sortPalette } from '../js/core/palette.js';

/**
 * @param {string} hex
 */
function lightness(hex) {
  const { r, g, b } = parseHex(hex);
  return rgb8ToOklab(r, g, b).L;
}

const palette = createPalette([
  { r: 255, g: 0, b: 0 }, // red, light
  { r: 0, g: 128, b: 0 }, // green, dark
  { r: 0, g: 0, b: 255 }, // blue
  { r: 128, g: 0, b: 0 }, // red, dark
  { r: 0, g: 255, b: 0 }, // green, light
  { r: 128, g: 128, b: 128 }, // achromatic
]);

test('source order uses stable ids and restores extraction order', () => {
  const sorted = sortPalette(palette, 'hue-asc');
  const restored = sortPalette(sorted, 'source');
  assert.deepEqual(restored.map((entry) => entry.hex), palette.map((entry) => entry.hex));
  assert.deepEqual(restored.map((entry) => entry.index), [0, 1, 2, 3, 4, 5]);
});

test('lightness ascending and descending are monotonic', () => {
  const asc = sortPalette(palette, 'lightness-asc');
  const desc = sortPalette(palette, 'lightness-desc');
  for (let i = 1; i < asc.length; i++) {
    assert.ok(lightness(asc[i - 1].hex) <= lightness(asc[i].hex) + 1e-12);
  }
  assert.deepEqual(desc.map((entry) => entry.hex), asc.map((entry) => entry.hex).reverse());
});

test('hue order groups similar hues together and keeps ids', () => {
  const sorted = sortPalette(palette, 'hue-asc');
  const hexes = sorted.map((entry) => entry.hex);
  const reds = hexes.filter((hex) => hex === '#ff0000' || hex === '#800000');
  const greens = hexes.filter((hex) => hex === '#00ff00' || hex === '#008000');
  assert.deepEqual(reds, ['#800000', '#ff0000']);
  assert.deepEqual(greens, ['#008000', '#00ff00']);
  assert.equal(hexes[0], '#808080');
  assert.deepEqual(sorted.map((entry) => entry.index), [0, 1, 2, 3, 4, 5]);
  assert.deepEqual(
    sorted.map((entry) => entry.id).sort((a, b) => a - b),
    [1, 2, 3, 4, 5, 6],
  );
});

test('hue sorting is deterministic', () => {
  const a = sortPalette(palette, 'hue-asc');
  const b = sortPalette(palette, 'hue-asc');
  assert.deepEqual(a, b);
});
