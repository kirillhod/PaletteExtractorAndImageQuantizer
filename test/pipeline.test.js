// @ts-check
import test from 'node:test';
import assert from 'node:assert/strict';

import { runPreview, exportStrip, exportReduced } from '../js/core/pipeline.js';
import { createPalette } from '../js/core/palette.js';
import { decodePng } from '../js/core/png/decode.js';
import { quadrantsImage } from './helpers.js';

const params = /** @type {const} */ ({
  method: 'median-cut',
  colors: 4,
  space: 'oklab',
});

test('runPreview returns a palette and a mapped preview', async () => {
  const image = quadrantsImage(16);
  const result = await runPreview({ image, params });
  assert.equal(result.palette.length, 4);
  assert.equal(result.preview.width, 16);
  assert.equal(result.preview.height, 16);
  assert.equal(result.preview.data.length, 16 * 16 * 4);
  assert.ok(result.timings.histogramMs >= 0);
});

test('exportStrip validates a horizontal strip', async () => {
  const palette = createPalette([
    { r: 255, g: 0, b: 0 },
    { r: 0, g: 255, b: 0 },
    { r: 0, g: 0, b: 255 },
  ]);
  const result = await exportStrip({ palette, name: 'Test Sprite', orientation: 'Nx1' });
  assert.equal(result.files.length, 1);
  const file = result.files[0];
  assert.equal(file.name, 'test-sprite-palette-3x1.png');
  assert.equal(file.validation.ok, true);
  const decoded = await decodePng(new Uint8Array(file.data));
  assert.equal(decoded.width, 3);
  assert.equal(decoded.height, 1);
});

test('exportStrip validates a vertical strip', async () => {
  const palette = createPalette([
    { r: 1, g: 2, b: 3 },
    { r: 4, g: 5, b: 6 },
  ]);
  const result = await exportStrip({ palette, name: 'p', orientation: '1xN' });
  assert.equal(result.files[0].validation.ok, true);
  assert.equal(result.files[0].name, 'p-palette-1x2.png');
});

test('exportReduced encodes the full-resolution mapped image', async () => {
  const image = quadrantsImage(32);
  const result = await exportReduced({ image, params, name: 'quadrants' });
  assert.equal(result.files.length, 1);
  assert.equal(result.files[0].validation.ok, true);
  assert.equal(result.files[0].name, 'quadrants-4c.png');
  const decoded = await decodePng(new Uint8Array(result.files[0].data));
  assert.equal(decoded.width, 32);
  assert.equal(decoded.height, 32);
});
