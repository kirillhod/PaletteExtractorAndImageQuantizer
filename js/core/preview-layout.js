// @ts-check
import { parseHex } from './color.js';

/**
 * @typedef {'row'|'column'|'grid'} PreviewMode
 * @typedef {{ mode:PreviewMode, columns:number, hex:boolean, rgb:boolean, labelColor:string }} PreviewLayout
 * @typedef {{ hex:string, color?:{ r:number, g:number, b:number } }} LabelEntry
 */

/** @type {readonly PreviewMode[]} */
export const PREVIEW_MODES = Object.freeze(['row', 'column', 'grid']);

/**
 * The values offered by the "per row" select. `0` means automatic: a square-ish grid
 * whose column count follows the palette size.
 */
export const PREVIEW_COLUMN_CHOICES = Object.freeze([0, 2, 4, 6, 8, 10, 12, 16, 20, 24, 32]);

export const DEFAULT_CAPTION_COLOR = '#000000';

/** @type {Readonly<PreviewLayout>} */
export const DEFAULT_PREVIEW_LAYOUT = Object.freeze({
  mode: 'row',
  columns: 0,
  hex: false,
  rgb: false,
  labelColor: DEFAULT_CAPTION_COLOR,
});

export const PREVIEW_AUTO_MAX_COLUMNS = 16;
export const PREVIEW_MAX_COLUMNS = 32;

/**
 * Caption text sits directly on the user-chosen preview background, so its color is a
 * user setting too. Anything that is not a six-digit hex falls back to black.
 *
 * @param {unknown} value
 * @returns {string}
 */
export function normalizeCaptionColor(value) {
  if (typeof value !== 'string') return DEFAULT_CAPTION_COLOR;
  const match = /^#?([0-9a-f]{6})$/i.exec(value.trim());
  return match ? `#${match[1].toLowerCase()}` : DEFAULT_CAPTION_COLOR;
}

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
    labelColor: normalizeCaptionColor(source.labelColor),
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
 * UI, together with the tokens that make each line. `entry.color` is preferred because
 * the palette already carries it; the hex is parsed only when a caller passes a bare
 * entry.
 *
 * Row mode gives a color a narrow column, where the RGB triple is easier to read stacked
 * by channel than wrapped at an arbitrary space, so the UI needs the three numbers
 * separately even though the plain label joins them.
 *
 * @typedef {{ kind:'hex'|'rgb', text:string, parts:string[] }} PreviewLabelRow
 * @param {LabelEntry|null|undefined} entry
 * @param {{ hex:boolean, rgb:boolean }} labels
 * @returns {PreviewLabelRow[]}
 */
export function previewSwatchLabelRows(entry, labels) {
  /** @type {PreviewLabelRow[]} */
  const rows = [];
  if (!entry || typeof entry.hex !== 'string') return rows;
  if (labels.hex) {
    const hex = entry.hex.toLowerCase();
    rows.push({ kind: 'hex', text: hex, parts: [hex] });
  }
  if (labels.rgb) {
    const color = entry.color ?? parseHex(entry.hex);
    const parts = [String(color.r), String(color.g), String(color.b)];
    rows.push({ kind: 'rgb', text: parts.join(' '), parts });
  }
  return rows;
}

/**
 * Visible caption lines as plain strings, for `aria-label` and callers that do not
 * need the per-channel tokens.
 *
 * @param {LabelEntry|null|undefined} entry
 * @param {{ hex:boolean, rgb:boolean }} labels
 * @returns {string[]}
 */
export function previewSwatchLabels(entry, labels) {
  return previewSwatchLabelRows(entry, labels).map((row) => row.text);
}
