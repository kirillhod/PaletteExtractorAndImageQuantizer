// @ts-check

/** Preview keeps the full image up to this many pixels (about 4 MP). */
export const PREVIEW_FULL_PIXELS = 4_194_304;

/**
 * @typedef {Object} PreviewSize
 * @property {number} width
 * @property {number} height
 * @property {boolean} scaled False when the preview is the full-resolution image.
 */

/**
 * Resolution of the mapping preview. Small images stay at full resolution; anything above
 * the pixel budget is scaled down by area to sit just under that budget, so the preview
 * keeps the source's aspect ratio and spends the whole allowance instead of capping one
 * edge. The original half of the canvas always draws the full-resolution image, and export
 * always re-reads the full image, so this only controls the mapping pass.
 *
 * @param {number} width
 * @param {number} height
 * @returns {PreviewSize}
 */
export function previewSize(width, height) {
  if (
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width < 1 ||
    height < 1
  ) {
    throw new RangeError('previewSize needs positive integer dimensions');
  }
  if (width * height <= PREVIEW_FULL_PIXELS) {
    return { width, height, scaled: false };
  }
  const scale = Math.sqrt(PREVIEW_FULL_PIXELS / (width * height));
  // Rounding can land one pixel above the budget, so step the long edge down until the
  // product fits. The loop runs at most a couple of times.
  let previewWidth = Math.max(1, Math.round(width * scale));
  let previewHeight = Math.max(1, Math.round(height * scale));
  while (previewWidth * previewHeight > PREVIEW_FULL_PIXELS && previewWidth > 1) {
    previewWidth -= 1;
    previewHeight = Math.max(1, Math.round((height * previewWidth) / width));
  }
  return { width: previewWidth, height: previewHeight, scaled: true };
}
