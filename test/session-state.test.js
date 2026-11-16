// @ts-check
import test from 'node:test';
import assert from 'node:assert/strict';

import { createPalette } from '../js/core/palette.js';
import {
  SESSION_VERSION,
  cloneHistory,
  clonePalette,
  clonePaletteSnapshot,
  isValidSessionRecord,
  sessionPaletteName,
} from '../js/core/session-state.js';

const palette = createPalette([
  { r: 1, g: 2, b: 3 },
  { r: 4, g: 5, b: 6 },
]);

test('session palette clones do not share entry or color objects', () => {
  const copy = clonePalette(palette);
  copy[0].hex = '#ffffff';
  copy[0].color.r = 255;
  assert.equal(palette[0].hex, '#010203');
  assert.equal(palette[0].color.r, 1);
});

test('history snapshots clone independently', () => {
  const snapshot = {
    palette,
    sortOrder: 'source',
    selectedId: 1,
    transparentId: null,
    markers: [{ id: 1, u: 0.25, v: 0.5 }],
  };
  const history = { past: [snapshot], future: [] };
  const copy = cloneHistory(history);
  copy.past[0].palette[1].locked = true;
  copy.past[0].markers[0].u = 0.9;
  assert.equal(palette[1].locked, false);
  assert.equal(snapshot.markers[0].u, 0.25);
  assert.deepEqual(clonePaletteSnapshot(snapshot), snapshot);
});

test('history snapshots keep palette edits and settings together', () => {
  const settings = {
    method: 'wu',
    colors: 16,
    space: 'oklab',
    alphaThreshold: 128,
    dither: {
      method: 'floyd-steinberg',
      strength: 0.8,
      serpentine: true,
      edgeStop: 0.5,
    },
  };
  const snapshot = {
    palette,
    sortOrder: 'manual',
    selectedId: 1,
    transparentId: 2,
    markers: [],
    paletteEdited: true,
    settings,
  };
  const copy = clonePaletteSnapshot(snapshot);
  assert.deepEqual(copy, snapshot);
  copy.settings.colors = 2;
  copy.settings.dither.strength = 0;
  assert.equal(settings.colors, 16);
  assert.equal(settings.dither.strength, 0.8);
  assert.equal('settings' in clonePaletteSnapshot({ ...snapshot, settings: undefined }), false);
});

test('a restored imported palette keeps the name the UI shows', () => {
  assert.equal(
    sessionPaletteName({ statusName: 'tester.hex', fixedName: 'PICO-8' }),
    'tester.hex',
  );
  assert.equal(
    sessionPaletteName({ statusName: '', fixedName: 'Game Boy DMG', importedName: 'tester.hex' }),
    'Game Boy DMG',
  );
  assert.equal(
    sessionPaletteName({ statusName: '', fixedName: '', importedName: 'tester.hex' }),
    'tester.hex',
  );
  assert.equal(sessionPaletteName({}), '');
});

test('session records require a version, image bytes, palette, and history', () => {
  const valid = {
    version: SESSION_VERSION,
    image: {
      bytes: new Uint8Array([1, 2, 3]).buffer,
      name: 'test.png',
      type: 'image/png',
      size: 3,
    },
    state: { settings: {}, palette, history: { past: [], future: [] } },
  };
  assert.equal(isValidSessionRecord(valid), true);
  assert.equal(
    isValidSessionRecord({
      ...valid,
      state: { ...valid.state, markers: [{ id: 1, u: 0.2, v: 0.8 }] },
    }),
    true,
  );
  assert.equal(
    isValidSessionRecord({
      ...valid,
      state: { ...valid.state, markers: [{ id: 1, u: -1, v: 0.8 }] },
    }),
    false,
  );
  assert.equal(isValidSessionRecord({ ...valid, version: 999 }), false);
  assert.equal(isValidSessionRecord({ ...valid, image: { name: 'test.png' } }), false);
  assert.equal(
    isValidSessionRecord({ ...valid, image: { ...valid.image, bytes: new ArrayBuffer(0) } }),
    false,
  );
  assert.equal(isValidSessionRecord({ ...valid, state: { palette: {} } }), false);
  assert.equal(isValidSessionRecord({ ...valid, state: { settings: null } }), false);
});

test('legacy version 1 session records with a non-empty blob still load', () => {
  const legacy = {
    version: 1,
    image: { blob: new Blob(['x']), name: 'test.png', type: 'image/png', size: 1 },
    state: { settings: {}, palette, history: { past: [], future: [] } },
  };
  assert.equal(isValidSessionRecord(legacy), true);
  assert.equal(
    isValidSessionRecord({ ...legacy, image: { ...legacy.image, blob: new Blob([]) } }),
    false,
  );
});
