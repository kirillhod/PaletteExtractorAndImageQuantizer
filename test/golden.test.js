// @ts-check
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

import { runPreview } from '../js/core/pipeline.js';
import { quadrantsImage } from './helpers.js';

const params = /** @type {const} */ ({
  method: 'median-cut',
  colors: 4,
  space: 'oklab',
});

/**
 * @param {Uint8ClampedArray} data
 */
function hashBytes(data) {
  return createHash('sha256').update(Buffer.from(data)).digest('hex');
}

/**
 * @param {{ hex: string }[]} palette
 */
function hashPalette(palette) {
  return createHash('sha256').update(palette.map((entry) => entry.hex).join(',')).digest('hex');
}

test('the M1 fixture has a reviewed palette and preview hash', async () => {
  const image = quadrantsImage(16);
  const result = await runPreview({ image, params });
  const paletteHash = hashPalette(result.palette);
  const previewHash = hashBytes(result.preview.data);

  assert.equal(result.palette.length, 4);
  assert.equal(paletteHash, '116b528c910583a2cfde612c9cb9cf1ad0268715914b660b857ca2132e35f1ce');
  assert.equal(previewHash, 'e9182794f07539f2124dec73c75a980dc23e69aeb9626797bd248ce55c92dee8');
});

test('the same fixture is deterministic across runs', async () => {
  const image = quadrantsImage(16);
  const first = await runPreview({ image, params });
  const second = await runPreview({ image, params });
  assert.equal(hashPalette(first.palette), hashPalette(second.palette));
  assert.equal(hashBytes(first.preview.data), hashBytes(second.preview.data));
});
