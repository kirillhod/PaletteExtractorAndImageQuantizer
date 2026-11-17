// @ts-check
import { parseHex } from './color.js';

/**
 * @typedef {'row'|'column'|'grid'} PreviewMode
 * @typedef {{ mode:PreviewMode, columns:number, hex:boolean, rgb:boolean }} PreviewLayout
 * @typedef {{ hex:string, color?:{ r:number, g:number, b:number } }} LabelEntry
 */

/** @type {readonly PreviewMode[]} */
export const PREVIEW_MODES = Object.freeze(['row', 'column', 'grid']);

/**
 * The values offered by the "per row" select. `0` means automatic: a square-ish grid
 * whose column count follows the palette size.
 */
export const PREVIEW_COLUMN_CHOICES = Object.freeze([0, 2, 4, 6, 8, 10, 12, 16, 20, 24, 32]);

/** @type {Readonly<PreviewLayout>} */
export const DEFAULT_PREVIEW_LAYOUT = Object.freeze({
  mode: 'row',
  columns: 0,
  hex: false,
  rgb: false,
});

export const PREVIEW_AUTO_MAX_COLUMNS = 16;
export const PREVIEW_MAX_COLUMNS = 32;

/**
 * Normalize a stored or hand-edited preview layout. Unknown fields fall back one by
 * one, so a stored value from an older release keeps its valid parts.
 *
 * @param {unknown} value
 * @returns {PreviewLayout}
 */
export function normalizePreviewLayout(value) {
  const source =
    value && typeof value === 'object' ? /** @type {Record<string, unknown>} */ (value) : {};
  return {
    mode: PREVIEW_MODES.includes(/** @type {PreviewMode} */ (source.mode))
      ? /** @type {PreviewMode} */ (source.mode)
      : DEFAULT_PREVIEW_LAYOUT.mode,
    columns: PREVIEW_COLUMN_CHOICES.includes(/** @type {number} */ (source.columns))
      ? /** @type {number} */ (source.columns)
      : DEFAULT_PREVIEW_LAYOUT.columns,
    hex: source.hex === true,
    rgb: source.rgb === true,
  };
}

/**
 * Columns for the grid mode. An explicit choice is capped by the palette size, so
 * "32 per row" with 8 colors still fills one row instead of leaving 24 empty cells.
 *
 * @param {number} count
 * @param {number} columns
 * @returns {number}
 */
export function previewGridColumns(count, columns) {
  const total = Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
  if (total <= 1) return 1;
  const explicit = PREVIEW_COLUMN_CHOICES.includes(columns) ? columns : 0;
  if (explicit > 0) return Math.min(explicit, total, PREVIEW_MAX_COLUMNS);
  return Math.max(1, Math.min(PREVIEW_AUTO_MAX_COLUMNS, Math.ceil(Math.sqrt(total))));
}

/**
 * Visible caption lines for one swatch, in the order the checkboxes are listed in the
 * UI. `entry.color` is preferred because the palette already carries it; the hex is
 * parsed only when a caller passes a bare entry.
 *
 * @param {LabelEntry|null|undefined} entry
 * @param {{ hex:boolean, rgb:boolean }} labels
 * @returns {string[]}
 */
export function previewSwatchLabels(entry, labels) {
  /** @type {string[]} */
  const lines = [];
  if (!entry || typeof entry.hex !== 'string') return lines;
  if (labels.hex) lines.push(entry.hex.toLowerCase());
  if (labels.rgb) {
    const color = entry.color ?? parseHex(entry.hex);
    lines.push(`${color.r} ${color.g} ${color.b}`);
  }
  return lines;
}
