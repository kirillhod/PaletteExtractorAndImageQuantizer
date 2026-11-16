// @ts-check
import test from 'node:test';
import assert from 'node:assert/strict';

import { parseHex, rgb8ToOklab } from '../js/core/color.js';
import {
  addPaletteEntry,
  createPalette,
  movePaletteEntry,
  removePaletteEntry,
  setPaletteLock,
  sortPalette,
  updatePaletteEntry,
} from '../js/core/palette.js';

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

test('hue order bands families and ramps lightness inside each band', () => {
  const family = createPalette([
    { r: 32, g: 32, b: 32 },
    { r: 224, g: 224, b: 224 },
    { r: 128, g: 0, b: 0 },
    { r: 255, g: 0, b: 0 },
    { r: 0, g: 100, b: 0 },
    { r: 0, g: 200, b: 0 },
    { r: 0, g: 255, b: 0 },
    { r: 0, g: 0, b: 128 },
    { r: 0, g: 0, b: 255 },
  ]);
  const ascending = [
    '#202020', '#e0e0e0',
    '#800000', '#ff0000',
    '#006400', '#00c800', '#00ff00',
    '#000080', '#0000ff',
  ];
  assert.deepEqual(
    sortPalette(family, 'hue-asc').map((entry) => entry.hex),
    ascending,
  );
  assert.deepEqual(
    sortPalette(family, 'hue-desc').map((entry) => entry.hex),
    [
      '#e0e0e0', '#202020',
      '#ff0000', '#800000',
      '#00ff00', '#00c800', '#006400',
      '#0000ff', '#000080',
    ],
  );
});

test('hue order keeps a single-hue family in one lightness ramp', () => {
  const reds = createPalette([
    { r: 200, g: 0, b: 0 },
    { r: 80, g: 0, b: 0 },
    { r: 255, g: 0, b: 0 },
    { r: 140, g: 0, b: 0 },
  ]);
  assert.deepEqual(
    sortPalette(reds, 'hue-asc').map((entry) => entry.hex),
    ['#500000', '#8c0000', '#c80000', '#ff0000'],
  );
  assert.deepEqual(
    sortPalette(reds, 'hue-desc').map((entry) => entry.hex),
    ['#ff0000', '#c80000', '#8c0000', '#500000'],
  );
});

test('hue sorting is deterministic', () => {
  for (const order of /** @type {const} */ (['hue-asc', 'hue-desc'])) {
    const a = sortPalette(palette, order);
    const b = sortPalette(palette, order);
    assert.deepEqual(a, b);
  }
});

test('locked entries keep their display slot and identity while others sort', () => {
  const locked = setPaletteLock(palette, palette[0].id, true);
  const sorted = sortPalette(locked, 'hue-asc');
  assert.equal(sorted[0].id, palette[0].id);
  assert.equal(sorted[0].hex, '#ff0000');
  assert.deepEqual(sorted.map((entry) => entry.index), [0, 1, 2, 3, 4, 5]);
  assert.deepEqual(
    sorted.map((entry) => entry.id).sort((a, b) => a - b),
    [1, 2, 3, 4, 5, 6],
  );
});

test('unlocked entries fill the remaining slots in requested order', () => {
  const locked = setPaletteLock(palette, palette[0].id, true);
  const sorted = sortPalette(locked, 'lightness-asc');
  const rest = sortPalette(
    palette.filter((entry) => entry.id !== palette[0].id),
    'lightness-asc',
  );
  assert.equal(sorted[0].id, palette[0].id);
  assert.deepEqual(
    sorted.slice(1).map((entry) => entry.hex),
    rest.map((entry) => entry.hex),
  );
});

test('source order restores id order around a locked manual slot', () => {
  const manual = [palette[2], palette[0], palette[1], palette[3], palette[4], palette[5]];
  const locked = setPaletteLock(manual, palette[2].id, true);
  const sorted = sortPalette(locked, 'source');
  assert.equal(sorted[0].id, palette[2].id);
  assert.deepEqual(sorted.slice(1).map((entry) => entry.id), [1, 2, 4, 5, 6]);
});

test('lock toggling round-trips', () => {
  const locked = setPaletteLock(palette, 4, true);
  assert.equal(locked[3].locked, true);
  const unlocked = setPaletteLock(locked, 4, false);
  assert.equal(unlocked[3].locked, false);
});

test('adding a color appends with the next stable id', () => {
  const added = addPaletteEntry(palette, '#123');
  const entry = added[added.length - 1];
  assert.equal(added.length, palette.length + 1);
  assert.equal(entry.id, 7);
  assert.equal(entry.index, 6);
  assert.equal(entry.hex, '#112233');
  assert.equal(entry.locked, false);
  assert.deepEqual(entry.color, { r: 17, g: 34, b: 51, a: 255 });
});

test('adding rejects duplicates and more than 256 colors', () => {
  assert.throws(() => addPaletteEntry(palette, '#ff0000'), /already exists/);
  const colors = Array.from({ length: 256 }, (_, index) => ({
    r: index,
    g: (index * 7) % 256,
    b: (index * 13) % 256,
  }));
  const full = createPalette(colors);
  assert.throws(() => addPaletteEntry(full, '#abcdef'), /limited to 256/);
});

test('editing a color keeps id, index, and lock state', () => {
  const locked = setPaletteLock(palette, 1, true);
  const updated = updatePaletteEntry(locked, 1, '#123456');
  assert.equal(updated[0].id, 1);
  assert.equal(updated[0].index, 0);
  assert.equal(updated[0].locked, true);
  assert.equal(updated[0].hex, '#123456');
  assert.deepEqual(updated[0].color, { r: 18, g: 52, b: 86, a: 255 });
});

test('editing rejects unknown ids, invalid hex, and duplicates', () => {
  assert.throws(() => updatePaletteEntry(palette, 99, '#000000'), /not found/);
  assert.throws(() => updatePaletteEntry(palette, 1, 'not-a-color'), /invalid hex/);
  assert.throws(() => updatePaletteEntry(palette, 1, '#00ff00'), /already exists/);
});

test('removing renumbers indices deterministically and keeps ids', () => {
  const removed = removePaletteEntry(palette, 2);
  assert.equal(removed.length, palette.length - 1);
  assert.deepEqual(removed.map((entry) => entry.id), [1, 3, 4, 5, 6]);
  assert.deepEqual(removed.map((entry) => entry.index), [0, 1, 2, 3, 4]);
});

test('removing refuses locked colors and the last color', () => {
  const locked = setPaletteLock(palette, 1, true);
  assert.throws(() => removePaletteEntry(locked, 1), /locked/);
  const single = createPalette([{ r: 1, g: 2, b: 3 }]);
  assert.throws(() => removePaletteEntry(single, 1), /at least one/);
});

test('manual order keeps the current array order', () => {
  const manual = [palette[2], palette[0], palette[1], palette[3], palette[4], palette[5]];
  const sorted = sortPalette(manual, 'manual');
  assert.deepEqual(sorted.map((entry) => entry.hex), manual.map((entry) => entry.hex));
  assert.deepEqual(sorted.map((entry) => entry.index), [0, 1, 2, 3, 4, 5]);
});

test('moving an entry swaps neighbors and renumbers indices', () => {
  const moved = movePaletteEntry(palette, 2, 'right');
  assert.deepEqual(moved.map((entry) => entry.id), [1, 3, 2, 4, 5, 6]);
  assert.deepEqual(moved.map((entry) => entry.index), [0, 1, 2, 3, 4, 5]);
  const back = movePaletteEntry(moved, 2, 'left');
  assert.deepEqual(back.map((entry) => entry.id), [1, 2, 3, 4, 5, 6]);
});

test('moving refuses locked entries and moves blocked by a locked neighbor', () => {
  const locked = setPaletteLock(palette, 1, true);
  assert.throws(() => movePaletteEntry(locked, 1, 'right'), /locked color cannot be moved/);
  const blocked = setPaletteLock(palette, 2, true);
  assert.throws(() => movePaletteEntry(blocked, 1, 'right'), /locked color blocks/);
});

test('moving at a palette edge is a no-op', () => {
  assert.deepEqual(movePaletteEntry(palette, 1, 'left'), palette);
  assert.deepEqual(movePaletteEntry(palette, 6, 'right'), palette);
});
