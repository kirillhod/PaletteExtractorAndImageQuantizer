// @ts-check
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_PREVIEW_BACKGROUND,
  PREVIEW_BACKGROUND_PRESETS,
  normalizePreviewBackground,
} from '../js/core/preview-bg.js';

test('preview background accepts full and short hex in either case', () => {
  assert.equal(normalizePreviewBackground('#808080'), '#808080');
  assert.equal(normalizePreviewBackground('808080'), '#808080');
  assert.equal(normalizePreviewBackground('#ABC'), '#aabbcc');
  assert.equal(normalizePreviewBackground('  #FfF  '), '#ffffff');
});

test('invalid preview backgrounds fall back without throwing', () => {
  for (const value of [null, undefined, 42, {}, '', '#12', 'gray', '#gggggg']) {
    assert.equal(normalizePreviewBackground(value), DEFAULT_PREVIEW_BACKGROUND);
  }
  assert.equal(normalizePreviewBackground('nope', '#767676'), '#767676');
  assert.equal(normalizePreviewBackground('nope', 'also-nope'), DEFAULT_PREVIEW_BACKGROUND);
});

test('preview background presets are valid and distinct', () => {
  assert.ok(PREVIEW_BACKGROUND_PRESETS.length >= 2);
  assert.equal(DEFAULT_PREVIEW_BACKGROUND, '#808080');
  const ids = new Set();
  const hexes = new Set();
  for (const preset of PREVIEW_BACKGROUND_PRESETS) {
    assert.equal(normalizePreviewBackground(preset.hex), preset.hex);
    assert.match(preset.labelKey, /^palette\.preview/);
    ids.add(preset.id);
    hexes.add(preset.hex);
  }
  assert.equal(ids.size, PREVIEW_BACKGROUND_PRESETS.length);
  assert.equal(hexes.size, PREVIEW_BACKGROUND_PRESETS.length);
  assert.ok(hexes.has('#808080'));
  assert.ok(hexes.has('#767676'));
});
