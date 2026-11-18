// @ts-check
/**
 * Canvas zoom limits. A 32×32 sprite sets the ceiling: at 16× it covers only 512 px,
 * which is smaller than the stage, so the cap is 64× (6400%) and a 32 px sprite can be
 * worked on at 2048 px. The minimum stays at 2% so a large photo still fits.
 */

export const MIN_CANVAS_ZOOM = 0.02;
export const MAX_CANVAS_ZOOM = 64;

/**
 * Clamp a zoom factor into the supported range. A non-finite or non-positive value falls
 * back to 1:1 instead of leaving the canvas in an undefined state.
 *
 * @param {number} scale
 * @returns {number}
 */
export function clampCanvasZoom(scale) {
  if (!Number.isFinite(scale) || scale <= 0) return 1;
  return Math.min(MAX_CANVAS_ZOOM, Math.max(MIN_CANVAS_ZOOM, scale));
}
