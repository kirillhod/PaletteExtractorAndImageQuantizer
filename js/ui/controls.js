// @ts-check
import { debounce } from './dom.js';

/**
 * @param {{ onChange:(params:{ method:'popularity'|'median-cut', colors:number, space:'oklab'|'srgb' }) => void }} handlers
 */
export function initControls(handlers) {
  const method = /** @type {HTMLSelectElement|null} */ (document.getElementById('method'));
  const colors = /** @type {HTMLInputElement|null} */ (document.getElementById('colors'));
  const colorsValue = document.getElementById('colors-value');
  const space = /** @type {HTMLSelectElement|null} */ (document.getElementById('space'));

  function getParams() {
    const value = Number(colors?.value ?? 16);
    const colorCount = Number.isFinite(value) ? Math.min(256, Math.max(2, Math.round(value))) : 16;
    return {
      method: method?.value === 'popularity' ? 'popularity' : 'median-cut',
      colors: colorCount,
      space: space?.value === 'srgb' ? 'srgb' : 'oklab',
    };
  }

  const emit = debounce(() => handlers.onChange(getParams()), 150);

  function update() {
    const params = getParams();
    if (colorsValue) colorsValue.textContent = String(params.colors);
    emit();
  }

  if (colorsValue) colorsValue.textContent = String(getParams().colors);
  method?.addEventListener('change', update);
  colors?.addEventListener('input', update);
  colors?.addEventListener('change', update);
  space?.addEventListener('change', update);

  return { getParams };
}
