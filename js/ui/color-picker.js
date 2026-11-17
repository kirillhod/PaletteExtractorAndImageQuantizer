// @ts-check
import { clamp01, formatHex, hsvToRgb8, parseHex, rgb8ToHsv } from '../core/color.js';
import { t } from './i18n.js';

/**
 * @typedef {Object} ColorPickerOptions
 * @property {HTMLButtonElement} trigger Swatch button that owns the popover.
 * @property {(hex:string, persist:boolean) => void} onChange Receives `#rrggbb`; `persist`
 *   is false while a pointer is still moving and true when the value settles.
 */

/**
 * Saturation/value square, hue slider, and hex field in a popover under a swatch button.
 *
 * The browser's native color dialog cannot be styled, so it opens as a light rectangle
 * that belongs to the browser rather than to the page. The preview needs a picker that
 * reads like the rest of the UI and sits under the swatch it edits, so it carries its
 * own: a square field, a hue ramp, and a hex field on the usual surface and shadow.
 *
 * @param {ColorPickerOptions} options
 */
export function createColorPicker({ trigger, onChange }) {
  const root = document.createElement('div');
  root.className = 'peiq-color-picker';
  root.id = `${trigger.id}-picker`;
  root.hidden = true;
  root.setAttribute('role', 'group');

  const area = document.createElement('div');
  area.className = 'peiq-color-picker__area';
  area.tabIndex = 0;
  area.setAttribute('role', 'slider');
  area.setAttribute('aria-valuemin', '0');
  area.setAttribute('aria-valuemax', '100');

  const marker = document.createElement('span');
  marker.className = 'peiq-color-picker__marker';
  marker.setAttribute('aria-hidden', 'true');
  area.append(marker);

  const hue = document.createElement('input');
  hue.type = 'range';
  hue.className = 'peiq-color-picker__hue';
  hue.min = '0';
  hue.max = '360';
  hue.step = '1';

  const hex = document.createElement('input');
  hex.type = 'text';
  hex.className = 'peiq-input peiq-color-picker__hex';
  hex.maxLength = 7;
  hex.autocomplete = 'off';
  hex.spellcheck = false;
  hex.setAttribute('aria-invalid', 'false');

  root.append(area, hue, hex);
  trigger.parentElement?.append(root);

  let h = 0;
  let s = 0;
  let v = 0;
  let value = '#000000';
  let painted = false;
  let open = false;
  let pressingInside = false;

  /**
   * `#rgb` and `#rrggbb` only: the picker has no alpha channel.
   *
   * @param {string} input
   * @returns {string|null}
   */
  function normalizeHex(input) {
    try {
      const parsed = parseHex(input);
      return parsed.a === 255 ? formatHex(parsed) : null;
    } catch {
      return null;
    }
  }

  function paint() {
    value = formatHex(hsvToRgb8(h, s, v));
    trigger.style.setProperty('--swatch', value);
    // The field shows the hue as content, the same way a swatch shows its color.
    area.style.setProperty('--picker-hue', `hsl(${Math.round(h)} 100% 50%)`);
    marker.style.left = `${s * 100}%`;
    marker.style.top = `${(1 - v) * 100}%`;
    hue.value = String(Math.round(h));
    if (document.activeElement !== hex) hex.value = value;
    area.setAttribute('aria-valuenow', String(Math.round(s * 100)));
    area.setAttribute(
      'aria-valuetext',
      `S ${Math.round(s * 100)}%, V ${Math.round(v * 100)}%`,
    );
    painted = true;
  }

  /** @param {boolean} persist */
  function commit(persist) {
    paint();
    onChange(value, persist);
  }

  /**
   * Hue and saturation survive a color that has none of them: dragging the value down to
   * black must not reset the marker to red, so only a chromatic value overwrites the hue.
   *
   * @param {string} next
   * @param {boolean} persist
   */
  function applyHex(next, persist) {
    const rgb = parseHex(next);
    const hsv = rgb8ToHsv(rgb.r, rgb.g, rgb.b);
    if (hsv.s > 0) h = hsv.h;
    if (hsv.v > 0) s = hsv.s;
    v = hsv.v;
    commit(persist);
  }

  /**
   * @param {string} next
   */
  function setValue(next) {
    const normalized = normalizeHex(next);
    if (normalized === null) return;
    if (normalized === value) {
      // The first sync with the stored value matches the initial black; it still has to
      // paint the trigger swatch, the field, and the hex text.
      if (!painted) paint();
      return;
    }
    const rgb = parseHex(normalized);
    const hsv = rgb8ToHsv(rgb.r, rgb.g, rgb.b);
    if (hsv.s > 0) h = hsv.h;
    if (hsv.v > 0) s = hsv.s;
    v = hsv.v;
    paint();
  }

  /**
   * @param {PointerEvent} event
   */
  function updateFromPointer(event) {
    const rect = area.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    s = clamp01((event.clientX - rect.left) / rect.width);
    v = 1 - clamp01((event.clientY - rect.top) / rect.height);
    commit(false);
  }

  function position() {
    const rect = trigger.getBoundingClientRect();
    const width = root.offsetWidth;
    const height = root.offsetHeight;
    const margin = 8;
    const left = Math.max(
      margin,
      Math.min(rect.right - width, window.innerWidth - width - margin),
    );
    let top = rect.bottom + 6;
    if (top + height > window.innerHeight - margin) {
      top = Math.max(margin, rect.top - height - 6);
    }
    root.style.left = `${Math.round(left)}px`;
    root.style.top = `${Math.round(top)}px`;
  }

  function close() {
    if (!open) return;
    open = false;
    root.hidden = true;
    trigger.setAttribute('aria-expanded', 'false');
    document.removeEventListener('pointerdown', onDocumentPointerDown, true);
    window.removeEventListener('resize', onWindowResize);
  }

  /** @param {boolean} restoreFocus */
  function popoverClose(restoreFocus) {
    if (!open) return;
    close();
    if (restoreFocus) trigger.focus();
  }

  /**
   * @param {PointerEvent} event
   */
  function onDocumentPointerDown(event) {
    const target = /** @type {Node|null} */ (event.target);
    if (!target) return;
    if (root.contains(target) || trigger.contains(target)) return;
    close();
  }

  function onWindowResize() {
    if (open) position();
  }

  function openPopover() {
    if (open || trigger.disabled) return;
    open = true;
    root.hidden = false;
    position();
    trigger.setAttribute('aria-expanded', 'true');
    document.addEventListener('pointerdown', onDocumentPointerDown, true);
    window.addEventListener('resize', onWindowResize);
    area.focus();
  }

  function refresh() {
    const name = trigger.getAttribute('aria-label') ?? '';
    root.setAttribute('aria-label', name);
    area.setAttribute('aria-label', t('palette.pickerArea'));
    hue.setAttribute('aria-label', t('palette.pickerHue'));
    hex.setAttribute('aria-label', t('palette.pickerHex'));
  }

  trigger.setAttribute('aria-expanded', 'false');
  trigger.setAttribute('aria-controls', root.id);
  trigger.addEventListener('click', () => {
    if (open) close();
    else openPopover();
  });

  area.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    event.preventDefault();
    area.focus();
    area.setPointerCapture(event.pointerId);
    updateFromPointer(event);
  });
  area.addEventListener('pointermove', (event) => {
    if (!area.hasPointerCapture(event.pointerId)) return;
    updateFromPointer(event);
  });
  area.addEventListener('pointerup', (event) => {
    if (!area.hasPointerCapture(event.pointerId)) return;
    area.releasePointerCapture(event.pointerId);
    onChange(value, true);
  });
  area.addEventListener('pointercancel', (event) => {
    if (!area.hasPointerCapture(event.pointerId)) return;
    area.releasePointerCapture(event.pointerId);
    onChange(value, true);
  });
  area.addEventListener('keydown', (event) => {
    const step = event.shiftKey ? 0.1 : 0.01;
    let nextS = s;
    let nextV = v;
    switch (event.key) {
      case 'ArrowLeft':
        nextS = s - step;
        break;
      case 'ArrowRight':
        nextS = s + step;
        break;
      case 'ArrowUp':
        nextV = v + step;
        break;
      case 'ArrowDown':
        nextV = v - step;
        break;
      case 'Home':
        nextS = 0;
        break;
      case 'End':
        nextS = 1;
        break;
      default:
        return;
    }
    event.preventDefault();
    s = clamp01(nextS);
    v = clamp01(nextV);
    commit(true);
  });

  hue.addEventListener('input', () => {
    h = Number(hue.value);
    commit(false);
  });
  hue.addEventListener('change', () => {
    h = Number(hue.value);
    commit(true);
  });

  hex.addEventListener('input', () => {
    const normalized = normalizeHex(hex.value);
    hex.setAttribute('aria-invalid', String(normalized === null));
    // A three-digit value is valid but ambiguous while it is still being typed.
    if (normalized === null || hex.value.trim().length !== 7) return;
    applyHex(normalized, false);
  });
  hex.addEventListener('change', () => {
    const normalized = normalizeHex(hex.value);
    if (normalized === null) {
      hex.setAttribute('aria-invalid', 'true');
      hex.value = value;
      return;
    }
    hex.setAttribute('aria-invalid', 'false');
    applyHex(normalized, true);
    hex.value = value;
  });
  hex.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    hex.blur();
  });

  root.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    // The preview closes on Escape; inside the picker Escape only closes the picker.
    event.stopPropagation();
    event.preventDefault();
    popoverClose(true);
  });
  root.addEventListener('focusout', (event) => {
    const next = /** @type {Node|null} */ (event.relatedTarget);
    if (next && (root.contains(next) || trigger.contains(next))) return;
    // A press on the popover's own padding drops focus to the body; that is not a
    // decision to leave the picker.
    if (!next && pressingInside) return;
    close();
  });
  root.addEventListener('pointerdown', () => {
    pressingInside = true;
  });
  document.addEventListener(
    'pointerup',
    () => {
      pressingInside = false;
    },
    true,
  );

  refresh();

  return {
    setValue,
    refresh,
    close,
  };
}
