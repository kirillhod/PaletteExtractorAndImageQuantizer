// @ts-check
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_PREVIEW_LAYOUT,
  PREVIEW_COLUMN_CHOICES,
  normalizePreviewLayout,
  previewGridColumns,
  previewSwatchLabels,
} from '../js/core/preview-layout.js';

test('missing or malformed layouts fall back to the row strip', () => {
  for (const value of [null, undefined, 'grid', 42, [], true]) {
    assert.deepEqual(normalizePreviewLayout(value), { ...DEFAULT_PREVIEW_LAYOUT });
  }
});

test('a stored layout keeps every valid field', () => {
  assert.deepEqual(normalizePreviewLayout({ mode: 'grid', columns: 10, hex: true, rgb: true }), {
    mode: 'grid',
    columns: 10,
    hex: true,
    rgb: true,
  });
  assert.deepEqual(normalizePreviewLayout({ mode: 'column', columns: 16, rgb: true }), {
    mode: 'column',
    columns: 16,
    hex: false,
    rgb: true,
  });
});

test('unknown modes, column counts, and label flags are replaced one by one', () => {
  assert.deepEqual(normalizePreviewLayout({ mode: 'wall', columns: 7, hex: 'yes', rgb: 1 }), {
    mode: 'row',
    columns: 0,
    hex: false,
    rgb: false,
  });
  assert.deepEqual(normalizePreviewLayout({ mode: 'grid', columns: -4, hex: true }), {
    mode: 'grid',
    columns: 0,
    hex: true,
    rgb: false,
  });
});

test('the column select offers auto plus even counts up to 32', () => {
  assert.deepEqual([...PREVIEW_COLUMN_CHOICES], [0, 2, 4, 6, 8, 10, 12, 16, 20, 24, 32]);
});

test('auto columns follow a square-ish grid and stay bounded', () => {
  const cases = [
    [0, 1],
    [1, 1],
    [2, 2],
    [3, 2],
    [4, 2],
    [5, 3],
    [9, 3],
    [16, 4],
    [17, 5],
    [64, 8],
    [100, 10],
    [256, 16],
  ];
  for (const [count, expected] of cases) {
    assert.equal(previewGridColumns(count, 0), expected, `auto columns for ${count}`);
  }
});

test('an explicit column count is capped by the palette size', () => {
  assert.equal(previewGridColumns(16, 10), 10);
  assert.equal(previewGridColumns(8, 32), 8);
  assert.equal(previewGridColumns(2, 4), 2);
  assert.equal(previewGridColumns(256, 32), 32);
  assert.equal(previewGridColumns(0, 10), 1);
});

test('a count outside the offered choices falls back to auto', () => {
  assert.equal(previewGridColumns(16, 7), 4);
  assert.equal(previewGridColumns(16, -1), 4);
  assert.equal(previewGridColumns(16, Number.NaN), 4);
});

test('labels list hex and RGB independently', () => {
  const entry = { hex: '#F2798A', color: { r: 242, g: 121, b: 138 } };
  assert.deepEqual(previewSwatchLabels(entry, { hex: false, rgb: false }), []);
  assert.deepEqual(previewSwatchLabels(entry, { hex: true, rgb: false }), ['#f2798a']);
  assert.deepEqual(previewSwatchLabels(entry, { hex: false, rgb: true }), ['242 121 138']);
  assert.deepEqual(previewSwatchLabels(entry, { hex: true, rgb: true }), [
    '#f2798a',
    '242 121 138',
  ]);
});

test('a bare entry without a parsed color still labels its RGB', () => {
  assert.deepEqual(previewSwatchLabels({ hex: '#0b0b0b' }, { hex: false, rgb: true }), [
    '11 11 11',
  ]);
  assert.deepEqual(previewSwatchLabels(null, { hex: true, rgb: true }), []);
});
