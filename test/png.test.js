// @ts-check
import test from 'node:test';
import assert from 'node:assert/strict';
import { constants as zlibConstants, deflateSync } from 'node:zlib';

import { crc32 } from '../js/core/png/crc.js';
import { PNG_SIGNATURE, concatBytes, makeChunk } from '../js/core/png/chunks.js';
import { encodeIndexedPng, encodeRgbaPng, encodeStripPng } from '../js/core/png/encode.js';
import { decodePng } from '../js/core/png/decode.js';
import { makeImage } from './helpers.js';

/**
 * Build a compressed RGBA PNG to exercise the full inflater.
 * @param {{ data: Uint8ClampedArray, width:number, height:number }} image
 * @param {number} strategy
 */
function makeCompressedRgbaPng(image, strategy) {
  const rowBytes = image.width * 4;
  const raw = new Uint8Array((rowBytes + 1) * image.height);
  for (let y = 0; y < image.height; y++) {
    const target = y * (rowBytes + 1);
    raw[target] = 0;
    raw.set(image.data.subarray(y * rowBytes, (y + 1) * rowBytes), target + 1);
  }
  const compressed = deflateSync(raw, { strategy });
  const ihdr = new Uint8Array(13);
  const view = new DataView(ihdr.buffer);
  view.setUint32(0, image.width);
  view.setUint32(4, image.height);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return concatBytes([
    PNG_SIGNATURE,
    makeChunk('IHDR', ihdr),
    makeChunk('IDAT', new Uint8Array(compressed)),
    makeChunk('IEND', new Uint8Array(0)),
  ]);
}

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

test('decoder handles dynamic-Huffman compressed PNGs', async () => {
  const image = makeImage(8, 8, (x, y) => ({
    r: x * 30,
    g: y * 30,
    b: (x + y) * 15,
    a: 255,
  }));
  const png = makeCompressedRgbaPng(image, zlibConstants.Z_DEFAULT_STRATEGY);
  const decoded = await decodePng(png);
  assert.equal(decoded.width, 8);
  assert.equal(decoded.height, 8);
  assert.deepEqual([...decoded.data], [...image.data]);
});

test('decoder handles fixed-Huffman compressed PNGs', async () => {
  const image = makeImage(4, 4, (x, y) => ({
    r: 20 + x * 20,
    g: 40 + y * 20,
    b: 60,
    a: 255,
  }));
  const png = makeCompressedRgbaPng(image, zlibConstants.Z_FIXED);
  const decoded = await decodePng(png);
  assert.deepEqual([...decoded.data], [...image.data]);
});

test('indexed PNG round-trips colors and uses the right bit depth', async () => {
  const palette = [
    { color: { r: 255, g: 0, b: 0, a: 255 } },
    { color: { r: 0, g: 255, b: 0, a: 255 } },
    { color: { r: 0, g: 0, b: 255, a: 255 } },
    { color: { r: 255, g: 255, b: 255, a: 255 } },
  ];
  const indices = new Uint8Array([0, 1, 2, 3]);
  const png = await encodeIndexedPng({ width: 4, height: 1, indices, palette });
  const decoded = await decodePng(png);
  assert.equal(decoded.width, 4);
  assert.equal(decoded.height, 1);
  assert.deepEqual([...decoded.data], [
    255, 0, 0, 255,
    0, 255, 0, 255,
    0, 0, 255, 255,
    255, 255, 255, 255,
  ]);
});

test('indexed PNG writes tRNS for the transparent index', async () => {
  const palette = [
    { color: { r: 255, g: 0, b: 0, a: 255 } },
    { color: { r: 0, g: 0, b: 0, a: 255 } },
  ];
  const indices = new Uint8Array([0, 1, 0]);
  const png = await encodeIndexedPng({
    width: 3,
    height: 1,
    indices,
    palette,
    transparentIndex: 1,
  });
  const decoded = await decodePng(png);
  assert.deepEqual([...decoded.data], [
    255, 0, 0, 255,
    0, 0, 0, 0,
    255, 0, 0, 255,
  ]);
});

test('indexed PNG uses 8-bit indices for more than 16 colors', async () => {
  const palette = Array.from({ length: 17 }, (_, index) => ({
    color: { r: index * 15, g: 255 - index * 15, b: 128, a: 255 },
  }));
  const indices = new Uint8Array([0, 8, 16]);
  const png = await encodeIndexedPng({ width: 3, height: 1, indices, palette });
  const decoded = await decodePng(png);
  assert.deepEqual([...decoded.data], [
    0, 255, 128, 255,
    120, 135, 128, 255,
    240, 15, 128, 255,
  ]);
});
