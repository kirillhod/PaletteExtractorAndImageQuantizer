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
  assert.equal(result.files[0].warnings, undefined);
  const decoded = await decodePng(new Uint8Array(result.files[0].data));
  assert.equal(decoded.width, 16);
  assert.equal(decoded.height, 16);
  assert.equal(decoded.data[3], 0);
});

test('indexed export reserves the cheapest slot when transparency has no index', async () => {
  const palette = createPalette(picoColors);
  const result = await exportIndexed({
    image: sprite,
    palette,
    params: mapParams({ transparentIndex: -1 }),
    name: 'sprite',
  });
  const file = result.files[0];
  assert.equal(file.validation.ok, true);
  assert.equal(file.warnings?.length, 1);
  assert.equal(file.warnings?.[0].key, 'export.autoTransparentIndex');
  const reserved = Number(file.warnings?.[0].params?.index);
  assert.ok(reserved >= 0 && reserved < palette.length);
  // The sprite never draws black, so the unused black entry costs no opaque pixel.
  assert.equal(reserved, 0);
  assert.equal(file.warnings?.[0].params?.count, 0);
  const decoded = await decodePng(new Uint8Array(file.data));
  assert.equal(decoded.data[3], 0);
});

test('the reserved slot falls back to the least-used entry', async () => {
  const palette = createPalette([
    { r: 255, g: 0, b: 0 },
    { r: 0, g: 255, b: 0 },
  ]);
  const image = makeImage(4, 1, (x) => {
    if (x === 0) return { r: 0, g: 0, b: 0, a: 0 };
    return x === 3 ? { r: 0, g: 255, b: 0 } : { r: 255, g: 0, b: 0 };
  });
  const result = await exportIndexed({
    image,
    palette,
    params: mapParams({ palette: undefined, transparentIndex: -1 }),
    name: 'pair',
  });
  const warning = result.files[0].warnings?.[0];
  assert.equal(Number(warning?.params?.index), 1, 'green is used once, red twice');
  assert.equal(Number(warning?.params?.count), 1);
  const decoded = await decodePng(new Uint8Array(result.files[0].data));
  assert.deepEqual(
    [decoded.data[3], decoded.data[7], decoded.data[11], decoded.data[15]],
    [0, 255, 255, 0],
  );
});

test('automatic transparent index survives error diffusion', async () => {
  const palette = createPalette(picoColors);
  const result = await exportIndexed({
    image: sprite,
    palette,
    params: mapParams({
      transparentIndex: -1,
      dither: { method: 'floyd-steinberg', strength: 0.8, serpentine: true, edgeStop: 0.5 },
    }),
    name: 'sprite',
  });
  assert.equal(result.files[0].validation.ok, true);
  assert.equal(result.files[0].warnings?.[0].key, 'export.autoTransparentIndex');
  const decoded = await decodePng(new Uint8Array(result.files[0].data));
  assert.equal(decoded.data[3], 0);
});

test('an opaque image needs no reserved slot', async () => {
  const palette = createPalette([
    { r: 0, g: 0, b: 0 },
    { r: 255, g: 0, b: 0 },
  ]);
  const image = makeImage(2, 1, (x) => ({ r: x ? 255 : 0, g: 0, b: 0 }));
  const result = await exportIndexed({
    image,
    palette,
    params: mapParams({ transparentIndex: -1 }),
    name: 'opaque',
  });
  assert.equal(result.files[0].warnings, undefined);
  const decoded = await decodePng(new Uint8Array(result.files[0].data));
  assert.deepEqual([decoded.data[3], decoded.data[7]], [255, 255]);
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

test('reduced RGBA export preserves source alpha with dithering', async () => {
  const alphas = [0, 64, 128, 255];
  const image = makeImage(4, 1, (x) => ({ r: 255, g: 0, b: 0, a: alphas[x] }));
  const result = await exportReduced({
    image,
    params: mapParams({
      dither: { method: 'floyd-steinberg', strength: 0.8, serpentine: true, edgeStop: 0 },
      transparentIndex: 0,
    }),
    name: 'alpha',
  });
  assert.equal(result.files[0].validation.ok, true);
  const decoded = await decodePng(new Uint8Array(result.files[0].data));
  const decodedAlphas = [];
  for (let i = 3; i < decoded.data.length; i += 4) decodedAlphas.push(decoded.data[i]);
  assert.deepEqual(decodedAlphas, alphas);
});
