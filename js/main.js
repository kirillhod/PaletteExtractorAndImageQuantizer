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
  createPalette,
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
import { debounce } from './ui/dom.js';
import { createExportController } from './ui/export-controller.js';
import { createQualityPanel } from './ui/quality-panel.js';
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
} from './ui/i18n.js';
import { initLearn } from './ui/learn-view.js';
import { createPaletteEditor } from './ui/palette-editor.js';
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
const sortSelect = /** @type {HTMLSelectElement|null} */ (document.getElementById('palette-sort'));
const sessionClear = /** @type {HTMLButtonElement|null} */ (document.getElementById('session-clear'));
const sessionStatus = document.getElementById('session-status');
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
/** @type {ReturnType<typeof createPickedMarkers>|null} */
let pickedMarkersView = null;
const paletteState = {
  editMode: false,
  /** @type {number|null} */
  selectedId: null,
  history: { past: [], future: [], limit: 50 },
  /** @type {{u:number,v:number}|null} */
  pendingPoint: null,
  statusName: '',
  statusCount: 0,
  /** @type {{ kind:'imported'|'restored', name:string, count:number }|null} */
  customOption: null,
  /** @type {number|null} */
  pendingTransparentIndex: null,
  pendingTransparentRemap: false,
};
const pickState = {
  active: false,
  /** @type {number|null} */
  pointerId: null,
  /** @type {Map<number, {u:number,v:number}>} */
  markers: new Map(),
  /** @type {{ id:number, before: any, moved:boolean }|null} */
  drag: null,
};
let applyingUrlState = false;
/** @type {File|Blob|null} */
let lastFile = null;
let loadRequestId = 0;
let restoringSession = false;
let sessionPersistence = true;
let sessionSaveWarned = false;
let sessionStatusKey = '';
/** @type {{ r:number,g:number,b:number,a:number }[]} */
let fixedColors = [];
let fixedName = '';
/** @type {{ r:number,g:number,b:number,a:number }[]} */
let importedColors = [];
let importedName = '';

/** @param {string} order */
function setSortOrder(order) {
  sortOrder = order || 'source';
  if (sortSelect) sortSelect.value = sortOrder;
}

const paletteEditor = createPaletteEditor({
  app,
  state: paletteState,
  pickState,
  getSortOrder: () => sortOrder,
  setSortOrder,
  getLastFile: () => lastFile,
  onPaletteEdited: () => {
    if (mode === 'map') fixedColors = app.palette.map((entry) => ({ ...entry.color }));
  },
  requestPreview: () => processPreview(),
  scheduleSessionSave: () => scheduleSessionSave(),
  syncUrlState: () => syncUrlState(),
  clearDownloadLinks,
  renderPickedMarkers: () => renderPickedMarkers(),
  stopPickMode: () => stopPickMode(),
  startPickMode: () => startPickMode(),
  cancelMarkerDrag: () => pickedMarkersView?.cancelDrag(),
});

const qualityPanel = createQualityPanel({
  getWorker: () => worker,
  nextRequestId: () => nextRequestId++,
  getApp: () => app,
});

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
    paletteEditor.updatePaletteEditor();
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
    paletteEditor.renderCurrentPalette();
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
    if (paletteState.pendingTransparentRemap) {
      paletteState.pendingTransparentRemap = false;
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
    qualityPanel.handleMessage(message);
    return;
  }

  if (message.type === 'error') {
    if (
      message.requestId !== app.previewRequestId &&
      message.requestId !== app.exportRequestId &&
      !qualityPanel.matches(message.requestId)
    ) {
      return;
    }
    toast(localizeError(message.message || t('toast.processingFailed')), 'error');
    setStatusMessage('status.error');
    if (canvasEmpty) canvasEmpty.hidden = true;
    if (message.requestId === app.exportRequestId) {
      exportController.finishExport();
    } else if (qualityPanel.matches(message.requestId)) {
      qualityPanel.fail();
    } else {
      if (restoringSession) restoringSession = false;
      updateExportState();
    }
  }
}

function updateExportState() {
  setExportEnabled(app.hasResult && app.palette.length > 0 && !app.exportBusy);
  paletteEditor.updatePaletteEditor();
  qualityPanel.updateAvailability();
}

function startPickMode() {
  if (!paletteState.editMode || !app.hasResult || app.exportBusy) return;
  pickState.active = true;
  paletteEditor.setPickPressed(true);
  frame.classList.add('is-picking');
  paletteEditor.refreshHint();
  hidePickPreview();
  hidePickLoupe();
  paletteEditor.updatePaletteEditor();
}

function stopPickMode() {
  if (!pickState.active) return;
  pickState.active = false;
  paletteEditor.setPickPressed(false);
  frame.classList.remove('is-picking');
  if (pickState.pointerId !== null) {
    if (canvas.hasPointerCapture(pickState.pointerId)) {
      canvas.releasePointerCapture(pickState.pointerId);
    }
    pickState.pointerId = null;
  }
  hidePickPreview();
  hidePickLoupe();
  paletteEditor.refreshHint();
  paletteEditor.updatePaletteEditor();
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
  if (!pickState.active) return;
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
  if (!pickState.active) return;
  if (pickState.pointerId !== null) {
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
  for (const id of pickState.markers.keys()) {
    if (!ids.has(id)) pickState.markers.delete(id);
  }
  const transparent = paletteEditor.currentTransparentId();
  if (transparent !== null) pickState.markers.delete(transparent);
  if (pickState.pendingPoint && app.palette.length === 0) pickState.pendingPoint = null;
}

function renderPickedMarkers() {
  if (!pickedMarkersView) return;
  prunePickedMarkers();
  pickedMarkersView.render({
    entries: app.palette,
    markers: pickState.markers,
    selectedId: paletteState.selectedId,
    active: paletteState.editMode && app.hasResult && !app.exportBusy,
  });
}

/** @param {number} id */
function selectPickedMarker(id) {
  const entry = app.palette.find((candidate) => candidate.id === id);
  if (!entry) return;
  paletteState.selectedId = id;
  pickState.pendingPoint = null;
  paletteEditor.setHexInput(entry.hex);
  paletteEditor.renderCurrentPalette();
}

/**
 * @param {number} id
 * @param {PointerEvent} event
 */
function startPickedMarkerDrag(id, event) {
  if (!paletteState.editMode || app.exportBusy) return;
  const entry = app.palette.find((candidate) => candidate.id === id);
  if (!entry) return;
  pickState.drag = { id, before: paletteEditor.paletteSnapshot(), moved: false };
  pickState.pendingPoint = null;
  hidePickPreview();
  updatePickLoupe(event);
}

/**
 * @param {number} id
 * @param {PointerEvent} event
 */
function movePickedMarkerDrag(id, event) {
  if (!pickState.drag || pickState.drag.id !== id) return;
  const sample = canvasView.pickSample(event.clientX, event.clientY);
  if (!sample || sample.color.a === 0) {
    hidePickLoupe();
    return;
  }
  pickState.drag.moved = true;
  pickState.markers.set(id, normalizePickPoint(sample));
  paletteEditor.setPaletteEntryColorLive(id, sample.color);
  updatePickLoupe(event);
  scheduleProcess();
}

/**
 * @param {number} id
 * @param {PointerEvent} event
 * @param {boolean} moved
 */
function endPickedMarkerDrag(id, event, moved) {
  if (!pickState.drag || pickState.drag.id !== id) return;
  const transaction = pickState.drag;
  pickState.drag = null;
  hidePickLoupe();
  if (!moved) {
    paletteEditor.renderCurrentPalette();
    return;
  }
  const sample = canvasView.pickSample(event.clientX, event.clientY);
  if (!sample || sample.color.a === 0) {
    paletteEditor.restorePaletteSnapshot(transaction.before);
    toastKey(
      sample ? 'toast.pickTransparent' : 'toast.pickOutside',
      {},
      'error',
    );
    return;
  }
  if (hasDuplicatePaletteColor(id, sample.color)) {
    paletteEditor.restorePaletteSnapshot(transaction.before);
    toastKey('error.duplicateColor', {}, 'error');
    return;
  }
  pickState.markers.set(id, normalizePickPoint(sample));
  paletteEditor.setPaletteEntryColorLive(id, sample.color);
  paletteEditor.renderCurrentPalette();
  processPreview();
  paletteEditor.pushPaletteHistory(transaction.before);
  toastKey('toast.colorUpdated', {}, 'success');
}

/** @param {number} id */
function cancelPickedMarkerDrag(id) {
  if (!pickState.drag || pickState.drag.id !== id) return;
  const transaction = pickState.drag;
  pickState.drag = null;
  hidePickLoupe();
  paletteEditor.restorePaletteSnapshot(transaction.before);
}

/**
 * @param {number} id
 * @param {string} key
 * @param {number} step
 */
function nudgePickedMarker(id, key, step) {
  if (!paletteState.editMode || app.exportBusy) return;
  const point = pickState.markers.get(id);
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
  const before = paletteEditor.paletteSnapshot();
  try {
    app.palette = updatePaletteEntry(app.palette, id, formatHex(color));
    pickState.markers.set(id, nextPoint);
    paletteState.selectedId = id;
    paletteEditor.setHexInput(formatHex(color));
    paletteEditor.markPaletteEdited();
    paletteEditor.renderCurrentPalette();
    processPreview();
    paletteEditor.pushPaletteHistory(before);
  } catch (error) {
    toast(localizeError(error), 'error');
  }
}

function handleCanvasPick(event) {
  if (!pickState.active || pickState.pointerId !== null) return;
  if (event.pointerType === 'mouse' && event.button !== 0) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  pickState.pointerId = event.pointerId;
  canvas.setPointerCapture(event.pointerId);
  updatePickFeedback(event);
}

/** @param {PointerEvent} event */
function handlePickEnd(event) {
  if (!pickState.active || pickState.pointerId !== event.pointerId) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  pickState.pointerId = null;
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
  paletteEditor.setHexInput(formatHex(color));
  if (paletteEditor.selectedPaletteEntry()) {
    paletteEditor.applyPaletteHex(normalizePickPoint(sample));
  } else {
    pickState.pendingPoint = normalizePickPoint(sample);
    toastKey('toast.picked', { hex: formatHex(color) }, 'success');
  }
}

/** @param {PointerEvent} event */
function handlePickCancel(event) {
  if (pickState.pointerId !== event.pointerId) return;
  pickState.pointerId = null;
  hidePickPreview();
  hidePickLoupe();
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
    paletteState.pendingTransparentIndex =
      state.mode === 'map' || state.transparentIndex >= 0 ? state.transparentIndex : null;
    paletteEditor.renderCurrentPalette();
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
      selectedId: paletteState.selectedId,
      transparentId: paletteEditor.currentTransparentId(),
      markers: pickedMarkersToArray(pickState.markers),
      editing: paletteState.editMode,
      history: cloneHistory(paletteState.history),
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
  paletteEditor.resetPaletteEdits();
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
  paletteEditor.renderCurrentPalette();
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
  paletteEditor.resetPaletteEdits();
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
  paletteEditor.setPaletteStatus(name, colors.length);
  if (paletteSelect) paletteSelect.value = value;
  app.palette = sortPalette(createPalette(colors), sortOrder);
  paletteEditor.renderCurrentPalette();
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
    paletteEditor.setPaletteStatus(first.name, first.colors.length);
  }
}

function processPreview() {
  if (!app.preview) return;
  qualityPanel.reset({ disable: true });
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
    paletteEditor.resetPaletteEdits();
    if (restore) {
      app.palette = clonePalette(Array.isArray(restore.palette) ? restore.palette : []);
      app.paletteEdited = Boolean(restore.paletteEdited) || mode === 'map';
      sortOrder = restore.sortOrder || 'source';
      if (sortSelect) sortSelect.value = sortOrder;
      const history = cloneHistory(restore.history ?? { past: [], future: [] });
      paletteState.history.past = history.past;
      paletteState.history.future = history.future;
      paletteState.selectedId = restore.selectedId ?? null;
      paletteState.editMode = Boolean(restore.editing);
      pickState.markers = pickedMarkersFromArray(restore.markers);
      pickState.pendingPoint = null;
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
          paletteEditor.setCustomPaletteOption(
            'restored',
            restore.paletteName || t('palette.restoredSession'),
            app.palette.length,
          );
        }
      }
      paletteEditor.setPaletteStatus(
        restore.paletteName || t('palette.restoredSession'),
        app.palette.length,
      );
    }
    lastFile = file;
    clearDownloadLinks();

    if (hero) hero.hidden = true;
    if (workspace) workspace.hidden = false;
    canvasView.setOriginal(preview);
    paletteEditor.renderCurrentPalette();
    if (restore && restore.transparentId !== null && restore.transparentId !== undefined) {
      const position = app.palette.findIndex((entry) => entry.id === restore.transparentId);
      if (transparentIndex) {
        transparentIndex.value = position >= 0 ? String(position) : '-1';
      }
      paletteState.pendingTransparentIndex = null;
    } else if (restore) {
      if (transparentIndex) transparentIndex.value = '-1';
      paletteState.pendingTransparentIndex = null;
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
  paletteEditor.renderCurrentPalette();
  paletteEditor.updatePaletteEditor();
  paletteEditor.renderPaletteStatus();
  paletteEditor.renderCustomPaletteOption();
  renderSessionStatus();
  renderOriginalLabels();
  if (canvasEmpty) canvasEmpty.textContent = t('canvas.processing');
  paletteEditor.refreshHint();
  const progressKey = exportController.getProgressKey();
  if (progressKey) {
    const label = document.getElementById('export-progress-label');
    if (label) label.textContent = t(progressKey);
  }
  qualityPanel.refreshLabels();
}

const controls = initControls({
  onChange: () => {
    if (mode === 'extract') paletteEditor.resetPaletteEdits();
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
  onToggleErrorMap: qualityPanel.toggleMap,
});

document.getElementById('zoom-out')?.addEventListener('click', () => canvasView.zoomOut());
document.getElementById('fit-view')?.addEventListener('click', () => canvasView.fit());
document.getElementById('zoom-100')?.addEventListener('click', () => canvasView.zoom100());
document.getElementById('zoom-in')?.addEventListener('click', () => canvasView.zoomIn());
paletteEditor.bindEvents();
canvas.addEventListener('pointerdown', handleCanvasPick, { capture: true });
canvas.addEventListener('pointerup', handlePickEnd, { capture: true });
canvas.addEventListener('pointercancel', handlePickCancel, { capture: true });
canvas.addEventListener('lostpointercapture', handlePickCancel);
frame.addEventListener('pointermove', updatePickFeedback);
frame.addEventListener('pointerleave', () => {
  if (pickState.pointerId === null) {
    hidePickPreview();
    hidePickLoupe();
  }
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && pickState.drag) {
    event.preventDefault();
    pickedMarkersView?.cancelDrag();
    return;
  }
  if (event.key === 'Escape' && pickState.active) {
    event.preventDefault();
    stopPickMode();
  }
});

const scheduleProcess = debounce(processPreview, 150);
const syncUrlStateDebounced = debounce(syncUrlState, 150);
const scheduleSessionSave = debounce(saveCurrentSession, 500);

populateBuiltinPalettes();
updateDitherLabels();
updateDitherControls();
paletteEditor.updatePaletteEditor();

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
      paletteEditor.setCustomPaletteOption('imported', importedName, importedColors.length);
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
