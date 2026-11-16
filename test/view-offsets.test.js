// @ts-check
import test from 'node:test';
import assert from 'node:assert/strict';

import { recenterOffsets } from '../js/core/view-offsets.js';

test('widening the frame shifts the image by half the delta', () => {
  assert.deepEqual(
    recenterOffsets(
      { offsetX: 16, offsetY: 67 },
      { width: 1182, height: 603 },
      { width: 814, height: 603 },
    ),
    { offsetX: 200, offsetY: 67 },
  );
});

test('shrinking and height changes compensate on both axes', () => {
  assert.deepEqual(
    recenterOffsets(
      { offsetX: 200, offsetY: 40 },
      { width: 814, height: 500 },
      { width: 1182, height: 603 },
    ),
    { offsetX: 16, offsetY: -11.5 },
  );
});

test('an unchanged frame keeps the offsets exact', () => {
  const offsets = { offsetX: -12.5, offsetY: 3.25 };
  assert.deepEqual(
    recenterOffsets(offsets, { width: 800, height: 600 }, { width: 800, height: 600 }),
    offsets,
  );
});
