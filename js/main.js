// @ts-check
import { formatHex, parseHex } from './core/color.js';
import { formatHexPalette, parseHexPalette } from './core/formats/hex.js';
import { formatGplPalette, parseGplPalette } from './core/formats/gpl.js';
import { formatPaletteJson, parsePaletteJson } from './core/formats/json.js';
import {
  addPaletteEntry,
  createPalette,
  movePaletteEntry,
  paletteHexList,
  removePaletteEntry,
  setPaletteLock,
  sortPalette,
  updatePaletteEntry,
} from './core/palette.js';
import { APP_VERSION } from './core/version.js';
import { BUILTIN_PALETTES } from './core/palettes/builtin.js';
import { parsePaletteFile } from './core/palettes/import.js';
import { copyText, debounce } from './ui/dom.js';
import { createCanvasView } from './ui/canvas-view.js';
import { initControls } from './ui/controls.js';
import { initDropzone } from './ui/dropzone.js';
import {
  clearDownloadLinks,
  getStripOrientation,
  setExportEnabled,
  showDownloadLinks,
} from './ui/export-view.js';
import { initLearn } from './ui/learn-view.js';
import { renderPalette } from './ui/palette-view.js';
import { initShortcuts } from './ui/shortcuts.js';
import { setStatus, setStatusMessage, toast } from './ui/status.js';
import { initTheme } from './ui/theme.js';
import { initTooltips } from './ui/tooltips.js';

const MAX_PIXELS = 16_777_216;
const PREVIEW_EDGE = 1024;

const versionLabel = document.getElementById('app-version');
if (versionLabel) versionLabel.textContent = `· v${APP_VERSION}`;

const hero = document.getElementById('hero');
const workspace = document.getElementById('workspace');
const frame = /** @type {HTMLElement} */ (document.getElementById('canvas-frame'));
const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('view-canvas'));
const divider = /** @type {HTMLElement} */ (document.getElementById('divider'));
const paletteStrip = document.getElementById('palette-strip');
const paletteCount = document.getElementById('palette-count');
const sortSelect = /** @type {HTMLSelectElement|null} */ (document.getElementById('palette-sort'));
const paletteEdit = /** @type {HTMLButtonElement|null} */ (document.getElementById('palette-edit'));
const paletteEditor = document.getElementById('palette-editor');
const paletteHex = /** @type {HTMLInputElement|null} */ (document.getElementById('palette-hex'));
const paletteApply = /** @type {HTMLButtonElement|null} */ (document.getElementById('palette-apply'));
const paletteAdd = /** @type {HTMLButtonElement|null} */ (document.getElementById('palette-add'));
const paletteMoveLeft = /** @type {HTMLButtonElement|null} */ (document.getElementById('palette-move-left'));
const paletteMoveRight = /** @type {HTMLButtonElement|null} */ (document.getElementById('palette-move-right'));
const paletteRemove = /** @type {HTMLButtonElement|null} */ (document.getElementById('palette-remove'));
const paletteLock = /** @type {HTMLButtonElement|null} */ (document.getElementById('palette-lock'));
const palettePick = /** @type {HTMLButtonElement|null} */ (document.getElementById('palette-pick'));
const paletteEditHint = document.getElementById('palette-edit-hint');
const pickPreview = document.getElementById('palette-pick-preview');
const pickPreviewSwatch = document.getElementById('palette-pick-swatch');
const pickPreviewHex = document.getElementById('palette-pick-hex');
const PALETTE_EDIT_HINT =
  'Select a swatch to edit it. Pick samples the canvas. ← / → move it in Manual order.';
const PALETTE_PICK_HINT = 'Click the image to pick a color. Esc cancels.';
const modeExtract = /** @type {HTMLButtonElement|null} */ (document.getElementById('mode-extract'));
const modeMap = /** @type {HTMLButtonElement|null} */ (document.getElementById('mode-map'));
const extractControls = document.getElementById('extract-controls');
const mapControls = document.getElementById('map-controls');
const paletteSelect = /** @type {HTMLSelectElement|null} */ (document.getElementById('palette-select'));
const paletteInput = /** @type {HTMLInputElement|null} */ (document.getElementById('palette-input'));
const importPalette = document.getElementById('import-palette');
const paletteStatus = document.getElementById('palette-status');
const transparentIndex = /** @type {HTMLSelectElement|null} */ (document.getElementById('transparent-index'));
const alphaThreshold = /** @type {HTMLInputElement|null} */ (document.getElementById('alpha-threshold'));
const alphaThresholdValue = document.getElementById('alpha-threshold-value');
const paletteFormat = /** @type {HTMLSelectElement|null} */ (document.getElementById('palette-format'));
const ditherMethod = /** @type {HTMLSelectElement|null} */ (document.getElementById('dither-method'));
const ditherStrength = /** @type {HTMLInputElement|null} */ (document.getElementById('dither-strength'));
const ditherStrengthValue = document.getElementById('dither-strength-value');
const ditherSerpentine = /** @type {HTMLInputElement|null} */ (document.getElementById('dither-serpentine'));
const edgeStop = /** @type {HTMLInputElement|null} */ (document.getElementById('edge-stop'));
const edgeStopValue = document.getElementById('edge-stop-value');
const canvasEmpty = document.getElementById('canvas-empty');
const toggleOriginal = /** @type {HTMLButtonElement} */ (document.getElementById('toggle-original'));
const header = document.getElementById('header');

const canvasView = createCanvasView({ canvas, frame, divider });
const theme = initTheme();
const learn = initLearn();

const app = {
  name: 'image',
  width: 0,
  height: 0,
  /** @type {ImageData|null} */
  full: null,
  /** @type {ImageData|null} */
  preview: null,
  /** @type {{ data: Uint8ClampedArray, width:number, height:number }|null} */
  reduced: null,
  /** @type {any[]} */
  palette: [],
  paletteEdited: false,
  hasResult: false,
  previewRequestId: 0,
  exportRequestId: 0,
  exportBusy: false,
};

let nextRequestId = 1;
let worker = createWorker();
let sortOrder = 'source';
/** @type {'extract'|'map'} */
let mode = 'extract';
let paletteEditMode = false;
/** @type {number|null} */
let selectedPaletteId = null;
let pickingColor = false;
/** @type {{ r:number,g:number,b:number,a:number }[]} */
let fixedColors = [];
let fixedName = '';
/** @type {{ r:number,g:number,b:number,a:number }[]} */
let importedColors = [];
let importedName = '';
let importedOption = false;

function createWorker() {
  const instance = new Worker(new URL('./workers/pipeline.worker.js', import.meta.url), {
    type: 'module',
  });
  instance.addEventListener('message', onWorkerMessage);
  instance.addEventListener('error', () => {
    toast('The processing worker failed. Reload the page.', 'error');
    setStatusMessage('Worker error');
    if (canvasEmpty) canvasEmpty.hidden = true;
    app.exportBusy = false;
    clearExportProgress();
    updateExportState();
  });
  return instance;
}

function onWorkerMessage(event) {
  const message = /** @type {any} */ (event.data);
  if (!message) return;

  if (message.type === 'progress') {
    if (message.requestId === app.previewRequestId) {
      setStatusMessage(message.stage === 'extract' ? 'Extracting palette…' : 'Processing…');
    }
    if (message.requestId === app.exportRequestId && app.exportBusy) {
      const labels = {
        strip: 'Building palette strip…',
        index: 'Encoding indexed PNG…',
        encode: 'Encoding reduced PNG…',
      };
      if (labels[message.stage]) setExportProgress(labels[message.stage]);
    }
    return;
  }

  if (message.type === 'result') {
    if (message.requestId !== app.previewRequestId) return;
    if (!app.paletteEdited) app.palette = message.palette;
    app.reduced = {
      data: new Uint8ClampedArray(message.preview.data),
      width: message.preview.width,
      height: message.preview.height,
    };
    app.hasResult = true;
    canvasView.setReduced(app.reduced);
    renderCurrentPalette();
    updateExportState();
    if (canvasEmpty) canvasEmpty.hidden = true;
    setStatus([
      { value: `${app.width}×${app.height}`, label: 'source' },
      { value: message.uniqueColors, label: 'unique' },
      { value: app.palette.length, label: 'colors' },
      { value: `${message.timings.extractMs} ms`, label: 'extract' },
      { value: `${message.timings.mapMs} ms`, label: 'map' },
    ]);
    if (app.palette.length === 0) {
      // An indexed PNG needs at least one PLTE entry, so a fully transparent image has
      // nothing to export. Say why instead of leaving the disabled buttons unexplained.
      toast('This image is fully transparent, so no palette can be built. Try another image or a fixed palette.', 'error');
      setStatus([
        { value: 'Warning', label: 'fully transparent image · no palette to export' },
        { value: `${app.width}×${app.height}`, label: 'source' },
      ]);
    }
    return;
  }

  if (message.type === 'exported') {
    if (message.requestId !== app.exportRequestId) return;
    const files = message.files ?? [];
    const ok = files.length > 0 && files.every((file) => file.validation?.ok);
    if (!ok) {
      const detail = files[0]?.validation?.detail ?? 'unknown validation error';
      toast(`Export failed validation: ${detail}`, 'error');
      setStatusMessage('Export failed validation');
      clearDownloadLinks();
      finishExport();
      return;
    }
    showDownloadLinks(files);
    const detail = files[0]?.validation?.detail ?? 'export complete';
    toast('Validated. Click Save to download.', 'success');
    setStatusMessage(`Validated: ${detail} — save link ready`);
    finishExport();
    return;
  }

  if (message.type === 'error') {
    if (message.requestId !== app.previewRequestId && message.requestId !== app.exportRequestId) {
      return;
    }
    toast(message.message || 'Processing failed', 'error');
    setStatusMessage('Error');
    if (canvasEmpty) canvasEmpty.hidden = true;
    if (message.requestId === app.exportRequestId) finishExport();
    else updateExportState();
  }
}

function updateExportState() {
  setExportEnabled(app.hasResult && app.palette.length > 0 && !app.exportBusy);
  updatePaletteEditor();
}

/** @param {string} label */
function setExportProgress(label) {
  const host = document.getElementById('export-progress');
  const labelNode = document.getElementById('export-progress-label');
  const panel = document.querySelector('.peiq-export-panel');
  if (labelNode) labelNode.textContent = label;
  if (host) host.hidden = false;
  if (panel) panel.setAttribute('aria-busy', 'true');
}

function clearExportProgress() {
  const host = document.getElementById('export-progress');
  const panel = document.querySelector('.peiq-export-panel');
  if (host) host.hidden = true;
  if (panel) panel.removeAttribute('aria-busy');
}

/**
 * @param {string} label
 * @returns {number} request id, or 0 when an export is already running
 */
function beginExport(label) {
  if (!app.hasResult || app.palette.length === 0 || app.exportBusy) return 0;
  const id = nextRequestId++;
  app.exportRequestId = id;
  app.exportBusy = true;
  setExportEnabled(false);
  stopPickMode();
  updatePaletteEditor();
  clearDownloadLinks();
  setExportProgress(label);
  return id;
}

function finishExport() {
  app.exportBusy = false;
  clearExportProgress();
  updateExportState();
}

function cancelExport() {
  if (!app.exportBusy) return;
  worker.postMessage({ type: 'cancel', requestId: app.exportRequestId });
  app.exportRequestId = 0;
  finishExport();
}

function renderCurrentPalette() {
  app.palette = sortPalette(app.palette, sortOrder);
  if (
    selectedPaletteId !== null &&
    !app.palette.some((entry) => entry.id === selectedPaletteId)
  ) {
    selectedPaletteId = null;
    if (paletteHex) paletteHex.value = '';
  }
  renderPalette(app.palette, paletteStrip, {
    editMode: paletteEditMode,
    selectedId: selectedPaletteId,
    onActivate: paletteEditMode ? selectPaletteEntry : null,
  });
  if (paletteCount) paletteCount.textContent = `${app.palette.length} colors`;
  if (sortSelect) sortSelect.disabled = app.palette.length === 0;
  updatePaletteEditor();

  const current = Number(transparentIndex?.value ?? -1);
  const preferred = mode === 'map' && current < 0 ? 0 : current;
  populateTransparentIndex(app.palette, preferred);
}

/** @param {{ id:number, hex:string }} entry */
function selectPaletteEntry(entry) {
  selectedPaletteId = entry.id;
  if (paletteHex) paletteHex.value = entry.hex;
  renderCurrentPalette();
}

/** @returns {any|null} */
function selectedPaletteEntry() {
  return app.palette.find((entry) => entry.id === selectedPaletteId) ?? null;
}

function updatePaletteEditor() {
  const selected = selectedPaletteEntry();
  const active = paletteEditMode && app.hasResult && app.palette.length > 0;
  if (paletteEdit) {
    paletteEdit.textContent = paletteEditMode ? 'Done' : 'Edit';
    paletteEdit.setAttribute('aria-pressed', String(paletteEditMode));
    paletteEdit.disabled = !app.hasResult || app.palette.length === 0 || app.exportBusy;
  }
  if (paletteEditor) paletteEditor.hidden = !active;
  if (paletteHex) paletteHex.disabled = app.exportBusy;
  if (palettePick) palettePick.disabled = !active || app.exportBusy;
  if (paletteApply) paletteApply.disabled = !selected || app.exportBusy;
  if (paletteAdd) paletteAdd.disabled = !active || app.exportBusy || app.palette.length >= 256;
  const position = selected ? app.palette.findIndex((entry) => entry.id === selected.id) : -1;
  const canMoveLeft =
    Boolean(selected) &&
    !selected.locked &&
    position > 0 &&
    !app.palette[position - 1].locked &&
    !app.exportBusy;
  const canMoveRight =
    Boolean(selected) &&
    !selected.locked &&
    position >= 0 &&
    position < app.palette.length - 1 &&
    !app.palette[position + 1].locked &&
    !app.exportBusy;
  if (paletteMoveLeft) paletteMoveLeft.disabled = !canMoveLeft;
  if (paletteMoveRight) paletteMoveRight.disabled = !canMoveRight;
  if (paletteRemove) {
    paletteRemove.disabled =
      !selected || selected.locked || app.palette.length <= 1 || app.exportBusy;
  }
  if (paletteLock) {
    paletteLock.disabled = !selected || app.exportBusy;
    paletteLock.setAttribute('aria-pressed', String(Boolean(selected?.locked)));
    paletteLock.textContent = selected?.locked ? 'Unlock' : 'Lock';
  }
}

/** @param {boolean} active */
function setPaletteEditMode(active) {
  paletteEditMode = active;
  if (!active) {
    stopPickMode();
    selectedPaletteId = null;
    if (paletteHex) paletteHex.value = '';
  }
  renderCurrentPalette();
}

function startPickMode() {
  if (!paletteEditMode || !app.hasResult || app.exportBusy) return;
  pickingColor = true;
  palettePick?.setAttribute('aria-pressed', 'true');
  frame.classList.add('is-picking');
  if (paletteEditHint) paletteEditHint.textContent = PALETTE_PICK_HINT;
  hidePickPreview();
  updatePaletteEditor();
}

function stopPickMode() {
  if (!pickingColor) return;
  pickingColor = false;
  palettePick?.setAttribute('aria-pressed', 'false');
  frame.classList.remove('is-picking');
  hidePickPreview();
  if (paletteEditHint) paletteEditHint.textContent = PALETTE_EDIT_HINT;
  updatePaletteEditor();
}

function hidePickPreview() {
  if (pickPreview) pickPreview.hidden = true;
}

/** @param {PointerEvent} event */
function updatePickPreview(event) {
  if (!pickingColor) return;
  const color = canvasView.pickColor(event.clientX, event.clientY);
  if (!color || color.a === 0) {
    hidePickPreview();
    return;
  }
  const hex = formatHex(color);
  if (pickPreviewSwatch) pickPreviewSwatch.style.setProperty('--pick-color', hex);
  if (pickPreviewHex) pickPreviewHex.textContent = hex;
  if (!pickPreview) return;

  pickPreview.hidden = false;
  const gap = 14;
  const rect = pickPreview.getBoundingClientRect();
  let left = event.clientX + gap;
  let top = event.clientY + gap;
  if (left + rect.width > window.innerWidth - 8) {
    left = event.clientX - rect.width - gap;
  }
  if (top + rect.height > window.innerHeight - 8) {
    top = event.clientY - rect.height - gap;
  }
  pickPreview.style.left = `${Math.max(8, Math.round(left))}px`;
  pickPreview.style.top = `${Math.max(8, Math.round(top))}px`;
}

/** @param {PointerEvent} event */
function handleCanvasPick(event) {
  if (!pickingColor) return;
  if (event.pointerType === 'mouse' && event.button !== 0) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  const color = canvasView.pickColor(event.clientX, event.clientY);
  if (!color) {
    toast('Click a visible part of the image', 'error');
    return;
  }
  if (color.a === 0) {
    toast('That pixel is transparent', 'error');
    return;
  }
  hidePickPreview();
  stopPickMode();
  if (paletteHex) paletteHex.value = formatHex(color);
  if (selectedPaletteEntry()) {
    applyPaletteHex();
  } else {
    toast(`Picked ${formatHex(color)}. Press Add to append it.`, 'success');
  }
}

function markPaletteEdited() {
  app.paletteEdited = true;
  if (mode === 'map') {
    fixedColors = app.palette.map((entry) => ({ ...entry.color }));
  }
}

function resetPaletteEdits() {
  stopPickMode();
  app.paletteEdited = false;
  paletteEditMode = false;
  selectedPaletteId = null;
  if (paletteHex) paletteHex.value = '';
  updatePaletteEditor();
}

/** @returns {string} */
function paletteHexValue() {
  return paletteHex?.value.trim() ?? '';
}

function applyPaletteHex() {
  const selected = selectedPaletteEntry();
  if (!selected) return;
  const value = paletteHexValue();
  if (!value) {
    toast('Enter a HEX color first', 'error');
    return;
  }
  try {
    app.palette = updatePaletteEntry(app.palette, selected.id, value);
    const updated = app.palette.find((entry) => entry.id === selected.id);
    if (paletteHex && updated) paletteHex.value = updated.hex;
    markPaletteEdited();
    renderCurrentPalette();
    processPreview();
    toast('Palette color updated', 'success');
  } catch (error) {
    toast(error instanceof Error ? error.message : String(error), 'error');
  }
}

function addPaletteColor() {
  const value = paletteHexValue();
  if (!value) {
    toast('Enter a HEX color first', 'error');
    return;
  }
  try {
    const next = addPaletteEntry(app.palette, value);
    const entry = next[next.length - 1];
    app.palette = next;
    selectedPaletteId = entry.id;
    if (paletteHex) paletteHex.value = entry.hex;
    markPaletteEdited();
    renderCurrentPalette();
    processPreview();
    toast(`Added ${entry.hex}`, 'success');
  } catch (error) {
    toast(error instanceof Error ? error.message : String(error), 'error');
  }
}

function removePaletteColor() {
  const selected = selectedPaletteEntry();
  if (!selected) return;
  try {
    app.palette = removePaletteEntry(app.palette, selected.id);
    selectedPaletteId = null;
    if (paletteHex) paletteHex.value = '';
    markPaletteEdited();
    renderCurrentPalette();
    processPreview();
    toast(`Removed ${selected.hex}`, 'success');
  } catch (error) {
    toast(error instanceof Error ? error.message : String(error), 'error');
  }
}

function togglePaletteLock() {
  const selected = selectedPaletteEntry();
  if (!selected) return;
  try {
    app.palette = setPaletteLock(app.palette, selected.id, !selected.locked);
    renderCurrentPalette();
    toast(selected.locked ? `Unlocked ${selected.hex}` : `Locked ${selected.hex}`, 'success');
  } catch (error) {
    toast(error instanceof Error ? error.message : String(error), 'error');
  }
}

/** @param {'left'|'right'} direction */
function moveSelectedPaletteEntry(direction) {
  const selected = selectedPaletteEntry();
  if (!selected) return;
  const transparentPosition = Number(transparentIndex?.value ?? -1);
  const transparentId =
    transparentPosition >= 0 ? app.palette[transparentPosition]?.id ?? null : null;
  try {
    const moved = movePaletteEntry(app.palette, selected.id, direction);
    sortOrder = 'manual';
    if (sortSelect) sortSelect.value = 'manual';
    app.palette = moved;
    markPaletteEdited();
    renderCurrentPalette();
    if (transparentId !== null && transparentIndex) {
      const nextPosition = app.palette.findIndex((entry) => entry.id === transparentId);
      if (nextPosition >= 0) transparentIndex.value = String(nextPosition);
    }
    clearDownloadLinks();
    updatePaletteEditor();
  } catch (error) {
    toast(error instanceof Error ? error.message : String(error), 'error');
  }
}

/**
 * @param {{ hex:string }[]} palette
 * @param {number} preferred
 */
function populateTransparentIndex(palette, preferred) {
  if (!transparentIndex) return;
  transparentIndex.replaceChildren();
  const none = document.createElement('option');
  none.value = '-1';
  none.textContent = 'None';
  transparentIndex.append(none);
  palette.forEach((entry, index) => {
    const option = document.createElement('option');
    option.value = String(index);
    option.textContent = `${index} · ${entry.hex}`;
    transparentIndex.append(option);
  });
  transparentIndex.disabled = palette.length === 0;
  const valid = preferred >= 0 && preferred < palette.length;
  transparentIndex.value = valid ? String(preferred) : '-1';
}

function getParams() {
  const base = controls.getParams();
  return {
    mode,
    ...base,
    palette: mode === 'map' ? fixedColors : undefined,
    dither: {
      method: ditherMethod?.value || 'none',
      strength: Number(ditherStrength?.value ?? 80) / 100,
      serpentine: ditherSerpentine?.checked ?? true,
      edgeStop: Number(edgeStop?.value ?? 50) / 100,
    },
    alphaThreshold: Number(alphaThreshold?.value ?? 128),
    transparentIndex: Number(transparentIndex?.value ?? -1),
  };
}

function getProcessParams() {
  return {
    ...getParams(),
    ...(app.paletteEdited
      ? { paletteOverride: app.palette.map((entry) => ({ ...entry.color })) }
      : {}),
  };
}

/**
 * @param {'extract'|'map'} next
 */
function setMode(next) {
  if (next !== 'extract' && next !== 'map') return;
  resetPaletteEdits();
  mode = next;
  modeExtract?.setAttribute('aria-selected', String(next === 'extract'));
  modeMap?.setAttribute('aria-selected', String(next === 'map'));
  if (extractControls) extractControls.hidden = next !== 'extract';
  if (mapControls) mapControls.hidden = next !== 'map';

  if (next === 'map') {
    if (fixedColors.length === 0) {
      loadTargetPalette(paletteSelect?.value || 'pico-8');
    } else {
      app.palette = sortPalette(createPalette(fixedColors), sortOrder);
    }
  } else {
    app.palette = [];
  }
  renderCurrentPalette();
  if (app.preview) processPreview();
}

/**
 * @param {string} value
 * @returns {boolean}
 */
function loadTargetPalette(value) {
  resetPaletteEdits();
  /** @type {{ r:number,g:number,b:number,a:number }[]} */
  let colors = [];
  let name = '';

  if (value === 'imported') {
    colors = importedColors;
    name = importedName;
  } else {
    const builtin =
      BUILTIN_PALETTES.find((palette) => palette.id === value) ?? BUILTIN_PALETTES[0];
    if (builtin) {
      colors = builtin.colors.map(parseHex);
      name = builtin.name;
    }
  }

  if (colors.length === 0) return false;
  fixedColors = colors;
  fixedName = name;
  if (paletteStatus) paletteStatus.textContent = `${name} · ${colors.length} colors`;
  if (paletteSelect) paletteSelect.value = value;
  app.palette = sortPalette(createPalette(colors), sortOrder);
  renderCurrentPalette();
  return true;
}

function populateBuiltinPalettes() {
  if (!paletteSelect) return;
  paletteSelect.replaceChildren();
  for (const palette of BUILTIN_PALETTES) {
    const option = document.createElement('option');
    option.value = palette.id;
    option.textContent = `${palette.name} · ${palette.colors.length}`;
    paletteSelect.append(option);
  }
  const first = BUILTIN_PALETTES[0];
  if (first) {
    fixedColors = first.colors.map(parseHex);
    fixedName = first.name;
    paletteSelect.value = first.id;
    if (paletteStatus) paletteStatus.textContent = `${first.name} · ${first.colors.length} colors`;
  }
}

function processPreview() {
  if (!app.preview) return;
  if (mode === 'map' && fixedColors.length === 0) {
    if (!loadTargetPalette(paletteSelect?.value || 'pico-8')) return;
  }
  cancelExport();
  clearDownloadLinks();
  if (app.previewRequestId) {
    worker.postMessage({ type: 'cancel', requestId: app.previewRequestId });
  }

  const id = nextRequestId++;
  app.previewRequestId = id;
  const copy = new Uint8ClampedArray(app.preview.data);
  worker.postMessage(
    {
      type: 'process',
      requestId: id,
      image: {
        data: copy.buffer,
        width: app.preview.width,
        height: app.preview.height,
      },
      params: getProcessParams(),
    },
    [copy.buffer],
  );

  setExportEnabled(false);
  if (canvasEmpty && !app.hasResult) canvasEmpty.hidden = false;
  setStatusMessage('Processing preview…');
}

async function loadFile(file) {
  try {
    cancelExport();
    setStatusMessage('Decoding image…');
    const bitmap = await decodeBitmap(file);
    const width = bitmap.width;
    const height = bitmap.height;

    if (width < 1 || height < 1) {
      bitmap.close?.();
      throw new Error('The image has invalid dimensions.');
    }
    if (width * height > MAX_PIXELS) {
      bitmap.close?.();
      throw new Error(
        `This image is ${width}×${height} (${(width * height / 1_000_000).toFixed(1)} MP). ` +
          `The limit is 16.7 MP. Resize it first.`,
      );
    }

    const full = drawToImageData(bitmap, width, height, false);
    const scale = Math.min(1, PREVIEW_EDGE / Math.max(width, height));
    const previewWidth = Math.max(1, Math.round(width * scale));
    const previewHeight = Math.max(1, Math.round(height * scale));
    const preview = drawToImageData(bitmap, previewWidth, previewHeight, true);
    bitmap.close?.();

    app.name = file.name || 'image';
    app.width = width;
    app.height = height;
    app.full = full;
    app.preview = preview;
    app.reduced = null;
    app.palette = [];
    app.hasResult = false;
    resetPaletteEdits();
    clearDownloadLinks();

    if (hero) hero.hidden = true;
    if (workspace) workspace.hidden = false;
    canvasView.setOriginal(preview);
    renderCurrentPalette();
    setExportEnabled(false);
    if (canvasEmpty) {
      canvasEmpty.hidden = false;
      canvasEmpty.textContent = 'Processing…';
    }
    setStatus([
      { value: `${width}×${height}`, label: 'source' },
      { value: file.name || 'image', label: 'file' },
    ]);
    processPreview();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    toast(message, 'error');
    setStatusMessage('Could not read image');
  }
}

/**
 * @param {File} file
 * @returns {Promise<ImageBitmap>}
 */
async function decodeBitmap(file) {
  if (typeof createImageBitmap !== 'function') {
    throw new Error('This browser cannot decode images (createImageBitmap is missing).');
  }
  try {
    return await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    return await createImageBitmap(file);
  }
}

/**
 * @param {ImageBitmap} bitmap
 * @param {number} width
 * @param {number} height
 * @param {boolean} smooth
 * @returns {ImageData}
 */
function drawToImageData(bitmap, width, height, smooth) {
  const buffer = document.createElement('canvas');
  buffer.width = width;
  buffer.height = height;
  const ctx = buffer.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D is unavailable');
  ctx.imageSmoothingEnabled = smooth;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, 0, 0, width, height);
  return ctx.getImageData(0, 0, width, height);
}

function exportStrip() {
  const id = beginExport('Building palette strip…');
  if (!id) return;
  setStatusMessage('Building and validating the palette strip…');
  worker.postMessage({
    type: 'export-strip',
    requestId: id,
    palette: app.palette,
    name: app.name,
    orientation: getStripOrientation(),
    transparentIndex: Number(transparentIndex?.value ?? -1),
  });
}

function exportReduced() {
  if (!app.full) return;
  const id = beginExport('Encoding reduced PNG…');
  if (!id) return;
  setStatusMessage('Encoding the full-resolution PNG…');
  const copy = new Uint8ClampedArray(app.full.data);
  worker.postMessage(
    {
      type: 'export-reduced',
      requestId: id,
      image: { data: copy.buffer, width: app.width, height: app.height },
      params: getProcessParams(),
      name: app.name,
    },
    [copy.buffer],
  );
}

function exportIndexed() {
  if (!app.full) return;
  const id = beginExport('Encoding indexed PNG…');
  if (!id) return;
  setStatusMessage('Encoding and validating the indexed PNG…');
  const copy = new Uint8ClampedArray(app.full.data);
  worker.postMessage(
    {
      type: 'export-indexed',
      requestId: id,
      image: { data: copy.buffer, width: app.width, height: app.height },
      palette: app.palette,
      params: getParams(),
      name: app.name,
    },
    [copy.buffer],
  );
}

function copyHex() {
  if (!app.hasResult || app.palette.length === 0 || app.exportBusy) return;
  copyText(paletteHexList(app.palette))
    .then(() => toast(`Copied ${app.palette.length} HEX values`, 'success'))
    .catch(() => toast('Clipboard is unavailable', 'error'));
}

async function exportPaletteFile() {
  const id = beginExport('Preparing palette file…');
  if (!id) return;
  const format = paletteFormat?.value === 'gpl'
    ? 'gpl'
    : paletteFormat?.value === 'json'
      ? 'json'
      : 'hex';
  const base = baseName(app.name);
  const colors = app.palette.map((entry) => entry.color);
  const expected = app.palette.map((entry) => entry.color);
  let text;
  let parsed;

  try {
    if (format === 'gpl') {
      text = formatGplPalette(
        colors,
        base,
        app.palette.map((entry) => entry.name),
      );
      parsed = parseGplPalette(text).colors;
    } else if (format === 'json') {
      text = await formatPaletteJson(app.palette, {
        name: base,
        order: sortOrder,
        space: controls.getParams().space,
      });
      parsed = parsePaletteJson(text).colors;
    } else {
      text = formatHexPalette(colors);
      parsed = parseHexPalette(text).colors;
    }
  } catch (error) {
    finishExport();
    const message = error instanceof Error ? error.message : String(error);
    toast(`Could not build palette file: ${message}`, 'error');
    return;
  }

  const compareAlpha = format !== 'gpl';
  const validation = validatePaletteColors(parsed, expected, compareAlpha, format);
  if (!validation.ok) {
    finishExport();
    toast(`Palette validation failed: ${validation.detail}`, 'error');
    setStatusMessage('Palette validation failed');
    return;
  }

  const bytes = new TextEncoder().encode(text);
  clearDownloadLinks();
  showDownloadLinks([
    {
      name: `${base}-palette.${format}`,
      mime: format === 'json' ? 'application/json' : 'text/plain',
      data: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
      validation,
    },
  ]);
  toast('Palette file ready. Click Save.', 'success');
  setStatusMessage(`Validated: ${validation.detail} — save link ready`);
  finishExport();
}

/**
 * @param {{ r:number,g:number,b:number,a:number }[]} parsed
 * @param {{ r:number,g:number,b:number,a:number }[]} expected
 * @param {boolean} compareAlpha
 * @param {'hex'|'gpl'|'json'} format
 * @returns {{ ok:boolean, detail:string }}
 */
function validatePaletteColors(parsed, expected, compareAlpha, format) {
  if (parsed.length !== expected.length) {
    return { ok: false, detail: `read ${parsed.length} colors, expected ${expected.length}` };
  }
  for (let i = 0; i < expected.length; i++) {
    const actual = parsed[i];
    const wanted = expected[i];
    if (
      actual.r !== wanted.r ||
      actual.g !== wanted.g ||
      actual.b !== wanted.b ||
      (compareAlpha && actual.a !== wanted.a)
    ) {
      return { ok: false, detail: `color ${i + 1} does not round-trip` };
    }
  }
  const alphaNote = compareAlpha ? '' : '; alpha not stored by GPL';
  return {
    ok: true,
    detail: `${expected.length} colors · .${format} · RGB exact${alphaNote}`,
  };
}

/** @param {string} name */
function baseName(name) {
  const base = String(name ?? '')
    .toLowerCase()
    .replace(/\.[a-z0-9]+$/i, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return base || 'image';
}

function toggleOriginalState() {
  const next = toggleOriginal.getAttribute('aria-pressed') !== 'true';
  toggleOriginal.setAttribute('aria-pressed', String(next));
  const longLabel = document.getElementById('toggle-original-label');
  const shortLabel = document.getElementById('toggle-original-short');
  if (longLabel) longLabel.textContent = next ? 'Reduced' : 'Original';
  if (shortLabel) shortLabel.textContent = next ? 'Reduced' : 'Original';
  canvasView.setShowOriginal(next);
}

const controls = initControls({
  onChange: () => {
    if (mode === 'extract') resetPaletteEdits();
    processPreview();
  },
});
initTooltips();

initDropzone({
  onFile: loadFile,
  onError: (message) => toast(message, 'error'),
});

initShortcuts({
  onFit: () => canvasView.fit(),
  onZoom100: () => canvasView.zoom100(),
  onToggleOriginal: toggleOriginalState,
  onToggleHelp: () => learn.toggle(),
  onCycleTheme: () => theme.cycle(),
});

document.getElementById('zoom-out')?.addEventListener('click', () => canvasView.zoomOut());
document.getElementById('fit-view')?.addEventListener('click', () => canvasView.fit());
document.getElementById('zoom-100')?.addEventListener('click', () => canvasView.zoom100());
document.getElementById('zoom-in')?.addEventListener('click', () => canvasView.zoomIn());
sortSelect?.addEventListener('change', () => {
  sortOrder = sortSelect.value || 'source';
  renderCurrentPalette();
  clearDownloadLinks();
});

paletteEdit?.addEventListener('click', () => setPaletteEditMode(!paletteEditMode));
paletteApply?.addEventListener('click', applyPaletteHex);
paletteAdd?.addEventListener('click', addPaletteColor);
paletteMoveLeft?.addEventListener('click', () => moveSelectedPaletteEntry('left'));
paletteMoveRight?.addEventListener('click', () => moveSelectedPaletteEntry('right'));
paletteRemove?.addEventListener('click', removePaletteColor);
paletteLock?.addEventListener('click', togglePaletteLock);
palettePick?.addEventListener('click', () => {
  if (pickingColor) stopPickMode();
  else startPickMode();
});
canvas.addEventListener('pointerdown', handleCanvasPick, { capture: true });
frame.addEventListener('pointermove', updatePickPreview);
frame.addEventListener('pointerleave', hidePickPreview);
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && pickingColor) {
    event.preventDefault();
    stopPickMode();
  }
});
paletteHex?.addEventListener('keydown', (event) => {
  if (event.key !== 'Enter') return;
  event.preventDefault();
  if (selectedPaletteEntry()) applyPaletteHex();
  else addPaletteColor();
});

const scheduleProcess = debounce(processPreview, 150);

populateBuiltinPalettes();
updateDitherLabels();
updateDitherControls();
updatePaletteEditor();

modeExtract?.addEventListener('click', () => setMode('extract'));
modeMap?.addEventListener('click', () => setMode('map'));

paletteSelect?.addEventListener('change', () => {
  if (!loadTargetPalette(paletteSelect.value)) return;
  if (mode === 'map' && app.preview) processPreview();
});

importPalette?.addEventListener('click', () => paletteInput?.click());
paletteInput?.addEventListener('change', async () => {
  const file = paletteInput.files?.[0] ?? null;
  paletteInput.value = '';
  if (!file) return;

  try {
    const isPng = file.name.toLowerCase().endsWith('.png');
    const bytes = isPng ? new Uint8Array(await file.arrayBuffer()) : undefined;
    const text = isPng ? undefined : await file.text();
    const parsed = await parsePaletteFile({ name: file.name, text, bytes });
    importedColors = parsed.colors;
    importedName = parsed.name || file.name;

    if (paletteSelect) {
      let option = /** @type {HTMLOptionElement|null} */ (
        paletteSelect.querySelector('option[value="imported"]')
      );
      if (!option) {
        option = document.createElement('option');
        option.value = 'imported';
        paletteSelect.append(option);
      }
      option.textContent = `Imported: ${importedName} · ${importedColors.length}`;
      paletteSelect.value = 'imported';
    }

    loadTargetPalette('imported');
    setMode('map');
    toast(`Loaded ${importedName} · ${importedColors.length} colors`, 'success');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    toast(message, 'error');
  }
});

ditherMethod?.addEventListener('change', () => {
  updateDitherControls();
  scheduleProcess();
});
ditherStrength?.addEventListener('input', () => {
  updateDitherLabels();
  scheduleProcess();
});
ditherSerpentine?.addEventListener('change', scheduleProcess);
edgeStop?.addEventListener('input', () => {
  updateDitherLabels();
  scheduleProcess();
});
alphaThreshold?.addEventListener('input', () => {
  updateDitherLabels();
  scheduleProcess();
});
transparentIndex?.addEventListener('change', scheduleProcess);

function updateDitherLabels() {
  if (ditherStrengthValue && ditherStrength) {
    ditherStrengthValue.textContent = `${ditherStrength.value}%`;
  }
  if (edgeStopValue && edgeStop) {
    edgeStopValue.textContent = `${edgeStop.value}%`;
  }
  if (alphaThresholdValue && alphaThreshold) {
    alphaThresholdValue.textContent = alphaThreshold.value;
  }
}

function updateDitherControls() {
  const method = ditherMethod?.value || 'none';
  const isErrorDiffusion =
    method === 'floyd-steinberg' ||
    method === 'atkinson' ||
    method === 'stucki' ||
    method === 'jarvis' ||
    method === 'burkes' ||
    method === 'sierra';
  const isNone = method === 'none';
  if (ditherStrength) ditherStrength.disabled = isNone;
  if (ditherSerpentine) ditherSerpentine.disabled = !isErrorDiffusion;
  if (edgeStop) edgeStop.disabled = !isErrorDiffusion;
}

toggleOriginal.addEventListener('click', toggleOriginalState);
document.getElementById('export-strip')?.addEventListener('click', exportStrip);
document.getElementById('export-reduced')?.addEventListener('click', exportReduced);
document.getElementById('export-indexed')?.addEventListener('click', exportIndexed);
document.getElementById('export-palette')?.addEventListener('click', exportPaletteFile);
document.getElementById('copy-hex')?.addEventListener('click', copyHex);

window.addEventListener(
  'scroll',
  () => {
    header?.classList.toggle('peiq-header--scrolled', window.scrollY > 0);
  },
  { passive: true },
);

window.addEventListener('beforeunload', () => {
  worker.terminate();
});
