// @ts-check
import {
  DEFAULT_PREVIEW_LAYOUT,
  PREVIEW_COLUMN_CHOICES,
  normalizePreviewLayout,
  previewGridColumns,
  previewSwatchLabels,
} from '../core/preview-layout.js';
import {
  PREVIEW_BACKGROUND_PRESETS,
  normalizePreviewBackground,
} from '../core/preview-bg.js';
import { countLabel, t } from './i18n.js';

const BACKGROUND_KEY = 'peiq.previewBg';
const LAYOUT_KEY = 'peiq.previewLayout';
const OPEN_CLASS = 'peiq-preview-open';

/**
 * @typedef {Object} PalettePreviewDeps
 * @property {() => { hex:string, color?:{ r:number, g:number, b:number } }[]} getPalette
 */

/**
 * Full-screen palette strip. The palette is read-only; the only state it owns is the
 * user-chosen background under `peiq.previewBg` and the layout and label toggles under
 * `peiq.previewLayout`.
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
  const columnsSelect = /** @type {HTMLSelectElement|null} */ (
    document.getElementById('palette-preview-columns')
  );
  const hexInput = /** @type {HTMLInputElement|null} */ (
    document.getElementById('palette-preview-hex')
  );
  const rgbInput = /** @type {HTMLInputElement|null} */ (
    document.getElementById('palette-preview-rgb')
  );

  if (
    !trigger ||
    !dialog ||
    !stage ||
    !strip ||
    !closeButton ||
    !presetsHost ||
    !colorInput ||
    !columnsSelect ||
    !hexInput ||
    !rgbInput
  ) {
    return {
      open() {},
      close() {},
      refresh() {},
      isOpen: () => false,
    };
  }

  const modeButtons = /** @type {HTMLButtonElement[]} */ (
    [...dialog.querySelectorAll('[data-mode]')]
  );

  /** @type {HTMLElement|null} */
  let lastFocus = null;
  /** @type {import('../core/preview-layout.js').PreviewLayout} */
  let layout = { ...DEFAULT_PREVIEW_LAYOUT };

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

  /** @type {HTMLOptionElement|null} */
  let autoOption = null;
  for (const choice of PREVIEW_COLUMN_CHOICES) {
    const option = document.createElement('option');
    option.value = String(choice);
    option.textContent = choice === 0 ? t('palette.previewAuto') : String(choice);
    columnsSelect.append(option);
    if (choice === 0) autoOption = option;
  }

  /**
   * @param {string} key
   * @returns {string|null}
   */
  function readStored(key) {
    try {
      return window.localStorage.getItem(key);
    } catch {
      // Storage can be blocked; the page keeps the defaults for this visit.
      return null;
    }
  }

  /** @param {string} key @param {string} value */
  function writeStored(key, value) {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      // The choice still applies for this visit.
    }
  }

  function readLayout() {
    const raw = readStored(LAYOUT_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }
  layout = normalizePreviewLayout(readLayout());

  /** @param {string} value @param {boolean} [persist] */
  function setBackground(value, persist = true) {
    const background = normalizePreviewBackground(value);
    dialog.style.setProperty('--peiq-preview-bg', background);
    colorInput.value = background;
    for (const button of presetButtons) {
      button.setAttribute('aria-pressed', String(button.dataset.bg === background));
    }
    if (!persist) return;
    writeStored(BACKGROUND_KEY, background);
  }

  function isOpen() {
    return dialog.hidden === false;
  }

  /**
   * @param {Partial<{ mode:string, columns:number, hex:boolean, rgb:boolean }>} patch
   * @param {boolean} [persist]
   */
  function setLayout(patch, persist = true) {
    layout = normalizePreviewLayout({ ...layout, ...patch });
    applyLayout();
    renderStrip();
    if (!persist) return;
    writeStored(LAYOUT_KEY, JSON.stringify(layout));
  }

  /**
   * Mirror the stored layout into the controls and the dialog attribute that drives
   * the stage and strip rules.
   */
  function applyLayout() {
    dialog.dataset.mode = layout.mode;
    for (const button of modeButtons) {
      button.setAttribute('aria-pressed', String(button.dataset.mode === layout.mode));
    }
    columnsSelect.value = String(layout.columns);
    columnsSelect.disabled = layout.mode !== 'grid';
    hexInput.checked = layout.hex;
    rgbInput.checked = layout.rgb;
  }

  function renderStrip() {
    const palette = deps.getPalette();
    if (palette.length === 0 && isOpen()) close();
    trigger.disabled = palette.length === 0;
    if (!isOpen()) return;
    strip.replaceChildren();
    strip.style.setProperty(
      '--preview-columns',
      String(previewGridColumns(palette.length, layout.columns)),
    );
    for (const entry of palette) {
      const swatch = document.createElement('div');
      swatch.className = 'peiq-palette-preview__swatch';
      swatch.setAttribute('role', 'listitem');
      swatch.style.setProperty('--swatch', entry.hex);
      const caption = previewSwatchLabels(entry, layout);
      if (caption.length > 0) {
        const labels = document.createElement('span');
        labels.className = 'peiq-palette-preview__labels';
        labels.setAttribute('aria-hidden', 'true');
        for (const line of caption) {
          const span = document.createElement('span');
          span.className = 'peiq-palette-preview__label';
          span.textContent = line;
          labels.append(span);
        }
        swatch.append(labels);
      }
      const announced = previewSwatchLabels(entry, { hex: true, rgb: true });
      swatch.setAttribute('aria-label', announced.join(', '));
      strip.append(swatch);
    }
    strip.setAttribute(
      'aria-label',
      `${t('palette.previewTitle')} · ${countLabel('count.colors', palette.length)}`,
    );
    updateCaptionDensity();
  }

  /**
   * A caption chip needs about 96 px. Below that the block is the useful signal, so the
   * captions step aside instead of clipping; the swatch aria-label keeps both values.
   */
  function updateCaptionDensity() {
    const count = strip.children.length;
    if (count === 0) {
      delete strip.dataset.compact;
      return;
    }
    const columns =
      layout.mode === 'grid'
        ? previewGridColumns(count, layout.columns)
        : layout.mode === 'column'
          ? 1
          : count;
    const cell = strip.clientWidth / Math.max(1, columns);
    strip.dataset.compact = cell < 96 ? 'true' : 'false';
  }

  function refresh() {
    for (const [index, preset] of PREVIEW_BACKGROUND_PRESETS.entries()) {
      const button = presetButtons[index];
      const label = t(preset.labelKey);
      button.setAttribute('aria-label', label);
      button.setAttribute('title', label);
      button.setAttribute('aria-pressed', String(button.dataset.bg === colorInput.value));
    }
    if (autoOption) autoOption.textContent = t('palette.previewAuto');
    applyLayout();
    renderStrip();
  }

  for (const button of modeButtons) {
    button.addEventListener('click', () => {
      setLayout({ mode: button.dataset.mode ?? 'row' });
    });
  }
  columnsSelect.addEventListener('change', () => {
    setLayout({ columns: Number(columnsSelect.value) });
  });
  hexInput.addEventListener('change', () => setLayout({ hex: hexInput.checked }));
  rgbInput.addEventListener('change', () => setLayout({ rgb: rgbInput.checked }));

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
      [
        ...dialog.querySelectorAll(
          'button:not([disabled]), input:not([disabled]), select:not([disabled])',
        ),
      ]
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
  window.addEventListener('resize', () => {
    if (isOpen()) updateCaptionDensity();
  });

  setBackground(readStored(BACKGROUND_KEY), false);
  applyLayout();
  refresh();

  return { open, close, refresh, isOpen };
}
