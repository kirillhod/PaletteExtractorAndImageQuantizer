// @ts-check
import test from 'node:test';
import assert from 'node:assert/strict';

import { createPalette } from '../js/core/palette.js';
import { formatHexPalette, parseHexPalette } from '../js/core/formats/hex.js';
import { formatGplPalette, parseGplPalette } from '../js/core/formats/gpl.js';
import { formatPaletteJson, parsePaletteJson } from '../js/core/formats/json.js';

const colors = [
  { r: 10, g: 20, b: 30, a: 255 },
  { r: 200, g: 100, b: 50, a: 255 },
  { r: 255, g: 255, b: 255, a: 255 },
];

test('HEX palette export round-trips colors', () => {
  const text = formatHexPalette(colors);
  const parsed = parseHexPalette(text);
  assert.deepEqual(parsed.colors, colors);
});

test('GPL palette export round-trips RGB colors', () => {
  const text = formatGplPalette(colors, 'Test', ['One', 'Two', 'Three']);
  const parsed = parseGplPalette(text);
  assert.deepEqual(
    parsed.colors.map((color) => [color.r, color.g, color.b]),
    colors.map((color) => [color.r, color.g, color.b]),
  );
  assert.deepEqual(parsed.names, ['One', 'Two', 'Three']);
});

test('native JSON export round-trips colors and includes a hash', async () => {
  const palette = createPalette(colors);
  const text = await formatPaletteJson(palette, {
    name: 'fixture',
    order: 'source',
    space: 'oklab',
  });
  const root = JSON.parse(text);
  assert.equal(root.format, 'peiq/palette');
  assert.equal(root.version, 1);
  assert.equal(root.meta.name, 'fixture');
  assert.match(root.hash, /^(sha256|fnv1a64):[0-9a-f]+$/);
  const parsed = parsePaletteJson(text);
  assert.deepEqual(parsed.colors, colors);
  assert.equal(parsed.name, 'fixture');
});

test('HEX export preserves alpha when a color is semi-transparent', () => {
  const alphaColors = [...colors.slice(0, 2), { r: 1, g: 2, b: 3, a: 128 }];
  const text = formatHexPalette(alphaColors);
  const parsed = parseHexPalette(text);
  assert.deepEqual(parsed.colors, alphaColors);
});
