// @ts-check
import test from 'node:test';
import assert from 'node:assert/strict';

import { fnv1a64Hex, sha256Hex, stableStringify } from '../js/core/hash.js';

test('stableStringify sorts object keys recursively', () => {
  const value = { b: 1, a: { d: 4, c: 3 }, list: [{ z: 1, y: 2 }] };
  assert.equal(
    stableStringify(value),
    '{"a":{"c":3,"d":4},"b":1,"list":[{"y":2,"z":1}]}',
  );
});

test('SHA-256 matches the known answer for "abc"', async () => {
  assert.equal(
    await sha256Hex('abc'),
    'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
  );
});

test('FNV-1a has the standard empty-string offset basis', () => {
  assert.equal(fnv1a64Hex(''), 'cbf29ce484222325');
});
