// @ts-check
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { ALGORITHM_VERSION, APP_VERSION } from '../js/core/version.js';

test('APP_VERSION matches package.json', () => {
  const pkg = JSON.parse(
    readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
  );
  assert.equal(APP_VERSION, pkg.version);
});

test('ALGORITHM_VERSION is a positive integer', () => {
  assert.ok(Number.isInteger(ALGORITHM_VERSION));
  assert.ok(ALGORITHM_VERSION > 0);
});
