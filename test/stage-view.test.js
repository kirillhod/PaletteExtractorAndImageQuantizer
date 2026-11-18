// @ts-check
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  STAGE_VIEWS,
  nextStageView,
  normalizeStageView,
} from '../js/core/stage-view.js';

test('unknown stage values fall back to the normal frame', () => {
  assert.equal(normalizeStageView('max'), 'max');
  assert.equal(normalizeStageView('hidden'), 'hidden');
  assert.equal(normalizeStageView('normal'), 'normal');
  assert.equal(normalizeStageView(undefined), 'normal');
  assert.equal(normalizeStageView('fullscreen'), 'normal');
  assert.deepEqual(STAGE_VIEWS, ['normal', 'max', 'hidden']);
});

test('a second press of the same action returns to the normal frame', () => {
  assert.equal(nextStageView('normal', 'max'), 'max');
  assert.equal(nextStageView('max', 'max'), 'normal');
  assert.equal(nextStageView('normal', 'hidden'), 'hidden');
  assert.equal(nextStageView('hidden', 'hidden'), 'normal');
});

test('the two views replace each other instead of combining', () => {
  assert.equal(nextStageView('max', 'hidden'), 'hidden');
  assert.equal(nextStageView('hidden', 'max'), 'max');
});

test('restore always returns to the normal frame', () => {
  assert.equal(nextStageView('max', 'restore'), 'normal');
  assert.equal(nextStageView('hidden', 'restore'), 'normal');
  assert.equal(nextStageView('normal', 'restore'), 'normal');
});
