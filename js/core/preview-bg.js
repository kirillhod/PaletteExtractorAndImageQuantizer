// @ts-check

/**
 * @typedef {Object} PreviewBackgroundPreset
 * @property {string} id
 * @property {string} hex
 * @property {string} labelKey
 */

export const DEFAULT_PREVIEW_BACKGROUND = '#808080';

/** @type {readonly PreviewBackgroundPreset[]} */
export const PREVIEW_BACKGROUND_PRESETS = Object.freeze([
  { id: 'mid', hex: '#808080', labelKey: 'palette.previewGrayMid' },
  { id: 'dark', hex: '#767676', labelKey: 'palette.previewGrayDark' },
]);

/**
 * @param {unknown} value
 * @returns {string|null}
 */
function normalizeHex(value) {
  if (typeof value !== 'string') return null;
  const match = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(value.trim());
  if (!match) return null;
  const digits = match[1];
  const expanded =
    digits.length === 3
      ? `${digits[0]}${digits[0]}${digits[1]}${digits[1]}${digits[2]}${digits[2]}`
      : digits;
  return `#${expanded.toLowerCase()}`;
}

/**
 * Normalize a stored or picked preview background to `#rrggbb`.
 * Invalid values fall back to `fallback` when that is valid, otherwise to the
 * neutral mid gray used by the preview.
 *
 * @param {unknown} value
 * @param {string} [fallback]
 * @returns {string}
 */
export function normalizePreviewBackground(
  value,
  fallback = DEFAULT_PREVIEW_BACKGROUND,
) {
  return (
    normalizeHex(value) ??
    normalizeHex(fallback) ??
    DEFAULT_PREVIEW_BACKGROUND
  );
}
