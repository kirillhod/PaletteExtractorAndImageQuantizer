// @ts-check
/**
 * Version constants for the application and the deterministic algorithms.
 * Keep `APP_VERSION` in sync with `package.json`; a version-bump commit updates both
 * and is the only commit that receives an annotated `vX.Y.Z` tag.
 */

/** @type {string} */
export const APP_VERSION = '0.1.0';

/**
 * Bump this when a decision-affecting rule changes (tie-break, ordering, hashing, or
 * quantizer behavior). It is recorded in manifests and reports.
 * @type {number}
 */
export const ALGORITHM_VERSION = 1;
