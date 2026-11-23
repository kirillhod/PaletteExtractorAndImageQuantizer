// @ts-check
import {
  DEFAULT_PREVIEW_LAYOUT,
  PREVIEW_COLUMN_CHOICES,
  PREVIEW_MAX_COLUMNS,
  normalizePreviewLayout,
  previewGridColumns,
  previewSwatchLabelRows,
  previewSwatchLabels,
} from '../core/preview-layout.js';
import {
  PREVIEW_BACKGROUND_PRESETS,
  normalizePreviewBackground,
} from '../core/preview-bg.js';
import { countLabel, t } from './i18n.js';
import { copyText } from './dom.js';
import { toastKey } from './status.js';
import { createColorPicker } from './color-picker.js';

const BACKGROUND_KEY = 'peiq.previewBg';
const LAYOUT_KEY = 'peiq.previewLayout';
const OPEN_CLASS = 'peiq-preview-open';

/**
 * @typedef {Object} PalettePreviewDeps
 * @property {() => { hex:string, color?:{ r:number, g:number, b:number } }[]} getPalette
 * @property {() => void} [onOpen] Called before the dialog takes focus, so a page panel
 *   that would sit behind the full-screen overlay can close first.
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
  const backgroundButton = /** @type {HTMLButtonElement|null} */ (
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
  const labelColorButton = /** @type {HTMLButtonElement|null} */ (
    document.getElementById('palette-preview-label-color')
  );
  const settingsButton = /** @type {HTMLButtonElement|null} */ (
    document.getElementById('palette-preview-settings')
  );

  if (
    !trigger ||
    !dialog ||
    !stage ||
    !strip ||
    !closeButton ||
    !presetsHost ||
    !backgroundButton ||
    !columnsSelect ||
    !hexInput ||
    !rgbInput ||
    !labelColorButton ||
    !settingsButton
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

  /** @type {string} */
  let background = normalizePreviewBackground(readStored(BACKGROUND_KEY));

  /** @param {string} value @param {boolean} [persist] */
  function setBackground(value, persist = true) {
    background = normalizePreviewBackground(value);
    dialog.style.setProperty('--peiq-preview-bg', background);
    backgroundPicker.setValue(background);
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
    dialog.style.setProperty('--peiq-preview-label', layout.labelColor);
    for (const button of modeButtons) {
      button.setAttribute('aria-pressed', String(button.dataset.mode === layout.mode));
    }
    columnsSelect.value = String(layout.columns);
    columnsSelect.disabled = layout.mode !== 'grid';
    hexInput.checked = layout.hex;
    rgbInput.checked = layout.rgb;
    captionPicker.setValue(layout.labelColor);
    labelColorButton.disabled = !layout.hex && !layout.rgb;
    if (labelColorButton.disabled) captionPicker.close();
  }

  /**
   * Caption color changes do not touch the strip contents, so they only repaint and
   * persist instead of rebuilding up to 256 swatches per pointer move.
   *
   * @param {string} value
   * @param {boolean} [persist]
   */
  function setCaptionColor(value, persist = true) {
    layout = normalizePreviewLayout({ ...layout, labelColor: value });
    dialog.style.setProperty('--peiq-preview-label', layout.labelColor);
    captionPicker.setValue(layout.labelColor);
    if (!persist) return;
    writeStored(LAYOUT_KEY, JSON.stringify(layout));
  }

  const backgroundPicker = createColorPicker({
    trigger: backgroundButton,
    onChange: (hex, persist) => setBackground(hex, persist),
  });
  const captionPicker = createColorPicker({
    trigger: labelColorButton,
    onChange: (hex, persist) => setCaptionColor(hex, persist),
  });

  function renderStrip() {
    const palette = deps.getPalette();
    if (palette.length === 0 && isOpen()) close();
    trigger.disabled = palette.length === 0;
    if (!isOpen()) return;
    strip.replaceChildren();
    const count = palette.length;
    const provisional = provisionalColumns(count);
    applyColumns(provisional);
    for (const entry of palette) {
      const swatch = document.createElement('div');
      swatch.className = 'peiq-palette-preview__swatch';
      swatch.setAttribute('role', 'listitem');
      swatch.style.setProperty('--swatch', entry.hex);
      const caption = previewSwatchLabelRows(entry, layout);
      if (caption.length > 0) {
        const labels = document.createElement('span');
        labels.className = 'peiq-palette-preview__labels';
        for (const row of caption) {
          const label = document.createElement('button');
          label.type = 'button';
          label.className = 'peiq-palette-preview__label';
          label.dataset.copyKind = row.kind;
          label.dataset.copyValue = row.text;
          const copyLabel =
            row.kind === 'hex'
              ? t('palette.swatchCopy', { hex: row.text })
              : t('palette.previewCopyRgb', { rgb: row.text });
          label.setAttribute('aria-label', copyLabel);
          label.title = copyLabel;
          if (row.kind === 'rgb') {
            label.classList.add('peiq-palette-preview__label--rgb');
            for (const [index, part] of row.parts.entries()) {
              if (index > 0) label.append(' ');
              const channel = document.createElement('span');
              channel.className = 'peiq-palette-preview__channel';
              channel.textContent = part;
              label.append(channel);
            }
          } else {
            label.textContent = row.text;
          }
          labels.append(label);
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
    applyColumns(count === 0 ? 1 : finalColumns(count));
  }

  /**
   * Columns applied before the cells exist. Auto starts from the square-ish count and
   * may still be narrowed once the real heights are measurable.
   *
   * @param {number} count
   */
  function provisionalColumns(count) {
    if (layout.mode === 'grid') return previewGridColumns(count, layout.columns);
    return layout.mode === 'column' ? 1 : Math.max(1, count);
  }

  /**
   * Auto is a fit-to-view choice: it picks the widest color that still shows the whole
   * palette without scrolling. When captions are on, Auto also keeps every cell wide
   * enough for them; a palette too large for that scrolls rather than hiding captions.
   *
   * @param {number} count
   */
  function finalColumns(count) {
    if (layout.mode === 'grid') {
      return layout.columns > 0 ? previewGridColumns(count, layout.columns) : fitColumns(count);
    }
    return layout.mode === 'column' ? 1 : Math.max(1, count);
  }

  /**
   * Auto keeps the square-ish grid when it fits and only adds columns until the whole
   * palette is visible, so small palettes do not collapse into a narrow tower. Fitting
   * is monotone enough for a search: more columns means smaller cells and no more rows.
   *
   * @param {number} count
   */
  function fitColumns(count) {
    const labelsOn = layout.hex || layout.rgb;
    const captionLimit = labelsOn ? Math.floor(stage.clientWidth / 56) : PREVIEW_MAX_COLUMNS;
    const limit = Math.max(
      1,
      Math.min(PREVIEW_MAX_COLUMNS, count, captionLimit > 0 ? captionLimit : 1),
    );
    const fits = (columns) => {
      applyColumns(columns);
      return stage.scrollHeight <= stage.clientHeight + 1;
    };
    const start = Math.max(1, Math.min(limit, previewGridColumns(count, 0)));
    if (fits(start)) return start;
    if (!fits(limit)) return limit;
    let low = start + 1;
    let high = limit;
    let best = limit;
    while (low <= high) {
      const middle = (low + high) >> 1;
      if (fits(middle)) {
        best = middle;
        high = middle - 1;
      } else {
        low = middle + 1;
      }
    }
    return best;
  }

  /**
   * Set the column count and hide captions where a cell cannot hold a hex value.
   * A caption needs about 56 px for "#rrggbb"; the RGB triple can wrap to a second line.
   *
   * @param {number} columns
   */
  function applyColumns(columns) {
    strip.style.setProperty('--preview-columns', String(columns));
    if (strip.children.length === 0) {
      delete strip.dataset.compact;
      return;
    }
    const cell = strip.clientWidth / Math.max(1, columns);
    strip.dataset.compact = cell < 56 ? 'true' : 'false';
  }

  function refresh() {
    for (const [index, preset] of PREVIEW_BACKGROUND_PRESETS.entries()) {
      const button = presetButtons[index];
      const label = t(preset.labelKey);
      button.setAttribute('aria-label', label);
      button.setAttribute('title', label);
      button.setAttribute('aria-pressed', String(button.dataset.bg === background));
    }
    if (autoOption) autoOption.textContent = t('palette.previewAuto');
    backgroundPicker.refresh();
    captionPicker.refresh();
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
  strip.addEventListener('click', (event) => {
    const target = /** @type {HTMLElement|null} */ (event.target);
    const label = target?.closest?.('.peiq-palette-preview__label');
    if (!(label instanceof HTMLElement)) return;
    const value = label.dataset.copyValue ?? '';
    if (!value) return;
    const hex = label.dataset.copyKind === 'hex';
    const params = hex ? { hex: value } : { rgb: value };
    copyText(value)
      .then(() => toastKey(hex ? 'toast.copiedHex' : 'toast.copiedRgb', params, 'success'))
      .catch(() => toastKey('toast.clipboardUnavailable', {}, 'error'));
  });
  settingsButton.addEventListener('click', () => {
    setSettings(dialog.dataset.settings !== 'open');
  });

  /**
   * Below 600 px the chips live behind one button so the palette keeps the screen; on
   * desktop the tray is a pass-through and the attribute only parks the state.
   *
   * @param {boolean} expanded
   */
  function setSettings(expanded) {
    dialog.dataset.settings = expanded ? 'open' : 'closed';
    settingsButton.setAttribute('aria-expanded', String(expanded));
    if (expanded) return;
    backgroundPicker.close();
    captionPicker.close();
  }

  function open() {
    if (deps.getPalette().length === 0) return;
    lastFocus = /** @type {HTMLElement|null} */ (document.activeElement);
    dialog.hidden = false;
    trigger.setAttribute('aria-expanded', 'true');
    document.documentElement.classList.add(OPEN_CLASS);
    setSettings(false);
    deps.onOpen?.();
    refresh();
    closeButton.focus();
  }

  function close() {
    if (!isOpen()) return;
    backgroundPicker.close();
    captionPicker.close();
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
      ].filter((element) => element.getClientRects().length > 0)
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
  window.addEventListener('peiqq:localechange', refresh);
  window.addEventListener('resize', () => {
    if (!isOpen()) return;
    const count = strip.children.length;
    if (count > 0) applyColumns(finalColumns(count));
  });

  setBackground(background, false);
  applyLayout();
  refresh();

  return { open, close, refresh, isOpen };
}
