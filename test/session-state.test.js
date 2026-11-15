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
  const snapshot = { palette, sortOrder: 'source', selectedId: 1, transparentId: null };
  const history = { past: [snapshot], future: [] };
  const copy = cloneHistory(history);
  copy.past[0].palette[1].locked = true;
  assert.equal(palette[1].locked, false);
  assert.deepEqual(clonePaletteSnapshot(snapshot), snapshot);
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
