// @ts-check
/**
 * Pure helpers for the picked-color sample anchors. A marker is stored by palette
 * entry id; its point is normalized to the source image, so it survives layout,
 * zoom, and preview scaling.
 */

/** @typedef {{ u: number, v: number }} PickedPoint */
/** @typedef {{ id: number, u: number, v: number }} PickedMarkerRecord */
/** @typedef {Map<number, PickedPoint>} PickedMarkers */

/**
 * @param {PickedMarkers} markers
 * @returns {PickedMarkers}
 */
export function clonePickedMarkers(markers) {
  return new Map(
    [...markers].map(([id, point]) => [id, { u: point.u, v: point.v }]),
  );
}

/**
 * Stable serialization: id ascending, coordinates unchanged.
 *
 * @param {PickedMarkers} markers
 * @returns {PickedMarkerRecord[]}
 */
export function pickedMarkersToArray(markers) {
  return [...markers]
    .sort((a, b) => a[0] - b[0])
    .map(([id, point]) => ({ id, u: point.u, v: point.v }));
}

/**
 * Read stored markers without trusting the session. Invalid records are skipped;
 * coordinates outside 0..1 are clamped.
 *
 * @param {unknown} value
 * @returns {PickedMarkers}
 */
export function pickedMarkersFromArray(value) {
  const markers = new Map();
  if (!Array.isArray(value)) return markers;
  for (const record of value) {
    if (!record || typeof record !== 'object') continue;
    const entry = /** @type {PickedMarkerRecord} */ (record);
    if (!Number.isInteger(entry.id) || entry.id <= 0) continue;
    if (!Number.isFinite(entry.u) || !Number.isFinite(entry.v)) continue;
    markers.set(entry.id, {
      u: Math.min(1, Math.max(0, entry.u)),
      v: Math.min(1, Math.max(0, entry.v)),
    });
  }
  return markers;
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isValidPickedMarkerArray(value) {
  if (value === undefined) return true;
  if (!Array.isArray(value)) return false;
  return value.every((record) => {
    if (!record || typeof record !== 'object') return false;
    const entry = /** @type {PickedMarkerRecord} */ (record);
    return (
      Number.isInteger(entry.id) &&
      entry.id > 0 &&
      Number.isFinite(entry.u) &&
      entry.u >= 0 &&
      entry.u <= 1 &&
      Number.isFinite(entry.v) &&
      entry.v >= 0 &&
      entry.v <= 1
    );
  });
}
