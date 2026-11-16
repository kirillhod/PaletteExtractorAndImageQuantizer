// @ts-check
import test from 'node:test';
import assert from 'node:assert/strict';

import { runPreview, exportStrip, exportReduced, exportIndexed } from '../js/core/pipeline.js';
import { createPalette } from '../js/core/palette.js';
import { decodePng } from '../js/core/png/decode.js';
import { DITHER_METHODS } from '../js/core/dither/index.js';
import { makeImage, quadrantsImage } from './helpers.js';

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

test('fully transparent image returns an empty palette and a blank preview', async () => {
  const image = { data: new Uint8ClampedArray(4 * 4 * 4), width: 4, height: 4 };
  const result = await runPreview({ image, params });
  assert.deepEqual(result.palette, []);
  assert.equal(result.uniqueColors, 0);
  assert.equal(result.preview.data.length, 4 * 4 * 4);
  assert.ok(result.preview.data.every((value) => value === 0));
});

test('paletteOverride maps with the supplied palette instead of extracting', async () => {
  const image = quadrantsImage(8);
  const result = await runPreview({
    image,
    params: {
      ...params,
      paletteOverride: [
        { r: 0, g: 0, b: 0 },
        { r: 255, g: 255, b: 255 },
      ],
    },
  });
  assert.deepEqual(result.palette.map((entry) => entry.hex), ['#000000', '#ffffff']);
  assert.equal(result.preview.width, 8);
  assert.equal(result.preview.height, 8);
});

test('indexed export validates when the transparent index is used', async () => {
  const image = { data: new Uint8ClampedArray(4 * 4 * 4), width: 4, height: 4 };
  for (let i = 0; i < image.data.length; i += 4) {
    image.data[i] = 255;
    image.data[i + 3] = 255;
  }
  const palette = createPalette([{ r: 255, g: 0, b: 0 }]);
  const result = await exportIndexed({
    image,
    palette,
    params: { ...params, transparentIndex: 0, alphaThreshold: 128 },
    name: 'solid',
  });
  assert.equal(result.files[0].validation.ok, true);
  assert.match(result.files[0].validation.detail, /exact/);
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

const alphaImage = makeImage(4, 1, (x) => {
  if (x === 0) return { r: 0, g: 0, b: 0 };
  if (x === 1) return { r: 255, g: 255, b: 255, a: 128 };
  if (x === 2) return { r: 0, g: 0, b: 0, a: 0 };
  return { r: 255, g: 255, b: 255 };
});

const alphaParams = {
  ...params,
  paletteOverride: [
    { r: 0, g: 0, b: 0 },
    { r: 255, g: 255, b: 255 },
  ],
  alphaThreshold: 128,
};

/**
 * @param {{ data: Uint8ClampedArray }} preview
 */
function alphaRow(preview) {
  return [0, 1, 2, 3].map((x) => preview.data[x * 4 + 3]);
}

test('every dither method keeps the source alpha in the preview', async () => {
  for (const method of DITHER_METHODS) {
    const result = await runPreview({
      image: alphaImage,
      params: { ...alphaParams, dither: { method }, transparentIndex: -1 },
    });
    assert.deepEqual(alphaRow(result.preview), [255, 128, 0, 255], method);
  }
});

test('the reserved transparent index stays transparent in every dithered preview', async () => {
  for (const method of DITHER_METHODS) {
    const result = await runPreview({
      image: alphaImage,
      params: { ...alphaParams, dither: { method }, transparentIndex: 0 },
    });
    assert.deepEqual(alphaRow(result.preview), [0, 128, 0, 255], method);
  }
});
