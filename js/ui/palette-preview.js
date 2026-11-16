// @ts-check
import {
  PREVIEW_BACKGROUND_PRESETS,
  normalizePreviewBackground,
} from '../core/preview-bg.js';
import { countLabel, t } from './i18n.js';

const STORAGE_KEY = 'peiq.previewBg';
const OPEN_CLASS = 'peiq-preview-open';

/**
 * @typedef {Object} PalettePreviewDeps
 * @property {() => { hex: string }[]} getPalette
 */

/**
 * Full-screen palette strip. The palette is read-only; the only state it owns is the
 * user-chosen background, persisted under `peiq.previewBg`.
 *
 * @param {PalettePreviewDeps} deps
 */
export function createPalettePreview(deps) {
  const trigger = /** @type {HTMLButtonElement|null} */ (
    document.getElementById('palette-preview-open')
  );
  const dialog = /** @type {HTMLElement|null} */ (
    document.getElementById('palette-preview')
  );
  const stage = document.getElementById('palette-preview-stage');
  const strip = document.getElementById('palette-preview-strip');
  const closeButton = /** @type {HTMLButtonElement|null} */ (
    document.getElementById('palette-preview-close')
  );
  const presetsHost = document.getElementById('palette-preview-presets');
  const colorInput = /** @type {HTMLInputElement|null} */ (
    document.getElementById('palette-preview-bg')
  );

  if (
    !trigger ||
    !dialog ||
    !stage ||
    !strip ||
    !closeButton ||
    !presetsHost ||
    !colorInput
  ) {
    return {
      open() {},
      close() {},
      refresh() {},
      isOpen: () => false,
    };
  }

  /** @type {HTMLElement|null} */
  let lastFocus = null;

  /** @type {HTMLButtonElement[]} */
  const presetButtons = [];
  for (const preset of PREVIEW_BACKGROUND_PRESETS) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'peiq-palette-preview__preset';
    button.dataset.bg = preset.hex;
    button.style.setProperty('--swatch', preset.hex);
    button.setAttribute('aria-pressed', 'false');
    button.addEventListener('click', () => setBackground(preset.hex));
    presetsHost.append(button);
    presetButtons.push(button);
  }

  function readStoredBackground() {
    try {
      return window.localStorage.getItem(STORAGE_KEY);
    } catch {
      // Storage can be blocked; the page keeps the default for this visit.
      return null;
    }
  }

  /** @param {string} value @param {boolean} [persist] */
  function setBackground(value, persist = true) {
    const background = normalizePreviewBackground(value);
    dialog.style.setProperty('--peiq-preview-bg', background);
    colorInput.value = background;
    for (const button of presetButtons) {
      button.setAttribute('aria-pressed', String(button.dataset.bg === background));
    }
    if (!persist) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, background);
    } catch {
      // The chosen background still applies for this visit.
    }
  }

  function isOpen() {
    return dialog.hidden === false;
  }

  function renderStrip() {
    const palette = deps.getPalette();
    if (palette.length === 0 && isOpen()) close();
    trigger.disabled = palette.length === 0;
    if (!isOpen()) return;
    strip.replaceChildren();
    for (const entry of palette) {
      const swatch = document.createElement('span');
      swatch.className = 'peiq-palette-preview__swatch';
      swatch.style.setProperty('--swatch', entry.hex);
      strip.append(swatch);
    }
    strip.setAttribute(
      'aria-label',
      `${t('palette.previewTitle')} · ${countLabel('count.colors', palette.length)}`,
    );
  }

  function refresh() {
    for (const [index, preset] of PREVIEW_BACKGROUND_PRESETS.entries()) {
      const button = presetButtons[index];
      const label = t(preset.labelKey);
      button.setAttribute('aria-label', label);
      button.setAttribute('title', label);
      button.setAttribute('aria-pressed', String(button.dataset.bg === colorInput.value));
    }
    renderStrip();
  }

  function open() {
    if (deps.getPalette().length === 0) return;
    lastFocus = /** @type {HTMLElement|null} */ (document.activeElement);
    dialog.hidden = false;
    trigger.setAttribute('aria-expanded', 'true');
    document.documentElement.classList.add(OPEN_CLASS);
    refresh();
    closeButton.focus();
  }

  function close() {
    if (!isOpen()) return;
    dialog.hidden = true;
    trigger.setAttribute('aria-expanded', 'false');
    document.documentElement.classList.remove(OPEN_CLASS);
    const target =
      lastFocus && lastFocus.isConnected && lastFocus !== document.body
        ? lastFocus
        : trigger;
    lastFocus = null;
    target.focus();
  }

  function trapFocus(event) {
    if (event.key !== 'Tab') return;
    const focusable = /** @type {HTMLElement[]} */ (
      [...dialog.querySelectorAll('button:not([disabled]), input:not([disabled])')]
    );
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  trigger.addEventListener('click', open);
  closeButton.addEventListener('click', close);
  stage.addEventListener('click', (event) => {
    if (event.target === stage) close();
  });
  dialog.addEventListener('keydown', trapFocus);
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && isOpen()) {
      event.preventDefault();
      close();
    }
  });
  colorInput.addEventListener('input', () => setBackground(colorInput.value, false));
  colorInput.addEventListener('change', () => setBackground(colorInput.value));
  window.addEventListener('peiqq:localechange', refresh);

  setBackground(readStoredBackground(), false);
  refresh();

  return { open, close, refresh, isOpen };
}
