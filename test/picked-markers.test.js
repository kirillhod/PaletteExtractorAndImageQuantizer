// @ts-check
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  clonePickedMarkers,
  isValidPickedMarkerArray,
  pickedMarkersFromArray,
  pickedMarkersToArray,
} from '../js/core/picked-markers.js';

test('picked markers round-trip in id order and clone independently', () => {
  const markers = new Map([
    [3, { u: 0.25, v: 0.75 }],
    [1, { u: 0.1, v: 0.2 }],
  ]);
  const array = pickedMarkersToArray(markers);
  assert.deepEqual(array, [
    { id: 1, u: 0.1, v: 0.2 },
    { id: 3, u: 0.25, v: 0.75 },
  ]);
  const restored = pickedMarkersFromArray(array);
  assert.deepEqual(pickedMarkersToArray(restored), array);

  const clone = clonePickedMarkers(markers);
  clone.get(1).u = 0.9;
  assert.equal(markers.get(1).u, 0.1);
});

test('stored markers are clamped and malformed records are skipped', () => {
  const markers = pickedMarkersFromArray([
    { id: 2, u: -1, v: 2 },
    { id: 0, u: 0.5, v: 0.5 },
    { id: 4, u: Number.NaN, v: 0.5 },
    null,
  ]);
  assert.deepEqual(pickedMarkersToArray(markers), [{ id: 2, u: 0, v: 1 }]);
});

test('marker validation accepts missing, valid, and rejects malformed arrays', () => {
  assert.equal(isValidPickedMarkerArray(undefined), true);
  assert.equal(isValidPickedMarkerArray([{ id: 1, u: 0, v: 1 }]), true);
  assert.equal(isValidPickedMarkerArray([{ id: 1, u: -0.1, v: 1 }]), false);
  assert.equal(isValidPickedMarkerArray([{ id: 0, u: 0.5, v: 0.5 }]), false);
  assert.equal(isValidPickedMarkerArray({ id: 1 }), false);
});
