// @ts-check
import { formatHex, parseHex } from './core/color.js';
import { decodeUrlState, encodeUrlState } from './core/url-state.js';
import {
  SESSION_VERSION,
  cloneHistory,
  clonePalette,
  isValidSessionRecord,
} from './core/session-state.js';
import {
  addPaletteEntry,
  createPalette,
  movePaletteEntry,
  removePaletteEntry,
  setPaletteLock,
  sortPalette,
  updatePaletteEntry,
} from './core/palette.js';
import {
  pickedMarkersFromArray,
  pickedMarkersToArray,
} from './core/picked-markers.js';
import { APP_VERSION } from './core/version.js';
import { BUILTIN_PALETTES } from './core/palettes/builtin.js';
import { parsePaletteFile } from './core/palettes/import.js';
import { debounce, el } from './ui/dom.js';
import { createExportController } from './ui/export-controller.js';
import { createCanvasView } from './ui/canvas-view.js';
import { createPickedMarkers } from './ui/picked-markers.js';
import { initControls } from './ui/controls.js';
import { initDropzone } from './ui/dropzone.js';
import {
  clearDownloadLinks,
  refreshDownloadLinks,
  setExportEnabled,
} from './ui/export-view.js';
import {
  countLabel,
  formatN,
  initI18n,
  localizeDetail,
  localizeError,
  t,
  tp,
} from './ui/i18n.js';
import { initLearn } from './ui/learn-view.js';
import { renderPalette } from './ui/palette-view.js';
import { initShortcuts } from './ui/shortcuts.js';
import { refreshStatus, setStatus, setStatusMessage, toast, toastKey, getLastStatus } from './ui/status.js';
import { initTheme } from './ui/theme.js';
import { initTooltips } from './ui/tooltips.js';
import { clearSession, loadSession, saveSession } from './ui/session-store.js';

const MAX_PIXELS = 16_777_216;
const PREVIEW_EDGE = 1024;
const PICK_LOUPE_SIZE = 108;
const PICK_LOUPE_CELLS = 9;
const PICK_LOUPE_CELL = PICK_LOUPE_SIZE / PICK_LOUPE_CELLS;
const PICK_LOUPE_RADIUS = (PICK_LOUPE_CELLS - 1) / 2;

const versionLabel = document.getElementById('app-version');
if (versionLabel) versionLabel.textContent = `· v${APP_VERSION}`;

const hero = document.getElementById('hero');
const workspace = document.getElementById('workspace');
const frame = /** @type {HTMLElement} */ (document.getElementById('canvas-frame'));
const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('view-canvas'));
const pickedMarkersHost = document.getElementById('picked-markers');
const divider = /** @type {HTMLElement} */ (document.getElementById('divider'));
const paletteStrip = document.getElementById('palette-strip');
const palettePanel = document.querySelector('.peiq-palette-panel');
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
const qaRun = /** @type {HTMLButtonElement|null} */ (document.getElementById('qa-run'));
const qaStatus = document.getElementById('qa-status');
const qaStats = document.getElementById('qa-stats');
const qaMean = document.getElementById('qa-mean');
const qaP95 = document.getElementById('qa-p95');
const qaMax = document.getElementById('qa-max');
const qaErrorField = document.getElementById('qa-error-field');
const qaErrorToggle = /** @type {HTMLInputElement|null} */ (document.getElementById('qa-error-toggle'));
const qaErrorCanvas = /** @type {HTMLCanvasElement|null} */ (document.getElementById('qa-error-canvas'));
const qaWorst = document.getElementById('qa-worst');
const sessionClear = /** @type {HTMLButtonElement|null} */ (document.getElementById('session-clear'));
const sessionStatus = document.getElementById('session-status');
const palettePick = /** @type {HTMLButtonElement|null} */ (document.getElementById('palette-pick'));
const paletteUndo = /** @type {HTMLButtonElement|null} */ (document.getElementById('palette-undo'));
const paletteRedo = /** @type {HTMLButtonElement|null} */ (document.getElementById('palette-redo'));
const paletteEditHint = document.getElementById('palette-edit-hint');
const paletteHintPanel = document.getElementById('palette-hint-panel');
const pickPreview = document.getElementById('palette-pick-preview');
const pickPreviewSwatch = document.getElementById('palette-pick-swatch');
const pickPreviewHex = document.getElementById('palette-pick-hex');
const pickLoupe = document.getElementById('palette-pick-loupe');
const pickLoupeCanvas = /** @type {HTMLCanvasElement|null} */ (
  document.getElementById('palette-pick-canvas')
);
const pickLoupeHex = document.getElementById('palette-pick-loupe-hex');
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
const ditherMethod = /** @type {HTMLSelectElement|null} */ (document.getElementById('dither-method'));
const ditherStrength = /** @type {HTMLInputElement|null} */ (document.getElementById('dither-strength'));
const ditherStrengthValue = document.getElementById('dither-strength-value');
const ditherSerpentine = /** @type {HTMLInputElement|null} */ (document.getElementById('dither-serpentine'));
const edgeStop = /** @type {HTMLInputElement|null} */ (document.getElementById('edge-stop'));
const edgeStopValue = document.getElementById('edge-stop-value');
const canvasEmpty = document.getElementById('canvas-empty');
const toggleOriginal = /** @type {HTMLButtonElement} */ (document.getElementById('toggle-original'));
const header = document.getElementById('header');

initI18n();
const canvasView = createCanvasView({
  canvas,
  frame,
  divider,
  onRender: () => renderPickedMarkers(),
});
const theme = initTheme();
const learn = initLearn();

const app = {
  name: 'image',
  width: 0,
  height: 0,
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
/** @type {number|null} */
let pickPointerId = null;
/** @type {Map<number, {u:number,v:number}>} */
let pickedMarkers = new Map();
/** @type {{u:number,v:number}|null} */
let pendingPickPoint = null;
/** @type {{ id:number, before: ReturnType<typeof paletteSnapshot>, moved:boolean }|null} */
let markerDrag = null;
/** @type {ReturnType<typeof createPickedMarkers>|null} */
let pickedMarkersView = null;
const paletteHistory = { past: [], future: [], limit: 50 };
/** @type {any|null} */
let qaResult = null;
let qaRequestId = 0;
let qaBusy = false;
let qaFailed = false;
let applyingUrlState = false;
/** @type {number|null} */
let pendingTransparentIndex = null;
let pendingTransparentRemap = false;
/** @type {File|Blob|null} */
let lastFile = null;
let loadRequestId = 0;
let restoringSession = false;
let sessionPersistence = true;
let sessionSaveWarned = false;
let sessionStatusKey = '';
let paletteStatusName = '';
let paletteStatusCount = 0;
/** @type {{ kind:'imported'|'restored', name:string, count:number }|null} */
let customPaletteOption = null;
/** @type {{ r:number,g:number,b:number,a:number }[]} */
let fixedColors = [];
let fixedName = '';
/** @type {{ r:number,g:number,b:number,a:number }[]} */
let importedColors = [];
let importedName = '';

const exportController = createExportController({
  app,
  getWorker: () => worker,
  nextRequestId: () => nextRequestId++,
  getParams,
  getProcessParams,
  getColorSpace: () => controls.getParams().space,
  getSortOrder: () => sortOrder,
  decodeFullImage,
  refreshExportState: updateExportState,
  prepareForExport: () => {
    pickedMarkersView?.cancelDrag();
    stopPickMode();
    updatePaletteEditor();
  },
});

if (pickedMarkersHost) {
  pickedMarkersView = createPickedMarkers({
    host: pickedMarkersHost,
    toFramePoint: (u, v) => canvasView.imagePointToFrame(u, v),
    onSelect: selectPickedMarker,
    onDragStart: startPickedMarkerDrag,
    onDragMove: movePickedMarkerDrag,
    onDragEnd: endPickedMarkerDrag,
    onDragCancel: cancelPickedMarkerDrag,
    onNudge: nudgePickedMarker,
  });
}

function createWorker() {
  const instance = new Worker(new URL('./workers/pipeline.worker.js', import.meta.url), {
    type: 'module',
  });
  instance.addEventListener('message', onWorkerMessage);
  instance.addEventListener('error', () => {
    toastKey('toast.workerFailed', {}, 'error');
    setStatusMessage('status.workerError');
    if (canvasEmpty) canvasEmpty.hidden = true;
    app.exportBusy = false;
    exportController.clearExportProgress();
    updateExportState();
  });
  return instance;
}

function onWorkerMessage(event) {
  const message = /** @type {any} */ (event.data);
  if (!message) return;

  if (message.type === 'progress') {
    if (message.requestId === app.previewRequestId) {
      setStatusMessage(
        message.stage === 'extract' ? 'status.extractingPalette' : 'status.processing',
      );
    }
    if (message.requestId === app.exportRequestId && app.exportBusy) {
      const labels = {
        strip: 'status.progressStrip',
        index: 'status.progressIndex',
        encode: 'status.progressEncode',
      };
      if (labels[message.stage]) exportController.setExportProgress(labels[message.stage]);
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
      { value: `${app.width}×${app.height}`, labelKey: 'status.source' },
      { value: formatN(message.uniqueColors, 0), labelKey: 'status.unique' },
      { value: app.palette.length, labelKey: 'unit.colors', count: app.palette.length },
      {
        valueKey: 'status.ms',
        params: { value: formatN(message.timings.extractMs, 0) },
        labelKey: 'status.extract',
      },
      {
        valueKey: 'status.ms',
        params: { value: formatN(message.timings.mapMs, 0) },
        labelKey: 'status.map',
      },
    ]);
    if (app.palette.length === 0) {
      // An indexed PNG needs at least one PLTE entry, so a fully transparent image has
      // nothing to export. Say why instead of leaving the disabled buttons unexplained.
      toastKey('toast.fullyTransparent', {}, 'error');
      setStatus([
        { valueKey: 'status.warning', labelKey: 'status.fullyTransparent' },
        { value: `${app.width}×${app.height}`, labelKey: 'status.source' },
      ]);
    }
    if (pendingTransparentRemap) {
      pendingTransparentRemap = false;
      processPreview();
      return;
    }
    if (restoringSession) {
      restoringSession = false;
      scheduleSessionSave();
    }
    return;
  }

  if (message.type === 'exported') {
    exportController.handleExported(message);
    return;
  }

  if (message.type === 'quality') {
    if (message.requestId !== qaRequestId) return;
    qaBusy = false;
    qaFailed = false;
    qaResult = {
      ...message.result,
      errorMap: {
        data: new Uint8ClampedArray(message.result.errorMap.data),
        width: message.result.errorMap.width,
        height: message.result.errorMap.height,
      },
    };
    renderQuality();
    return;
  }

  if (message.type === 'error') {
    if (
      message.requestId !== app.previewRequestId &&
      message.requestId !== app.exportRequestId &&
      message.requestId !== qaRequestId
    ) {
      return;
    }
    toast(localizeError(message.message || t('toast.processingFailed')), 'error');
    setStatusMessage('status.error');
    if (canvasEmpty) canvasEmpty.hidden = true;
    if (message.requestId === app.exportRequestId) {
      exportController.finishExport();
    } else if (message.requestId === qaRequestId) {
      qaBusy = false;
      qaFailed = true;
      if (qaStatus) qaStatus.textContent = t('quality.statusFailed');
      updateQualityAvailability();
    } else {
      if (restoringSession) restoringSession = false;
      updateExportState();
    }
  }
}

function updateExportState() {
  setExportEnabled(app.hasResult && app.palette.length > 0 && !app.exportBusy);
  updatePaletteEditor();
  updateQualityAvailability();
}

function updateQualityAvailability() {
  if (qaRun) {
    qaRun.disabled =
      !app.hasResult ||
      !app.reduced ||
      app.palette.length === 0 ||
      qaBusy ||
      app.exportBusy;
  }
}

function resetQuality() {
  if (qaRequestId) {
    worker.postMessage({ type: 'cancel', requestId: qaRequestId });
    qaRequestId = 0;
  }
  qaBusy = false;
  qaFailed = false;
  qaResult = null;
  if (qaStats) qaStats.hidden = true;
  if (qaErrorField) qaErrorField.hidden = true;
  if (qaErrorToggle) qaErrorToggle.checked = false;
  if (qaErrorCanvas) qaErrorCanvas.hidden = true;
  if (qaWorst) {
    qaWorst.hidden = true;
    qaWorst.replaceChildren();
  }
  if (qaStatus) qaStatus.textContent = t('quality.statusInitial');
  updateQualityAvailability();
}

function runQuality() {
  if (!app.preview || !app.reduced || qaBusy || app.palette.length === 0) return;
  resetQuality();
  const id = nextRequestId++;
  qaRequestId = id;
  qaBusy = true;
  qaFailed = false;
  if (qaStatus) qaStatus.textContent = t('quality.statusMeasuring');
  updateQualityAvailability();
  const original = new Uint8ClampedArray(app.preview.data);
  const mapped = new Uint8ClampedArray(app.reduced.data);
  worker.postMessage(
    {
      type: 'qa',
      requestId: id,
      width: app.preview.width,
      height: app.preview.height,
      original: { data: original.buffer },
      mapped: { data: mapped.buffer },
    },
    [original.buffer, mapped.buffer],
  );
}

function renderQuality() {
  if (!qaResult) return;
  if (qaStats) qaStats.hidden = false;
  if (qaMean) qaMean.textContent = qaResult.deltaE00Mean.toFixed(2);
  if (qaP95) qaP95.textContent = qaResult.deltaE00P95.toFixed(2);
  if (qaMax) qaMax.textContent = qaResult.deltaE00Max.toFixed(2);
  if (qaErrorField) qaErrorField.hidden = false;
  if (qaErrorToggle) qaErrorToggle.checked = false;
  if (qaErrorCanvas) qaErrorCanvas.hidden = true;
  if (qaWorst) {
    qaWorst.hidden = false;
    qaWorst.replaceChildren();
    qaWorst.append(el('p', { className: 'peiq-label', text: t('quality.worst') }));
    for (const pixel of qaResult.worstPixels) {
      const row = el('div', { className: 'peiq-qa-worst__row' });
      row.append(
        el('span', { text: `${pixel.x}, ${pixel.y}` }),
        el('span', { text: pixel.deltaE00.toFixed(2) }),
      );
      qaWorst.append(row);
    }
  }
  if (qaStatus) {
    qaStatus.textContent = t('quality.statusMeasured', {
      countLabel: tp('count.pixels', qaResult.pixels, { count: qaResult.pixels }),
    });
  }
  updateQualityAvailability();
}

function showQualityMap() {
  if (!qaResult || !qaErrorCanvas || !qaErrorToggle) return;
  if (!qaErrorToggle.checked) {
    qaErrorCanvas.hidden = true;
    return;
  }
  const map = qaResult.errorMap;
  qaErrorCanvas.width = map.width;
  qaErrorCanvas.height = map.height;
  const ctx = qaErrorCanvas.getContext('2d');
  if (!ctx) return;
  ctx.putImageData(
    new ImageData(new Uint8ClampedArray(map.data), map.width, map.height),
    0,
    0,
  );
  qaErrorCanvas.hidden = false;
}

function toggleQualityMap() {
  if (!qaResult || !qaErrorToggle) return;
  const section = document.getElementById('qa-section');
  if (section) section.open = true;
  qaErrorToggle.checked = !qaErrorToggle.checked;
  showQualityMap();
}

function renderPaletteStrip() {
  renderPalette(app.palette, paletteStrip, {
    editMode: paletteEditMode,
    selectedId: selectedPaletteId,
    onActivate: paletteEditMode ? selectPaletteEntry : null,
  });
  if (paletteCount) {
    paletteCount.textContent = countLabel('count.colors', app.palette.length);
  }
  if (sortSelect) sortSelect.disabled = app.palette.length === 0;
}

/**
 * Update one entry without sorting the palette. Marker drag uses this on every
 * pointer move; the full sort and history commit happen once on release.
 *
 * @param {number} id
 * @param {{ r:number,g:number,b:number,a:number }} color
 */
function setPaletteEntryColorLive(id, color) {
  const hex = formatHex(color);
  const entry = app.palette.find((candidate) => candidate.id === id);
  if (!entry || entry.hex === hex) return;
  app.palette = app.palette.map((candidate) =>
    candidate.id === id
      ? { ...candidate, color: { ...color }, hex }
      : candidate,
  );
  if (selectedPaletteId === id && paletteHex) paletteHex.value = hex;
  markPaletteEdited();
  renderPaletteStrip();
  renderPickedMarkers();
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
  const selected = selectedPaletteEntry();
  if (selected && paletteHex && document.activeElement !== paletteHex) {
    paletteHex.value = selected.hex;
  }
  renderPaletteStrip();
  updatePaletteEditor();

  const current = Number(transparentIndex?.value ?? -1);
  populateTransparentIndex(app.palette, current);
  renderPickedMarkers();
  if (app.hasResult && lastFile) scheduleSessionSave();
}

/** @param {{ id:number, hex:string }} entry */
function selectPaletteEntry(entry) {
  selectedPaletteId = entry.id;
  pendingPickPoint = null;
  if (paletteHex) paletteHex.value = entry.hex;
  renderCurrentPalette();
}

/**
 * Clear the edited palette entry. With no selection a Pick sample fills the HEX
 * field for Add instead of overwriting an existing color.
 */
function clearPaletteSelection() {
  if (selectedPaletteId === null) return;
  selectedPaletteId = null;
  pendingPickPoint = null;
  if (paletteHex) paletteHex.value = '';
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
    paletteEdit.textContent = paletteEditMode ? t('palette.done') : t('palette.edit');
    paletteEdit.setAttribute('aria-pressed', String(paletteEditMode));
    paletteEdit.disabled = !app.hasResult || app.palette.length === 0 || app.exportBusy;
  }
  if (paletteEditor) paletteEditor.hidden = !active;
  if (paletteHintPanel) paletteHintPanel.hidden = !active;
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
    paletteLock.textContent = selected?.locked ? t('palette.unlock') : t('palette.lock');
  }
  if (paletteUndo) {
    paletteUndo.disabled = !active || app.exportBusy || paletteHistory.past.length === 0;
  }
  if (paletteRedo) {
    paletteRedo.disabled = !active || app.exportBusy || paletteHistory.future.length === 0;
  }
}

/** @param {boolean} active */
function setPaletteEditMode(active) {
  paletteEditMode = active;
  if (!active) {
    pickedMarkersView?.cancelDrag();
    stopPickMode();
    selectedPaletteId = null;
    pendingPickPoint = null;
    if (paletteHex) paletteHex.value = '';
  }
  renderCurrentPalette();
}

function startPickMode() {
  if (!paletteEditMode || !app.hasResult || app.exportBusy) return;
  pickingColor = true;
  palettePick?.setAttribute('aria-pressed', 'true');
  frame.classList.add('is-picking');
  if (paletteEditHint) paletteEditHint.textContent = t('palette.pickHint');
  hidePickPreview();
  hidePickLoupe();
  updatePaletteEditor();
}

function stopPickMode() {
  if (!pickingColor) return;
  pickingColor = false;
  palettePick?.setAttribute('aria-pressed', 'false');
  frame.classList.remove('is-picking');
  if (pickPointerId !== null) {
    if (canvas.hasPointerCapture(pickPointerId)) canvas.releasePointerCapture(pickPointerId);
    pickPointerId = null;
  }
  hidePickPreview();
  hidePickLoupe();
  if (paletteEditHint) paletteEditHint.textContent = t('palette.editHint');
  updatePaletteEditor();
}

function hidePickPreview() {
  if (pickPreview) pickPreview.hidden = true;
}

function hidePickLoupe() {
  if (pickLoupe) pickLoupe.hidden = true;
}

/**
 * Draw a magnified crop around the sampled pixel. The extra context makes touch
 * picking possible: the finger no longer covers the only visible sample.
 * @param {{ color: { r:number,g:number,b:number,a:number }, source: { data: Uint8ClampedArray, width:number, height:number }, x:number, y:number }} sample
 */
function drawPickLoupe(sample) {
  if (!pickLoupeCanvas) return;
  const ctx = pickLoupeCanvas.getContext('2d');
  if (!ctx) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const pixels = Math.round(PICK_LOUPE_SIZE * dpr);
  if (pickLoupeCanvas.width !== pixels || pickLoupeCanvas.height !== pixels) {
    pickLoupeCanvas.width = pixels;
    pickLoupeCanvas.height = pixels;
  }
  ctx.setTransform(pixels / PICK_LOUPE_SIZE, 0, 0, pixels / PICK_LOUPE_SIZE, 0, 0);
  ctx.clearRect(0, 0, PICK_LOUPE_SIZE, PICK_LOUPE_SIZE);

  const { source, x, y } = sample;
  for (let dy = -PICK_LOUPE_RADIUS; dy <= PICK_LOUPE_RADIUS; dy++) {
    for (let dx = -PICK_LOUPE_RADIUS; dx <= PICK_LOUPE_RADIUS; dx++) {
      const sourceX = x + dx;
      const sourceY = y + dy;
      if (sourceX < 0 || sourceY < 0 || sourceX >= source.width || sourceY >= source.height) {
        continue;
      }
      const offset = (sourceY * source.width + sourceX) * 4;
      const alpha = source.data[offset + 3];
      if (alpha === 0) continue;
      ctx.fillStyle = `rgba(${source.data[offset]}, ${source.data[offset + 1]}, ${source.data[offset + 2]}, ${alpha / 255})`;
      ctx.fillRect(
        (dx + PICK_LOUPE_RADIUS) * PICK_LOUPE_CELL,
        (dy + PICK_LOUPE_RADIUS) * PICK_LOUPE_CELL,
        PICK_LOUPE_CELL,
        PICK_LOUPE_CELL,
      );
    }
  }

  const styles = getComputedStyle(document.documentElement);
  const accent = styles.getPropertyValue('--peiq-accent').trim();
  if (accent) ctx.strokeStyle = accent;
  ctx.lineWidth = 2;
  const center = PICK_LOUPE_RADIUS * PICK_LOUPE_CELL;
  ctx.strokeRect(center + 1, center + 1, PICK_LOUPE_CELL - 2, PICK_LOUPE_CELL - 2);
  const mid = PICK_LOUPE_SIZE / 2;
  ctx.beginPath();
  ctx.moveTo(mid, 0);
  ctx.lineTo(mid, center - 3);
  ctx.moveTo(mid, center + PICK_LOUPE_CELL + 3);
  ctx.lineTo(mid, PICK_LOUPE_SIZE);
  ctx.moveTo(0, mid);
  ctx.lineTo(center - 3, mid);
  ctx.moveTo(center + PICK_LOUPE_CELL + 3, mid);
  ctx.lineTo(PICK_LOUPE_SIZE, mid);
  ctx.stroke();
}

/** @param {number} clientX @param {number} clientY */
function positionPickLoupe(clientX, clientY) {
  if (!pickLoupe) return;
  const rect = pickLoupe.getBoundingClientRect();
  const gap = 18;
  const margin = 8;
  let left = clientX - rect.width / 2;
  let top = clientY - rect.height - gap;
  if (top < margin) top = clientY + gap;
  left = Math.min(Math.max(margin, left), window.innerWidth - rect.width - margin);
  top = Math.min(Math.max(margin, top), window.innerHeight - rect.height - margin);
  pickLoupe.style.left = `${Math.round(left)}px`;
  pickLoupe.style.top = `${Math.round(top)}px`;
}

/** @param {PointerEvent} event */
function updatePickLoupe(event) {
  if (!pickLoupe) return;
  const sample = canvasView.pickSample(event.clientX, event.clientY);
  if (!sample || sample.color.a === 0) {
    hidePickLoupe();
    return;
  }
  drawPickLoupe(sample);
  if (pickLoupeHex) pickLoupeHex.textContent = formatHex(sample.color);
  pickLoupe.hidden = false;
  positionPickLoupe(event.clientX, event.clientY);
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
function updatePickFeedback(event) {
  if (!pickingColor) return;
  if (pickPointerId !== null) {
    updatePickLoupe(event);
    hidePickPreview();
  } else {
    updatePickPreview(event);
    hidePickLoupe();
  }
}

/**
 * @param {{ source: { width:number, height:number }, x:number, y:number }} sample
 * @returns {{ u:number, v:number }}
 */
function normalizePickPoint(sample) {
  return {
    u: Math.min(1, Math.max(0, (sample.x + 0.5) / sample.source.width)),
    v: Math.min(1, Math.max(0, (sample.y + 0.5) / sample.source.height)),
  };
}

/**
 * @param {number} id
 * @param {{ r:number,g:number,b:number,a:number }} color
 * @returns {boolean}
 */
function hasDuplicatePaletteColor(id, color) {
  return app.palette.some(
    (entry) =>
      entry.id !== id &&
      entry.color.r === color.r &&
      entry.color.g === color.g &&
      entry.color.b === color.b &&
      entry.color.a === color.a,
  );
}

/** Remove markers for entries that no longer exist or became transparent. */
function prunePickedMarkers() {
  const ids = new Set(app.palette.map((entry) => entry.id));
  for (const id of pickedMarkers.keys()) {
    if (!ids.has(id)) pickedMarkers.delete(id);
  }
  const transparent = currentTransparentId();
  if (transparent !== null) pickedMarkers.delete(transparent);
  if (pendingPickPoint && app.palette.length === 0) pendingPickPoint = null;
}

function renderPickedMarkers() {
  if (!pickedMarkersView) return;
  prunePickedMarkers();
  pickedMarkersView.render({
    entries: app.palette,
    markers: pickedMarkers,
    selectedId: selectedPaletteId,
    active: paletteEditMode && app.hasResult && !app.exportBusy,
  });
}

/** @param {number} id */
function selectPickedMarker(id) {
  const entry = app.palette.find((candidate) => candidate.id === id);
  if (!entry) return;
  selectedPaletteId = id;
  pendingPickPoint = null;
  if (paletteHex) paletteHex.value = entry.hex;
  renderCurrentPalette();
}

/**
 * @param {number} id
 * @param {PointerEvent} event
 */
function startPickedMarkerDrag(id, event) {
  if (!paletteEditMode || app.exportBusy) return;
  const entry = app.palette.find((candidate) => candidate.id === id);
  if (!entry) return;
  markerDrag = { id, before: paletteSnapshot(), moved: false };
  pendingPickPoint = null;
  hidePickPreview();
  updatePickLoupe(event);
}

/**
 * @param {number} id
 * @param {PointerEvent} event
 */
function movePickedMarkerDrag(id, event) {
  if (!markerDrag || markerDrag.id !== id) return;
  const sample = canvasView.pickSample(event.clientX, event.clientY);
  if (!sample || sample.color.a === 0) {
    hidePickLoupe();
    return;
  }
  markerDrag.moved = true;
  pickedMarkers.set(id, normalizePickPoint(sample));
  setPaletteEntryColorLive(id, sample.color);
  updatePickLoupe(event);
  scheduleProcess();
}

/**
 * @param {number} id
 * @param {PointerEvent} event
 * @param {boolean} moved
 */
function endPickedMarkerDrag(id, event, moved) {
  if (!markerDrag || markerDrag.id !== id) return;
  const transaction = markerDrag;
  markerDrag = null;
  hidePickLoupe();
  if (!moved) {
    renderCurrentPalette();
    return;
  }
  const sample = canvasView.pickSample(event.clientX, event.clientY);
  if (!sample || sample.color.a === 0) {
    restorePaletteSnapshot(transaction.before);
    toastKey(
      sample ? 'toast.pickTransparent' : 'toast.pickOutside',
      {},
      'error',
    );
    return;
  }
  if (hasDuplicatePaletteColor(id, sample.color)) {
    restorePaletteSnapshot(transaction.before);
    toastKey('error.duplicateColor', {}, 'error');
    return;
  }
  pickedMarkers.set(id, normalizePickPoint(sample));
  setPaletteEntryColorLive(id, sample.color);
  renderCurrentPalette();
  processPreview();
  pushPaletteHistory(transaction.before);
  toastKey('toast.colorUpdated', {}, 'success');
}

/** @param {number} id */
function cancelPickedMarkerDrag(id) {
  if (!markerDrag || markerDrag.id !== id) return;
  const transaction = markerDrag;
  markerDrag = null;
  hidePickLoupe();
  restorePaletteSnapshot(transaction.before);
}

/**
 * @param {number} id
 * @param {string} key
 * @param {number} step
 */
function nudgePickedMarker(id, key, step) {
  if (!paletteEditMode || app.exportBusy) return;
  const point = pickedMarkers.get(id);
  if (!point) return;
  const dx = key === 'ArrowLeft' ? -step : key === 'ArrowRight' ? step : 0;
  const dy = key === 'ArrowUp' ? -step : key === 'ArrowDown' ? step : 0;
  if (dx === 0 && dy === 0) return;
  const nextPoint = {
    u: Math.min(1, Math.max(0, point.u + dx)),
    v: Math.min(1, Math.max(0, point.v + dy)),
  };
  const color = canvasView.pickColorAtImagePoint(nextPoint.u, nextPoint.v);
  if (!color || color.a === 0) return;
  const before = paletteSnapshot();
  try {
    app.palette = updatePaletteEntry(app.palette, id, formatHex(color));
    pickedMarkers.set(id, nextPoint);
    selectedPaletteId = id;
    if (paletteHex) paletteHex.value = formatHex(color);
    markPaletteEdited();
    renderCurrentPalette();
    processPreview();
    pushPaletteHistory(before);
  } catch (error) {
    toast(localizeError(error), 'error');
  }
}

function currentTransparentId() {
  const position = Number(transparentIndex?.value ?? -1);
  return position >= 0 ? app.palette[position]?.id ?? null : null;
}

function paletteSnapshot() {
  return {
    palette: app.palette.map((entry) => ({ ...entry, color: { ...entry.color } })),
    sortOrder,
    selectedId: selectedPaletteId,
    transparentId: currentTransparentId(),
    markers: pickedMarkersToArray(pickedMarkers),
  };
}

/** @param {ReturnType<typeof paletteSnapshot>} snapshot */
function pushPaletteHistory(snapshot) {
  paletteHistory.past.push(snapshot);
  if (paletteHistory.past.length > paletteHistory.limit) paletteHistory.past.shift();
  paletteHistory.future.length = 0;
  updatePaletteEditor();
}

/** @param {ReturnType<typeof paletteSnapshot>} snapshot */
function restorePaletteSnapshot(snapshot) {
  app.palette = snapshot.palette.map((entry) => ({
    ...entry,
    color: { ...entry.color },
  }));
  sortOrder = snapshot.sortOrder;
  if (sortSelect) sortSelect.value = sortOrder;
  selectedPaletteId = snapshot.selectedId;
  pickedMarkers = pickedMarkersFromArray(snapshot.markers);
  pendingPickPoint = null;
  markPaletteEdited();
  renderCurrentPalette();
  const selected = selectedPaletteEntry();
  if (paletteHex) paletteHex.value = selected?.hex ?? '';
  const position =
    snapshot.transparentId === null
      ? -1
      : app.palette.findIndex((entry) => entry.id === snapshot.transparentId);
  if (transparentIndex) {
    transparentIndex.value = position >= 0 ? String(position) : '-1';
  }
  processPreview();
  syncUrlState();
}

function undoPaletteEdit() {
  if (!paletteEditMode || paletteHistory.past.length === 0) return;
  paletteHistory.future.push(paletteSnapshot());
  const snapshot = paletteHistory.past.pop();
  restorePaletteSnapshot(snapshot);
  toastKey('toast.undo', {}, 'success');
}

function redoPaletteEdit() {
  if (!paletteEditMode || paletteHistory.future.length === 0) return;
  paletteHistory.past.push(paletteSnapshot());
  const snapshot = paletteHistory.future.pop();
  restorePaletteSnapshot(snapshot);
  toastKey('toast.redo', {}, 'success');
}

/** @param {PointerEvent} event */
function handleCanvasPick(event) {
  if (!pickingColor || pickPointerId !== null) return;
  if (event.pointerType === 'mouse' && event.button !== 0) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  pickPointerId = event.pointerId;
  canvas.setPointerCapture(event.pointerId);
  updatePickFeedback(event);
}

/** @param {PointerEvent} event */
function handlePickEnd(event) {
  if (!pickingColor || pickPointerId !== event.pointerId) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  pickPointerId = null;
  if (canvas.hasPointerCapture(event.pointerId)) {
    canvas.releasePointerCapture(event.pointerId);
  }
  const sample = canvasView.pickSample(event.clientX, event.clientY);
  hidePickPreview();
  hidePickLoupe();
  if (!sample) {
    toastKey('toast.pickOutside', {}, 'error');
    return;
  }
  if (sample.color.a === 0) {
    toastKey('toast.pickTransparent', {}, 'error');
    return;
  }
  const color = sample.color;
  // Keep Pick armed after a successful sample so several swatches can be
  // recolored without pressing the button again. Pick toggles off, and Esc
  // still stops the mode.
  if (paletteHex) paletteHex.value = formatHex(color);
  if (selectedPaletteEntry()) {
    applyPaletteHex(normalizePickPoint(sample));
  } else {
    pendingPickPoint = normalizePickPoint(sample);
    toastKey('toast.picked', { hex: formatHex(color) }, 'success');
  }
}

/** @param {PointerEvent} event */
function handlePickCancel(event) {
  if (pickPointerId !== event.pointerId) return;
  pickPointerId = null;
  hidePickPreview();
  hidePickLoupe();
}

function markPaletteEdited() {
  app.paletteEdited = true;
  if (mode === 'map') {
    fixedColors = app.palette.map((entry) => ({ ...entry.color }));
  }
}

function resetPaletteEdits() {
  pickedMarkersView?.cancelDrag();
  stopPickMode();
  pickedMarkers.clear();
  pendingPickPoint = null;
  markerDrag = null;
  paletteHistory.past.length = 0;
  paletteHistory.future.length = 0;
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

/**
 * @param {{ u:number, v:number }|null} [sample]
 */
function applyPaletteHex(sample = null) {
  const selected = selectedPaletteEntry();
  if (!selected) return;
  const value = paletteHexValue();
  if (!value) {
    toastKey('toast.enterHex', {}, 'error');
    return;
  }
  try {
    const next = updatePaletteEntry(app.palette, selected.id, value);
    const before = paletteSnapshot();
    app.palette = next;
    if (sample) {
      if (selected.id === currentTransparentId()) pickedMarkers.delete(selected.id);
      else pickedMarkers.set(selected.id, sample);
    }
    const updated = app.palette.find((entry) => entry.id === selected.id);
    if (paletteHex && updated) paletteHex.value = updated.hex;
    markPaletteEdited();
    renderCurrentPalette();
    processPreview();
    pushPaletteHistory(before);
    toastKey('toast.colorUpdated', {}, 'success');
  } catch (error) {
    toast(localizeError(error), 'error');
  }
}

function addPaletteColor() {
  const value = paletteHexValue();
  if (!value) {
    toastKey('toast.enterHex', {}, 'error');
    return;
  }
  try {
    const next = addPaletteEntry(app.palette, value);
    const entry = next[next.length - 1];
    const before = paletteSnapshot();
    app.palette = next;
    selectedPaletteId = entry.id;
    if (pendingPickPoint && entry.id !== currentTransparentId()) {
      pickedMarkers.set(entry.id, pendingPickPoint);
    }
    pendingPickPoint = null;
    if (paletteHex) paletteHex.value = entry.hex;
    markPaletteEdited();
    renderCurrentPalette();
    processPreview();
    pushPaletteHistory(before);
    toastKey('toast.colorAdded', { hex: entry.hex }, 'success');
  } catch (error) {
    toast(localizeError(error), 'error');
  }
}

function removePaletteColor() {
  const selected = selectedPaletteEntry();
  if (!selected) return;
  try {
    const next = removePaletteEntry(app.palette, selected.id);
    const before = paletteSnapshot();
    app.palette = next;
    pickedMarkers.delete(selected.id);
    selectedPaletteId = null;
    if (paletteHex) paletteHex.value = '';
    markPaletteEdited();
    renderCurrentPalette();
    processPreview();
    pushPaletteHistory(before);
    toastKey('toast.colorRemoved', { hex: selected.hex }, 'success');
  } catch (error) {
    toast(localizeError(error), 'error');
  }
}

function togglePaletteLock() {
  const selected = selectedPaletteEntry();
  if (!selected) return;
  try {
    const next = setPaletteLock(app.palette, selected.id, !selected.locked);
    const before = paletteSnapshot();
    app.palette = next;
    markPaletteEdited();
    renderCurrentPalette();
    pushPaletteHistory(before);
    toastKey(
      selected.locked ? 'toast.unlocked' : 'toast.locked',
      { hex: selected.hex },
      'success',
    );
  } catch (error) {
    toast(localizeError(error), 'error');
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
    const before = paletteSnapshot();
    sortOrder = 'manual';
    if (sortSelect) sortSelect.value = 'manual';
    app.palette = moved;
    markPaletteEdited();
    renderCurrentPalette();
    if (transparentId !== null && transparentIndex) {
      const nextPosition = app.palette.findIndex((entry) => entry.id === transparentId);
      if (nextPosition >= 0) transparentIndex.value = String(nextPosition);
    }
    processPreview();
    pushPaletteHistory(before);
    updatePaletteEditor();
    syncUrlState();
    toastKey(
      direction === 'left' ? 'toast.movedLeft' : 'toast.movedRight',
      { hex: selected.hex },
      'success',
    );
  } catch (error) {
    toast(localizeError(error), 'error');
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
  none.textContent = t('transparent.none');
  transparentIndex.append(none);
  palette.forEach((entry, index) => {
    const option = document.createElement('option');
    option.value = String(index);
    option.textContent = `${index} · ${entry.hex}`;
    transparentIndex.append(option);
  });
  transparentIndex.disabled = palette.length === 0;
  if (pendingTransparentIndex !== null && palette.length > 0) {
    const pending = pendingTransparentIndex;
    pendingTransparentIndex = null;
    transparentIndex.value =
      pending >= 0 && pending < palette.length ? String(pending) : '-1';
    if (app.hasResult) pendingTransparentRemap = true;
    return;
  }
  const valid = preferred >= 0 && preferred < palette.length;
  transparentIndex.value = valid ? String(preferred) : '-1';
}

/**
 * @param {string} name
 * @param {number} count
 */
function setPaletteStatus(name, count) {
  paletteStatusName = name;
  paletteStatusCount = count;
  renderPaletteStatus();
}

function renderPaletteStatus() {
  if (!paletteStatus || !paletteStatusName) return;
  paletteStatus.textContent = t('palette.status', {
    name: paletteStatusName,
    countLabel: countLabel('count.colors', paletteStatusCount),
  });
}

/**
 * @param {'imported'|'restored'} kind
 * @param {string} name
 * @param {number} count
 */
function setCustomPaletteOption(kind, name, count) {
  customPaletteOption = { kind, name, count };
  renderCustomPaletteOption();
}

function renderCustomPaletteOption() {
  if (!paletteSelect || !customPaletteOption) return;
  const option = [...paletteSelect.options].find(
    (candidate) => candidate.value === 'imported',
  );
  if (!option) return;
  const key =
    customPaletteOption.kind === 'imported'
      ? 'palette.importedOption'
      : 'palette.restoredOption';
  option.textContent = t(key, {
    name: customPaletteOption.name,
    countLabel: countLabel('count.colors', customPaletteOption.count),
  });
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

function buildUrlState() {
  const params = controls.getParams();
  const selectedPalette = paletteSelect?.value ?? 'pico-8';
  const palette = BUILTIN_PALETTES.some((entry) => entry.id === selectedPalette)
    ? selectedPalette
    : 'pico-8';
  return {
    mode,
    method: params.method,
    colors: params.colors,
    space: params.space,
    palette,
    dither: ditherMethod?.value || 'none',
    strength: Number(ditherStrength?.value ?? 80),
    serpentine: ditherSerpentine?.checked ?? true,
    edgeStop: Number(edgeStop?.value ?? 50),
    alphaThreshold: Number(alphaThreshold?.value ?? 128),
    transparentIndex: Number(transparentIndex?.value ?? -1),
    sortOrder,
  };
}

function syncUrlState() {
  if (applyingUrlState) return;
  const hash = encodeUrlState(buildUrlState());
  const next = `${location.pathname}${location.search}#${hash}`;
  if (`${location.pathname}${location.search}${location.hash}` !== next) {
    window.history.replaceState(null, '', next);
  }
  scheduleSessionSave();
}

function applyUrlState(state) {
  applyingUrlState = true;
  try {
    const method = /** @type {HTMLSelectElement|null} */ (document.getElementById('method'));
    const colors = /** @type {HTMLInputElement|null} */ (document.getElementById('colors'));
    const colorsNumber = /** @type {HTMLInputElement|null} */ (
      document.getElementById('colors-number')
    );
    const space = /** @type {HTMLSelectElement|null} */ (document.getElementById('space'));
    if (method) method.value = state.method;
    if (colors) colors.value = String(state.colors);
    if (colorsNumber) colorsNumber.value = String(state.colors);
    if (space) space.value = state.space;
    if (ditherMethod) ditherMethod.value = state.dither;
    if (ditherStrength) ditherStrength.value = String(state.strength);
    if (ditherSerpentine) ditherSerpentine.checked = state.serpentine;
    if (edgeStop) edgeStop.value = String(state.edgeStop);
    if (alphaThreshold) alphaThreshold.value = String(state.alphaThreshold);
    if (sortSelect) sortSelect.value = state.sortOrder;
    sortOrder = state.sortOrder;
    if (paletteSelect) paletteSelect.value = state.palette;

    setMode(state.mode);
    pendingTransparentIndex =
      state.mode === 'map' || state.transparentIndex >= 0 ? state.transparentIndex : null;
    renderCurrentPalette();
    updateDitherLabels();
    updateDitherControls();
  } finally {
    applyingUrlState = false;
  }
}

function buildSessionRecord() {
  if (!lastFile) return null;
  return {
    version: SESSION_VERSION,
    image: {
      name: lastFile instanceof File ? lastFile.name : 'image',
      type: lastFile.type || 'application/octet-stream',
      size: lastFile.size,
    },
    state: {
      settings: buildUrlState(),
      paletteValue: paletteSelect?.value ?? 'pico-8',
      paletteName: fixedName || importedName || '',
      palette: clonePalette(app.palette),
      paletteEdited: app.paletteEdited,
      sortOrder,
      selectedId: selectedPaletteId,
      transparentId: currentTransparentId(),
      markers: pickedMarkersToArray(pickedMarkers),
      editing: paletteEditMode,
      history: cloneHistory(paletteHistory),
    },
  };
}

async function saveCurrentSession() {
  if (restoringSession || !sessionPersistence || !lastFile || !app.hasResult) return;
  const file = lastFile;
  try {
    // Store bytes, not a File or Blob. Mobile browsers may not preserve a picked
    // file's backing data across a reload even when IndexedDB returns a Blob.
    const bytes = await file.arrayBuffer();
    if (lastFile !== file || !sessionPersistence) return;
    if (bytes.byteLength === 0 || (file.size > 0 && bytes.byteLength !== file.size)) {
      throw new Error('saved image bytes are incomplete');
    }
    const record = buildSessionRecord();
    if (!record) return;
    record.image.bytes = bytes;
    record.image.size = bytes.byteLength;
    await saveSession(record);
    sessionStatusKey = 'session.saved';
    renderSessionStatus();
  } catch (error) {
    if (!sessionSaveWarned) {
      sessionSaveWarned = true;
      toastKey(
        'toast.sessionSaveFailed',
        { detail: localizeError(error) },
        'error',
      );
    }
    sessionPersistence = false;
  }
}

function renderSessionStatus() {
  if (sessionStatus && sessionStatusKey) {
    sessionStatus.textContent = t(sessionStatusKey);
  }
}

async function forgetSavedSession() {
  try {
    await clearSession();
    lastFile = null;
    sessionPersistence = false;
    sessionStatusKey = 'session.cleared';
    renderSessionStatus();
    toastKey('toast.sessionCleared', {}, 'success');
  } catch (error) {
    toastKey(
      'toast.sessionClearFailed',
      { detail: localizeError(error) },
      'error',
    );
  }
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
  if (next === 'map' && transparentIndex && transparentIndex.value === '-1') {
    transparentIndex.value = '0';
  }
  if (app.preview) processPreview();
  syncUrlState();
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
  setPaletteStatus(name, colors.length);
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
    setPaletteStatus(first.name, first.colors.length);
  }
}

function processPreview() {
  if (!app.preview) return;
  resetQuality();
  if (qaRun) qaRun.disabled = true;
  if (mode === 'map' && fixedColors.length === 0) {
    if (!loadTargetPalette(paletteSelect?.value || 'pico-8')) return;
  }
  exportController.cancelExport();
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
  setStatusMessage('status.processingPreview');
}

/**
 * @param {File} file
 * @param {any} [restore]
 */
async function loadFile(file, restore = null) {
  const requestId = ++loadRequestId;
  try {
    if (!restore) sessionPersistence = true;
    exportController.cancelExport();
    setStatusMessage('status.decoding');
    const bitmap = await decodeBitmap(file);
    // A newer load, including a user drop while the saved session is still decoding,
    // owns the UI. Never let a stale restore overwrite it.
    if (requestId !== loadRequestId) {
      bitmap.close?.();
      return;
    }
    const width = bitmap.width;
    const height = bitmap.height;
    let preview;

    try {
      if (width < 1 || height < 1) {
        throw new Error(t('error.invalidDimensions'));
      }
      if (width * height > MAX_PIXELS) {
        throw new Error(
          t('error.imageTooLarge', {
            width,
            height,
            mp: formatN((width * height) / 1_000_000),
          }),
        );
      }

      const scale = Math.min(1, PREVIEW_EDGE / Math.max(width, height));
      const previewWidth = Math.max(1, Math.round(width * scale));
      const previewHeight = Math.max(1, Math.round(height * scale));
      preview = drawToImageData(bitmap, previewWidth, previewHeight, true);
    } finally {
      bitmap.close?.();
    }

    app.name = file.name || 'image';
    app.width = width;
    app.height = height;
    app.preview = preview;
    app.reduced = null;
    app.palette = [];
    app.hasResult = false;
    resetPaletteEdits();
    if (restore) {
      app.palette = clonePalette(Array.isArray(restore.palette) ? restore.palette : []);
      app.paletteEdited = Boolean(restore.paletteEdited) || mode === 'map';
      sortOrder = restore.sortOrder || 'source';
      if (sortSelect) sortSelect.value = sortOrder;
      const history = cloneHistory(restore.history ?? { past: [], future: [] });
      paletteHistory.past = history.past;
      paletteHistory.future = history.future;
      selectedPaletteId = restore.selectedId ?? null;
      paletteEditMode = Boolean(restore.editing);
      pickedMarkers = pickedMarkersFromArray(restore.markers);
      pendingPickPoint = null;
      if (mode === 'map') {
        fixedColors = app.palette.map((entry) => ({ ...entry.color }));
      }
      if (restore.paletteValue && paletteSelect) {
        let option = /** @type {HTMLOptionElement|null} */ (
          [...paletteSelect.options].find((candidate) => candidate.value === restore.paletteValue) ?? null
        );
        if (!option && restore.paletteValue === 'imported') {
          option = document.createElement('option');
          option.value = 'imported';
          paletteSelect.append(option);
        }
        if (option) {
          paletteSelect.value = restore.paletteValue;
        }
        if (restore.paletteValue === 'imported') {
          setCustomPaletteOption(
            'restored',
            restore.paletteName || t('palette.restoredSession'),
            app.palette.length,
          );
        }
      }
      setPaletteStatus(
        restore.paletteName || t('palette.restoredSession'),
        app.palette.length,
      );
    }
    lastFile = file;
    clearDownloadLinks();

    if (hero) hero.hidden = true;
    if (workspace) workspace.hidden = false;
    canvasView.setOriginal(preview);
    renderCurrentPalette();
    if (restore && restore.transparentId !== null && restore.transparentId !== undefined) {
      const position = app.palette.findIndex((entry) => entry.id === restore.transparentId);
      if (transparentIndex) {
        transparentIndex.value = position >= 0 ? String(position) : '-1';
      }
      pendingTransparentIndex = null;
    } else if (restore) {
      if (transparentIndex) transparentIndex.value = '-1';
      pendingTransparentIndex = null;
    }
    setExportEnabled(false);
    if (canvasEmpty) {
      canvasEmpty.hidden = false;
      canvasEmpty.textContent = t('canvas.processing');
    }
    setStatus([
      { value: `${width}×${height}`, labelKey: 'status.source' },
      { value: file.name || t('status.file'), labelKey: 'status.file' },
    ]);
    processPreview();
  } catch (error) {
    if (requestId !== loadRequestId) return;
    if (restore) {
      restoringSession = false;
      sessionPersistence = false;
      clearSession().catch(() => {
        setStatusMessage('status.savedSessionCouldNotClear');
      });
      toastKey('toast.sessionRestoreFailed', {}, 'error');
      setStatusMessage('status.sessionRestoreFailed');
      return;
    }
    toast(localizeError(error), 'error');
    setStatusMessage('status.couldNotReadImage');
  }
}

/**
 * @param {File} file
 * @returns {Promise<ImageBitmap>}
 */
async function decodeBitmap(file) {
  if (typeof createImageBitmap !== 'function') {
    throw new Error(t('error.createImageBitmapMissing'));
  }
  let failure = null;
  try {
    return await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch (error) {
    failure = error;
  }
  try {
    return await createImageBitmap(file);
  } catch (error) {
    failure = error;
  }
  try {
    return await decodeViaImageElement(file);
  } catch (error) {
    failure = error;
  }
  throw new Error(t('error.imageDecode'), { cause: failure ?? undefined });
}

/**
 * Last-resort decoder for browsers that accept the blob in an <img> but fail in
 * createImageBitmap after IndexedDB restore.
 * @param {Blob} file
 * @returns {Promise<ImageBitmap>}
 */
async function decodeViaImageElement(file) {
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    if (image.naturalWidth < 1 || image.naturalHeight < 1) {
      throw new Error(t('error.invalidDimensions'));
    }
    return await createImageBitmap(image);
  } finally {
    URL.revokeObjectURL(url);
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
  if (!ctx) throw new Error(t('error.canvasUnavailable'));
  ctx.imageSmoothingEnabled = smooth;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, 0, 0, width, height);
  return ctx.getImageData(0, 0, width, height);
}

/**
 * Decode the source at full resolution only when an export needs it. Keeping a
 * 16 MP RGBA copy for the whole session costs 64 MiB; the preview does not need it.
 * @returns {Promise<ImageData|null>}
 */
async function decodeFullImage() {
  if (!lastFile) return null;
  const bitmap = await decodeBitmap(lastFile);
  try {
    if (bitmap.width !== app.width || bitmap.height !== app.height) {
      throw new Error(t('error.imageDecode'));
    }
    return drawToImageData(bitmap, bitmap.width, bitmap.height, false);
  } finally {
    bitmap.close?.();
  }
}

function toggleOriginalState() {
  const next = toggleOriginal.getAttribute('aria-pressed') !== 'true';
  toggleOriginal.setAttribute('aria-pressed', String(next));
  renderOriginalLabels();
  canvasView.setShowOriginal(next);
}

function renderOriginalLabels() {
  const next = toggleOriginal.getAttribute('aria-pressed') === 'true';
  const label = next ? t('toolbar.reduced') : t('toolbar.original');
  const shortLabelText = next
    ? t('toolbar.reducedShort')
    : t('toolbar.originalShort');
  const longLabel = document.getElementById('toggle-original-label');
  const shortLabel = document.getElementById('toggle-original-short');
  if (longLabel) longLabel.textContent = label;
  if (shortLabel) shortLabel.textContent = shortLabelText;
}

function refreshDynamicUi() {
  const lastStatus = getLastStatus();
  const validationDetail = exportController.getValidationDetail();
  if (
    lastStatus.kind === 'message' &&
    lastStatus.key === 'status.validatedReady' &&
    validationDetail
  ) {
    setStatusMessage('status.validatedReady', {
      detail: localizeDetail(validationDetail),
    });
  } else {
    refreshStatus();
  }
  refreshDownloadLinks();
  renderCurrentPalette();
  updatePaletteEditor();
  renderPaletteStatus();
  renderCustomPaletteOption();
  renderSessionStatus();
  renderOriginalLabels();
  if (canvasEmpty) canvasEmpty.textContent = t('canvas.processing');
  if (paletteEditHint) {
    paletteEditHint.textContent = t(
      pickingColor ? 'palette.pickHint' : 'palette.editHint',
    );
  }
  const progressKey = exportController.getProgressKey();
  if (progressKey) {
    const label = document.getElementById('export-progress-label');
    if (label) label.textContent = t(progressKey);
  }
  if (qaStatus) {
    if (qaBusy) qaStatus.textContent = t('quality.statusMeasuring');
    else if (qaFailed) qaStatus.textContent = t('quality.statusFailed');
    else if (qaResult) {
      qaStatus.textContent = t('quality.statusMeasured', {
        countLabel: tp('count.pixels', qaResult.pixels, {
          count: qaResult.pixels,
        }),
      });
    } else qaStatus.textContent = t('quality.statusInitial');
  }
  if (qaResult && qaWorst) {
    const label = qaWorst.querySelector('.peiq-label');
    if (label) label.textContent = t('quality.worst');
  }
}

const controls = initControls({
  onChange: () => {
    if (mode === 'extract') resetPaletteEdits();
    processPreview();
    syncUrlState();
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
  onToggleErrorMap: toggleQualityMap,
});

document.getElementById('zoom-out')?.addEventListener('click', () => canvasView.zoomOut());
document.getElementById('fit-view')?.addEventListener('click', () => canvasView.fit());
document.getElementById('zoom-100')?.addEventListener('click', () => canvasView.zoom100());
document.getElementById('zoom-in')?.addEventListener('click', () => canvasView.zoomIn());
sortSelect?.addEventListener('change', () => {
  sortOrder = sortSelect.value || 'source';
  renderCurrentPalette();
  clearDownloadLinks();
  syncUrlState();
});

paletteEdit?.addEventListener('click', () => setPaletteEditMode(!paletteEditMode));
paletteStrip?.addEventListener('click', (event) => {
  if (!paletteEditMode) return;
  const target = /** @type {Element|null} */ (event.target);
  if (target?.closest('.peiq-swatch')) return;
  clearPaletteSelection();
});
palettePanel?.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape' || !paletteEditMode || selectedPaletteId === null) return;
  if (pickingColor || markerDrag) return;
  event.preventDefault();
  clearPaletteSelection();
});
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
paletteUndo?.addEventListener('click', undoPaletteEdit);
paletteRedo?.addEventListener('click', redoPaletteEdit);
qaRun?.addEventListener('click', runQuality);
qaErrorToggle?.addEventListener('change', showQualityMap);
document.addEventListener('keydown', (event) => {
  if (!paletteEditMode || app.exportBusy) return;
  if (!(event.ctrlKey || event.metaKey) || event.altKey) return;
  const target = /** @type {HTMLElement|null} */ (event.target);
  if (
    target &&
    (target.tagName === 'INPUT' ||
      target.tagName === 'SELECT' ||
      target.tagName === 'TEXTAREA' ||
      target.isContentEditable)
  ) {
    return;
  }
  const key = event.key.toLowerCase();
  const code = event.code;
  if (code === 'KeyZ' || key === 'z') {
    event.preventDefault();
    if (event.shiftKey) redoPaletteEdit();
    else undoPaletteEdit();
  } else if (code === 'KeyY' || key === 'y') {
    event.preventDefault();
    redoPaletteEdit();
  }
});
canvas.addEventListener('pointerdown', handleCanvasPick, { capture: true });
canvas.addEventListener('pointerup', handlePickEnd, { capture: true });
canvas.addEventListener('pointercancel', handlePickCancel, { capture: true });
canvas.addEventListener('lostpointercapture', handlePickCancel);
frame.addEventListener('pointermove', updatePickFeedback);
frame.addEventListener('pointerleave', () => {
  if (pickPointerId === null) {
    hidePickPreview();
    hidePickLoupe();
  }
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && markerDrag) {
    event.preventDefault();
    pickedMarkersView?.cancelDrag();
    return;
  }
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
paletteHex?.addEventListener('input', () => {
  pendingPickPoint = null;
});

const scheduleProcess = debounce(processPreview, 150);
const syncUrlStateDebounced = debounce(syncUrlState, 150);
const scheduleSessionSave = debounce(saveCurrentSession, 500);

populateBuiltinPalettes();
updateDitherLabels();
updateDitherControls();
updatePaletteEditor();

async function initializeSessionAndUrl() {
  const restoreGuard = loadRequestId;
  const hashState = decodeUrlState(location.hash);
  let record = null;
  try {
    record = await loadSession();
  } catch (error) {
    if (loadRequestId !== restoreGuard) return;
    sessionPersistence = false;
    toastKey(
      'toast.sessionUnavailable',
      { detail: localizeError(error) },
      'error',
    );
  }
  // Dropping an image while the session is being read is a newer user action.
  // Do not apply saved settings or start a restore that would replace it.
  if (loadRequestId !== restoreGuard) return;
  if (!record) {
    applyUrlState(hashState);
    return;
  }
  if (!isValidSessionRecord(record)) {
    clearSession().catch((error) => {
      toastKey(
        'toast.sessionResetFailed',
        { detail: localizeError(error) },
        'error',
      );
    });
    applyUrlState(hashState);
    return;
  }

  const sessionSettings = record.state.settings;
  const hashMatches =
    !location.hash || encodeUrlState(hashState) === encodeUrlState(sessionSettings);
  applyUrlState(hashMatches ? sessionSettings : hashState);
  restoringSession = true;
  let bytes = null;
  if (record.version === SESSION_VERSION) {
    bytes = record.image.bytes;
  } else if (record.image.blob instanceof Blob) {
    try {
      bytes = await record.image.blob.arrayBuffer();
    } catch {
      bytes = null;
    }
  }
  if (!(bytes instanceof ArrayBuffer) || bytes.byteLength === 0) {
    restoringSession = false;
    sessionPersistence = false;
    clearSession().catch((error) => {
      toastKey('toast.sessionResetFailed', { detail: localizeError(error) }, 'error');
    });
    toastKey('toast.sessionRestoreFailed', {}, 'error');
    setStatusMessage('status.sessionRestoreFailed');
    return;
  }
  const file = new File([bytes], record.image.name, {
    type: record.image.type || 'application/octet-stream',
  });
  await loadFile(file, hashMatches ? record.state : null);
}

initializeSessionAndUrl();
sessionClear?.addEventListener('click', forgetSavedSession);
window.addEventListener('hashchange', () => {
  if (applyingUrlState) return;
  applyUrlState(decodeUrlState(location.hash));
});

modeExtract?.addEventListener('click', () => setMode('extract'));
modeMap?.addEventListener('click', () => setMode('map'));

paletteSelect?.addEventListener('change', () => {
  if (!loadTargetPalette(paletteSelect.value)) return;
  if (mode === 'map' && app.preview) processPreview();
  syncUrlState();
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
      setCustomPaletteOption('imported', importedName, importedColors.length);
      paletteSelect.value = 'imported';
    }

    loadTargetPalette('imported');
    setMode('map');
    toastKey(
      'toast.paletteLoaded',
      {
        name: importedName,
        countLabel: countLabel('count.colors', importedColors.length),
      },
      'success',
    );
  } catch (error) {
    toast(localizeError(error), 'error');
  }
});

ditherMethod?.addEventListener('change', () => {
  updateDitherControls();
  scheduleProcess();
  syncUrlState();
});
ditherStrength?.addEventListener('input', () => {
  updateDitherLabels();
  scheduleProcess();
  syncUrlStateDebounced();
});
ditherSerpentine?.addEventListener('change', () => {
  scheduleProcess();
  syncUrlState();
});
edgeStop?.addEventListener('input', () => {
  updateDitherLabels();
  scheduleProcess();
  syncUrlStateDebounced();
});
alphaThreshold?.addEventListener('input', () => {
  updateDitherLabels();
  scheduleProcess();
  syncUrlStateDebounced();
});
transparentIndex?.addEventListener('change', () => {
  renderPickedMarkers();
  scheduleProcess();
  syncUrlState();
});

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
document.getElementById('export-strip')?.addEventListener('click', exportController.exportStrip);
document.getElementById('export-reduced')?.addEventListener('click', exportController.exportReduced);
document.getElementById('export-indexed')?.addEventListener('click', exportController.exportIndexed);
document.getElementById('export-palette')?.addEventListener('click', exportController.exportPaletteFile);
document.getElementById('copy-hex')?.addEventListener('click', exportController.copyHex);

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

window.addEventListener('peiqq:localechange', refreshDynamicUi);
