// @ts-check
import { debounce } from './dom.js';

const MIN_COLORS = 2;
const MAX_COLORS = 256;

/**
 * @param {number} value
 * @returns {number}
 */
function clampColorCount(value) {
  if (!Number.isFinite(value)) return 16;
  return Math.min(MAX_COLORS, Math.max(MIN_COLORS, Math.round(value)));
}

/**
 * @param {{ onChange:(params:{ method:'popularity'|'median-cut'|'wu'|'octree'|'kmeans', colors:number, space:'oklab'|'srgb' }) => void }} handlers
 */
export function initControls(handlers) {
  const method = /** @type {HTMLSelectElement|null} */ (document.getElementById('method'));
  const colors = /** @type {HTMLInputElement|null} */ (document.getElementById('colors'));
  const colorsNumber = /** @type {HTMLInputElement|null} */ (
    document.getElementById('colors-number')
  );
  const space = /** @type {HTMLSelectElement|null} */ (document.getElementById('space'));

  function getParams() {
    const value = Number(colors?.value ?? 16);
    return {
      method:
        method?.value === 'popularity'
          ? 'popularity'
          : method?.value === 'wu'
            ? 'wu'
            : method?.value === 'octree'
              ? 'octree'
              : method?.value === 'kmeans'
                ? 'kmeans'
                : 'median-cut',
      colors: clampColorCount(value),
      space: space?.value === 'srgb' ? 'srgb' : 'oklab',
    };
  }

  const emit = debounce(() => handlers.onChange(getParams()), 150);

  function syncFromRange() {
    if (colorsNumber && colors) colorsNumber.value = colors.value;
    emit();
  }

  function handleNumberInput() {
    if (!colorsNumber || !colors) return;
    const value = Number(colorsNumber.value);
    // Leave partial or out-of-range typing alone; clamp when the field commits.
    if (!Number.isFinite(value) || value < MIN_COLORS || value > MAX_COLORS) return;
    colors.value = String(Math.round(value));
    emit();
  }

  function handleNumberCommit() {
    if (!colorsNumber || !colors) return;
    const text = colorsNumber.value.trim();
    const value = text === '' ? 16 : clampColorCount(Number(text));
    colorsNumber.value = String(value);
    colors.value = String(value);
    emit();
  }

  if (colorsNumber && colors) colorsNumber.value = colors.value;
  method?.addEventListener('change', emit);
  colors?.addEventListener('input', syncFromRange);
  colors?.addEventListener('change', syncFromRange);
  colorsNumber?.addEventListener('input', handleNumberInput);
  colorsNumber?.addEventListener('change', handleNumberCommit);
  space?.addEventListener('change', emit);

  return { getParams };
}
