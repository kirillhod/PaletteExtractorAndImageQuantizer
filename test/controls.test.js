// @ts-check
import test from 'node:test';
import assert from 'node:assert/strict';

import { normalizeMethod } from '../js/ui/controls.js';

test('every extractor select value reaches its own algorithm', () => {
  for (const method of ['popularity', 'median-cut', 'wu', 'octree', 'kmeans']) {
    assert.equal(normalizeMethod(method), method);
  }
  assert.equal(normalizeMethod('unknown'), 'wu');
  assert.equal(normalizeMethod(undefined), 'wu');
});
