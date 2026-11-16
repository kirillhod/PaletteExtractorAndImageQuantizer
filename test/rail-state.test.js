// @ts-check
import test from 'node:test';
import assert from 'node:assert/strict';

import { nextRailState, normalizeRailState } from '../js/core/rail-state.js';

test('a missing or unknown rail state stays open', () => {
  assert.equal(normalizeRailState(null), 'open');
  assert.equal(normalizeRailState(undefined), 'open');
  assert.equal(normalizeRailState('open'), 'open');
  assert.equal(normalizeRailState('folded'), 'open');
  assert.equal(normalizeRailState('closed'), 'closed');
});

test('the header toggle flips the rail between open and closed', () => {
  assert.equal(nextRailState('open'), 'closed');
  assert.equal(nextRailState('closed'), 'open');
  assert.equal(nextRailState('unknown'), 'closed');
});
