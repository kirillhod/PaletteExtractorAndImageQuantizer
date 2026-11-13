// @ts-check
import test from 'node:test';
import assert from 'node:assert/strict';

import { parseHex } from '../js/core/color.js';
import { createPalette } from '../js/core/palette.js';
import { BUILTIN_PALETTES } from '../js/core/palettes/builtin.js';
import { decodePng } from '../js/core/png/decode.js';
import { exportIndexed, exportReduced, runPreview } from '../js/core/pipeline.js';
import { makeImage } from './helpers.js';

const pico = BUILTIN_PALETTES.find((palette) => palette.id === 'pico-8');
if (!pico) throw new Error('PICO-8 palette missing');
const picoColors = pico.colors.map(parseHex);

const sprite = makeImage(16, 16, (x, y) => {
  if (x < 2 && y < 2) return { r: 255, g: 0, b: 255, a: 0 };
  if (x + y < 10) return { r: 255, g: 0, b: 0 };
  if (x > y) return { r: 0, g: 255, b: 0 };
  return { r: 41, g: 173, b: 255 };
});

/**
 * @param {Partial<import('../js/core/pipeline.js').PipelineParams>} overrides
 * @returns {import('../js/core/pipeline.js').PipelineParams}
 */
function mapParams(overrides = {}) {
  return {
    mode: 'map',
    method: 'median-cut',
    colors: picoColors.length,
    space: 'oklab',
    palette: picoColors,
    dither: { method: 'none', strength: 0, serpentine: true, edgeStop: 0 },
    alphaThreshold: 128,
    transparentIndex: 0,
    ...overrides,
  };
}

test('fixed-palette preview uses only PICO-8 colors', async () => {
  const result = await runPreview({ image: sprite, params: mapParams() });
  assert.equal(result.palette.length, 16);
  const allowed = new Set(picoColors.map((color) => (color.r << 16) | (color.g << 8) | color.b));
  for (let i = 0; i < result.preview.data.length; i += 4) {
    if (result.preview.data[i + 3] === 0) continue;
    const key = (result.preview.data[i] << 16) | (result.preview.data[i + 1] << 8) | result.preview.data[i + 2];
    assert.ok(allowed.has(key));
  }
});

test('fixed-palette + Floyd-Steinberg preview is palette-compliant', async () => {
  const result = await runPreview({
    image: sprite,
    params: mapParams({ dither: { method: 'floyd-steinberg', strength: 0.8, serpentine: true, edgeStop: 0.5 } }),
  });
  assert.equal(result.palette.length, 16);
  const allowed = new Set(picoColors.map((color) => (color.r << 16) | (color.g << 8) | color.b));
  for (let i = 0; i < result.preview.data.length; i += 4) {
    if (result.preview.data[i + 3] === 0) continue;
    const key = (result.preview.data[i] << 16) | (result.preview.data[i + 1] << 8) | result.preview.data[i + 2];
    assert.ok(allowed.has(key));
  }
});

test('indexed PNG export round-trips a fixed palette and transparency', async () => {
  const palette = createPalette(picoColors);
  const result = await exportIndexed({
    image: sprite,
    palette,
    params: mapParams(),
    name: 'sprite',
  });
  assert.equal(result.files.length, 1);
  assert.equal(result.files[0].name, 'sprite-16c-indexed.png');
  assert.equal(result.files[0].validation.ok, true);
  const decoded = await decodePng(new Uint8Array(result.files[0].data));
  assert.equal(decoded.width, 16);
  assert.equal(decoded.height, 16);
  assert.equal(decoded.data[3], 0);
});

test('indexed export blocks transparency without a reserved index', async () => {
  const palette = createPalette(picoColors);
  await assert.rejects(
    () =>
      exportIndexed({
        image: sprite,
        palette,
        params: mapParams({ transparentIndex: -1 }),
        name: 'sprite',
      }),
    /transparent index/,
  );
});

test('reduced PNG export with dithering validates against the fixed palette', async () => {
  const result = await exportReduced({
    image: sprite,
    params: mapParams({ dither: { method: 'bayer4', strength: 1, serpentine: false, edgeStop: 0 } }),
    name: 'sprite',
  });
  assert.equal(result.files[0].validation.ok, true);
  const decoded = await decodePng(new Uint8Array(result.files[0].data));
  assert.equal(decoded.width, 16);
  assert.equal(decoded.height, 16);
});
