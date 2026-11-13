// @ts-check
import test from 'node:test';
import assert from 'node:assert/strict';

import { crc32 } from '../js/core/png/crc.js';
import { encodeRgbaPng, encodeStripPng } from '../js/core/png/encode.js';
import { decodePng } from '../js/core/png/decode.js';
import { makeImage } from './helpers.js';

test('CRC32 matches the standard known answer', () => {
  const bytes = new TextEncoder().encode('123456789');
  assert.equal(crc32(bytes), 0xcbf43926);
});

test('horizontal palette strip round-trips pixel-exactly', async () => {
  const colors = [
    { r: 10, g: 20, b: 30 },
    { r: 40, g: 50, b: 60 },
    { r: 70, g: 80, b: 90 },
  ];
  const png = await encodeStripPng(colors, { orientation: 'Nx1' });
  const decoded = await decodePng(png);
  assert.equal(decoded.width, 3);
  assert.equal(decoded.height, 1);
  assert.deepEqual([...decoded.data], [
    10, 20, 30, 255,
    40, 50, 60, 255,
    70, 80, 90, 255,
  ]);
});

test('vertical palette strip round-trips in palette order', async () => {
  const colors = [
    { r: 1, g: 2, b: 3 },
    { r: 4, g: 5, b: 6 },
  ];
  const png = await encodeStripPng(colors, { orientation: '1xN' });
  const decoded = await decodePng(png);
  assert.equal(decoded.width, 1);
  assert.equal(decoded.height, 2);
  assert.deepEqual([...decoded.data], [1, 2, 3, 255, 4, 5, 6, 255]);
});

test('RGBA PNG round-trips including alpha', async () => {
  const image = makeImage(2, 2, (x, y) => ({
    r: x * 100,
    g: y * 100,
    b: 40,
    a: x === y ? 255 : 128,
  }));
  const png = await encodeRgbaPng(image.width, image.height, image.data);
  const decoded = await decodePng(png);
  assert.equal(decoded.width, 2);
  assert.equal(decoded.height, 2);
  assert.deepEqual([...decoded.data], [...image.data]);
});

test('strip with alpha keeps the alpha channel', async () => {
  const png = await encodeStripPng(
    [
      { r: 10, g: 20, b: 30, a: 128 },
      { r: 40, g: 50, b: 60, a: 255 },
    ],
    { orientation: 'Nx1' },
  );
  const decoded = await decodePng(png);
  assert.deepEqual([...decoded.data], [10, 20, 30, 128, 40, 50, 60, 255]);
});

test('decoder rejects a non-PNG signature', async () => {
  await assert.rejects(() => decodePng(new Uint8Array([1, 2, 3, 4])), /not a PNG/);
});
