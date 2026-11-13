// @ts-check
import test from 'node:test';
import assert from 'node:assert/strict';

import { parseHex } from '../js/core/color.js';
import { BUILTIN_PALETTES } from '../js/core/palettes/builtin.js';
import { parsePaletteFile } from '../js/core/palettes/import.js';
import { encodeStripPng } from '../js/core/png/encode.js';

test('built-in palettes have the documented counts and valid hex values', () => {
  const expected = new Map([
    ['pico-8', 16],
    ['gameboy-dmg', 4],
    ['c64', 16],
    ['zx-spectrum', 15],
    ['ega', 16],
  ]);
  for (const palette of BUILTIN_PALETTES) {
    assert.equal(palette.colors.length, expected.get(palette.id), palette.id);
    for (const hex of palette.colors) parseHex(hex);
  }
});

test('parses .hex palettes with comments and names', async () => {
  const text = ['; comment', '#ff0000 red', '#00ff00 green', '0000ff blue'].join('\n');
  const parsed = await parsePaletteFile({ name: 'test.hex', text });
  assert.deepEqual(parsed.colors.map((color) => [color.r, color.g, color.b]), [
    [255, 0, 0],
    [0, 255, 0],
    [0, 0, 255],
  ]);
  assert.equal(parsed.format, 'hex');
});

test('parses GIMP .gpl palettes', async () => {
  const text = ['GIMP Palette', 'Name: test', 'Columns: 2', '#', '255 0 0\tRed', '0 0 255\tBlue', ''].join('\n');
  const parsed = await parsePaletteFile({ name: 'test.gpl', text });
  assert.deepEqual(parsed.colors.map((color) => color.r), [255, 0]);
  assert.deepEqual(parsed.names, ['Red', 'Blue']);
});

test('parses JASC .pal palettes', async () => {
  const text = ['JASC-PAL', '0100', '2', '255 0 0', '0 255 0', ''].join('\n');
  const parsed = await parsePaletteFile({ name: 'test.pal', text });
  assert.equal(parsed.colors.length, 2);
  assert.deepEqual(parsed.colors[1], { r: 0, g: 255, b: 0, a: 255 });
});

test('parses native palette JSON', async () => {
  const text = JSON.stringify({
    format: 'peiq/palette',
    version: 1,
    meta: { name: 'json test' },
    order: 'source',
    space: 'oklab',
    entries: [
      { id: 1, index: 0, hex: '#ff0000', rgb: [255, 0, 0], alpha: 255 },
      { id: 2, index: 1, hex: '#0000ff', rgb: [0, 0, 255], alpha: 255 },
    ],
  });
  const parsed = await parsePaletteFile({ name: 'test.json', text });
  assert.equal(parsed.name, 'json test');
  assert.equal(parsed.colors.length, 2);
});

test('imports a horizontal PNG palette strip', async () => {
  const png = await encodeStripPng([
    { r: 10, g: 20, b: 30 },
    { r: 40, g: 50, b: 60 },
  ]);
  const parsed = await parsePaletteFile({ name: 'strip.png', bytes: png });
  assert.deepEqual(parsed.colors, [
    { r: 10, g: 20, b: 30, a: 255 },
    { r: 40, g: 50, b: 60, a: 255 },
  ]);
});

test('imports a vertical PNG palette strip', async () => {
  const png = await encodeStripPng(
    [
      { r: 1, g: 2, b: 3 },
      { r: 4, g: 5, b: 6 },
    ],
    { orientation: '1xN' },
  );
  const parsed = await parsePaletteFile({ name: 'strip.png', bytes: png });
  assert.deepEqual(parsed.colors.map((color) => color.r), [1, 4]);
});

test('rejects non-strip PNGs and unsupported formats', async () => {
  const png = await encodeStripPng([{ r: 1, g: 2, b: 3 }]);
  await assert.rejects(
    () => parsePaletteFile({ name: 'not-a-strip.png', bytes: new Uint8Array([1, 2, 3]) }),
    /PNG|not a PNG/,
  );
  await assert.rejects(
    () => parsePaletteFile({ name: 'palette.ase', text: 'x' }),
    /M3/,
  );
  assert.ok(png.length > 0);
});
