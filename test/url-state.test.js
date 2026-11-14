// @ts-check
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  URL_DEFAULTS,
  decodeUrlState,
  encodeUrlState,
} from '../js/core/url-state.js';

test('default settings round-trip through the URL', () => {
  const encoded = encodeUrlState(URL_DEFAULTS);
  assert.equal(encoded, 'v=1');
  assert.deepEqual(decodeUrlState(`#${encoded}`), URL_DEFAULTS);
  assert.deepEqual(decodeUrlState(''), URL_DEFAULTS);
});

test('custom settings round-trip and never contain image data', () => {
  const custom = {
    ...URL_DEFAULTS,
    mode: /** @type {const} */ ('map'),
    method: /** @type {const} */ ('kmeans'),
    colors: 64,
    space: /** @type {const} */ ('srgb'),
    palette: 'ega',
    dither: /** @type {const} */ ('bayer4'),
    strength: 42,
    serpentine: false,
    edgeStop: 12,
    alphaThreshold: 200,
    transparentIndex: 3,
    sortOrder: /** @type {const} */ ('manual'),
  };
  const encoded = encodeUrlState(custom);
  assert.ok(!/image|pixels|data=/i.test(encoded));
  assert.deepEqual(decodeUrlState(`#${encoded}`), custom);
});

test('invalid URL values are clamped or replaced with defaults', () => {
  const state = decodeUrlState(
    '#v=1&method=nope&colors=999&space=lab&dither=nope&strength=-4&edge=101&alpha=-5&transparent=999&sort=nope&palette=BAD%20ID',
  );
  assert.equal(state.method, URL_DEFAULTS.method);
  assert.equal(state.colors, 256);
  assert.equal(state.space, URL_DEFAULTS.space);
  assert.equal(state.dither, URL_DEFAULTS.dither);
  assert.equal(state.strength, 0);
  assert.equal(state.edgeStop, 100);
  assert.equal(state.alphaThreshold, 0);
  assert.equal(state.transparentIndex, 255);
  assert.equal(state.sortOrder, URL_DEFAULTS.sortOrder);
  assert.equal(state.palette, URL_DEFAULTS.palette);
});

test('serpentine and transparent index survive compact encoding', () => {
  const state = {
    ...URL_DEFAULTS,
    serpentine: false,
    transparentIndex: 0,
  };
  const encoded = encodeUrlState(state);
  assert.match(encoded, /serpentine=0/);
  assert.match(encoded, /transparent=0/);
  assert.deepEqual(decodeUrlState(encoded), state);
});
