// @ts-check
import test from 'node:test';
import assert from 'node:assert/strict';

import { createRng } from '../js/core/rng.js';

test('splitmix64 is deterministic for a fixed seed', () => {
  const a = createRng(42);
  const b = createRng(42);
  for (let i = 0; i < 8; i++) assert.equal(a.nextU64(), b.nextU64());
});

test('splitmix64 seed 0 starts with the reference value', () => {
  const rng = createRng(0);
  assert.equal(rng.nextU64(), 0xe220a8397b1dcdafn);
});

test('nextFloat stays in [0, 1)', () => {
  const rng = createRng(7);
  for (let i = 0; i < 1000; i++) {
    const value = rng.nextFloat();
    assert.ok(value >= 0 && value < 1);
  }
});

test('nextInt stays in range and rejects invalid bounds', () => {
  const rng = createRng(9);
  for (let i = 0; i < 100; i++) {
    const value = rng.nextInt(16);
    assert.ok(Number.isInteger(value) && value >= 0 && value < 16);
  }
  assert.throws(() => rng.nextInt(0), RangeError);
  assert.throws(() => rng.nextInt(1.5), RangeError);
});
