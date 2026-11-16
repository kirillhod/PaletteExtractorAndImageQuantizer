// @ts-check
/** @typedef {'open'|'closed'} RailState */

/**
 * The settings rail is open unless it was explicitly collapsed.
 * @param {string|null|undefined} value
 * @returns {RailState}
 */
export function normalizeRailState(value) {
  return value === 'closed' ? 'closed' : 'open';
}

/**
 * @param {RailState} state
 * @returns {RailState}
 */
export function nextRailState(state) {
  return normalizeRailState(state) === 'open' ? 'closed' : 'open';
}
