// @ts-check
import test from 'node:test';
import assert from 'node:assert/strict';

import { buildHistogram, histogramBins } from '../js/core/histogram.js';
import { makeImage } from './helpers.js';

test('histogram separates two colors and keeps exact representatives', () => {
  const image = makeImage(2, 1, (x) => (x === 0 ? { r: 255, g: 0, b: 0 } : { r: 0, g: 0, b: 255 }));
  const hist = buildHistogram(image);
  assert.equal(hist.occupied.length, 2);
  assert.equal(hist.opaquePixels, 2);

  const bins = histogramBins(hist);
  const red = bins.find((bin) => bin.r === 255 && bin.g === 0 && bin.b === 0);
  const blue = bins.find((bin) => bin.r === 0 && bin.g === 0 && bin.b === 255);
  assert.ok(red && blue);
  assert.equal(red.weight, 1);
  assert.equal(blue.weight, 1);
});

test('fully transparent pixels are ignored', () => {
  const image = makeImage(3, 1, (x) => {
    if (x === 0) return { r: 255, g: 0, b: 0, a: 0 };
    if (x === 1) return { r: 0, g: 255, b: 0 };
    return { r: 0, g: 0, b: 255 };
  });
  const hist = buildHistogram(image);
  assert.equal(hist.occupied.length, 2);
  assert.equal(hist.opaquePixels, 2);
});

test('alpha weights the histogram', () => {
  const image = makeImage(2, 1, (x) =>
    x === 0
      ? { r: 255, g: 0, b: 0, a: 128 }
      : { r: 0, g: 0, b: 255, a: 255 },
  );
  const hist = buildHistogram(image);
  const bins = histogramBins(hist);
  const red = bins.find((bin) => bin.r === 255);
  const blue = bins.find((bin) => bin.b === 255);
  assert.ok(red && blue);
  assert.ok(Math.abs(red.weight - 128 / 255) < 1e-12);
  assert.equal(blue.weight, 1);
});
