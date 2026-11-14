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

test('session records require a version, image blob, palette, and history', () => {
  const valid = {
    version: SESSION_VERSION,
    image: { blob: new Blob(['x']), name: 'test.png', type: 'image/png' },
    state: { settings: {}, palette, history: { past: [], future: [] } },
  };
  assert.equal(isValidSessionRecord(valid), true);
  assert.equal(isValidSessionRecord({ ...valid, version: 999 }), false);
  assert.equal(isValidSessionRecord({ ...valid, image: { name: 'test.png' } }), false);
  assert.equal(isValidSessionRecord({ ...valid, state: { palette: {} } }), false);
  assert.equal(isValidSessionRecord({ ...valid, state: { settings: null } }), false);
});
