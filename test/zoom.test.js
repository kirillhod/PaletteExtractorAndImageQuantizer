// @ts-check
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  MAX_CANVAS_ZOOM,
  MIN_CANVAS_ZOOM,
  clampCanvasZoom,
} from '../js/core/zoom.js';

test('zoom keeps the requested factor inside the range', () => {
  assert.equal(clampCanvasZoom(1), 1);
  assert.equal(clampCanvasZoom(19.7), 19.7);
  assert.equal(clampCanvasZoom(MAX_CANVAS_ZOOM), MAX_CANVAS_ZOOM);
});

test('zoom stops at 64x so a 32 px sprite reaches 2048 px', () => {
  assert.equal(MAX_CANVAS_ZOOM, 64);
  assert.equal(clampCanvasZoom(1000), 64);
  assert.equal(32 * MAX_CANVAS_ZOOM, 2048);
});

test('zoom keeps its 2% floor for large photos', () => {
  assert.equal(MIN_CANVAS_ZOOM, 0.02);
  assert.equal(clampCanvasZoom(0.001), 0.02);
});

test('an unusable factor falls back to 1:1', () => {
  assert.equal(clampCanvasZoom(Number.NaN), 1);
  assert.equal(clampCanvasZoom(Number.POSITIVE_INFINITY), 1);
  assert.equal(clampCanvasZoom(0), 1);
  assert.equal(clampCanvasZoom(-4), 1);
});
