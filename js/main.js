// @ts-check
import { parseHex } from './core/color.js';
import { cloneHistory, clonePalette } from './core/session-state.js';
import {
  createPalette,
  isDirectionalSort,
  sortDirection,
  sortFamily,
  sortOrderFor,
  sortPalette,
} from './core/palette.js';
import { pickedMarkersFromArray } from './core/picked-markers.js';
import { previewSize } from './core/preview-size.js';
import { APP_VERSION } from './core/version.js';
import { BUILTIN_PALETTES } from './core/palettes/builtin.js';
import { parsePaletteFile } from './core/palettes/import.js';
import { debounce } from './ui/dom.js';
import { createExportController } from './ui/export-controller.js';
import { createQualityPanel } from './ui/quality-panel.js';
import { createCanvasView } from './ui/canvas-view.js';
import { createPalettePicker } from './ui/palette-picker.js';
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
import { createPalettePreview } from './ui/palette-preview.js';
import { initRail } from './ui/rail.js';
import { createSessionUrl } from './ui/session-url.js';
import { initShortcuts } from './ui/shortcuts.js';
import { refreshStatus, setStatus, setStatusMessage, toast, toastKey, getLastStatus } from './ui/status.js';
import { initTheme } from './ui/theme.js';
import { initTooltips } from './ui/tooltips.js';
import { clearSession } from './ui/session-store.js';

const MAX_PIXELS = 16_777_216;

const versionLabel = document.getElementById('app-version');
const helpVersionLabel = document.getElementById('help-version');
if (versionLabel) versionLabel.textContent = `· v${APP_VERSION}`;
if (helpVersionLabel) helpVersionLabel.textContent = `v${APP_VERSION}`;

const hero = document.getElementById('hero');
const workspace = document.getElementById('workspace');
const frame = /** @type {HTMLElement} */ (document.getElementById('canvas-frame'));
const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('view-canvas'));
const divider = /** @type {HTMLElement} */ (document.getElementById('divider'));
const sortSelect = /** @type {HTMLSelectElement|null} */ (document.getElementById('palette-sort'));
const sortDirectionButton = /** @type {HTMLButtonElement|null} */ (
  document.getElementById('palette-sort-direction')
);
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
  onRender: () => palettePicker?.renderMarkers(),
});
const theme = initTheme();
const rail = initRail();
const learn = initLearn();

const app = {
  name: 'image',
  width: 0,
  height: 0,
  /** @type {ImageData|null} */
  preview: null,
  /** @type {{ data: Uint8ClampedArray, width:number, height:number }|null} */
  reduced: null,
  /** @type {ImageBitmap|null} */
  originalBitmap: null,
  /** @type {any[]} */
  palette: [],
  paletteEdited: false,
  hasResult: false,
  previewRequestId: 0,
  previewBusy: false,
  exportRequestId: 0,
  exportBusy: false,
};

const palettePreview = createPalettePreview({
  getPalette: () => app.palette,
});

let nextRequestId = 1;
let worker = createWorker();
let sortOrder = 'source';
/** @type {'asc'|'desc'} */
let sortDirectionState = 'asc';
/** @type {'extract'|'map'} */
let mode = 'extract';
/** @type {ReturnType<typeof createPalettePicker>|null} */
let palettePicker = null;
/** @type {ReturnType<typeof createSessionUrl>|null} */
let sessionUrl = null;
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
/** Settings and palette as they were before the current settings gesture. */
let settingsBaseline = null;
let settingsPushed = false;
/** @type {File|Blob|null} */
let lastFile = null;
let loadRequestId = 0;
const sessionState = {
  applyingUrlState: false,
  restoringSession: false,
  persistence: true,
  saveWarned: false,
  statusKey: '',
};
/** @type {{ r:number,g:number,b:number,a:number }[]} */
let fixedColors = [];
let fixedName = '';
/** @type {{ r:number,g:number,b:number,a:number }[]} */
let importedColors = [];
let importedName = '';

/**
 * The select shows one row per family; the adjacent button flips its direction.
 * `sortOrder` stays a full key so URLs, sessions, and export order keep working.
 * @param {boolean} [hasPalette]
 */
function renderSortControls(hasPalette = app.palette.length > 0) {
  const family = sortFamily(sortOrder);
  const direction = sortDirection(sortOrder);
  if (sortSelect) {
    sortSelect.value = family;
    sortSelect.disabled = !hasPalette;
  }
  if (!sortDirectionButton) return;
  const directional = isDirectionalSort(family);
  sortDirectionButton.disabled = !hasPalette || !directional;
  sortDirectionButton.dataset.direction = direction ?? 'asc';
  const labelKey = directional
    ? direction === 'desc'
      ? 'palette.sort.directionDesc'
      : 'palette.sort.directionAsc'
    : 'palette.sort.directionFixed';
  const label = t(labelKey);
  sortDirectionButton.setAttribute('aria-label', label);
  sortDirectionButton.setAttribute('title', label);
}

/** @param {string} order */
function setSortOrder(order) {
  const family = sortFamily(order || 'source');
  const normalized = sortOrderFor(
    family,
    sortDirection(order) ?? sortDirectionState,
  );
  sortOrder = normalized;
  const direction = sortDirection(normalized);
  if (direction) sortDirectionState = direction;
  renderSortControls();
}

const paletteEditor = createPaletteEditor({
  app,
  state: paletteState,
  pickState,
  getSortOrder: () => sortOrder,
  setSortOrder,
  renderSortControls,
  refreshPalettePreview: () => palettePreview.refresh(),
  getLastFile: () => lastFile,
  getSettings: () => readSettings(),
  applySettings: (settings) => applySettingsSnapshot(settings),
  onPaletteEdited: () => {
    settingsBaseline = null;
    if (mode === 'map') fixedColors = app.palette.map((entry) => ({ ...entry.color }));
  },
  requestPreview: () => processPreview(),
  scheduleSessionSave: () => scheduleSessionSave(),
  syncUrlState: () => sessionUrl?.syncUrlState(),
  clearDownloadLinks,
  renderPickedMarkers: () => palettePicker?.renderMarkers(),
  stopPickMode: () => palettePicker?.stop(),
  startPickMode: () => palettePicker?.start(),
  cancelMarkerDrag: () => palettePicker?.cancelDrag(),
});

palettePicker = createPalettePicker({
  app,
  state: paletteState,
  pickState,
  canvasView,
  paletteEditor,
  host: document.getElementById('picked-markers'),
  requestPreview: () => processPreview(),
  scheduleProcess: () => scheduleProcess(),
});

sessionUrl = createSessionUrl({
  app,
  session: sessionState,
  paletteState,
  pickState,
  paletteEditor,
  getMode: () => mode,
  getSortOrder: () => sortOrder,
  setSortOrder,
  getLastFile: () => lastFile,
  setLastFile: (file) => {
    lastFile = file;
  },
  getLoadRequestId: () => loadRequestId,
  getFixedName: () => fixedName,
  getImportedName: () => importedName,
  getPaletteName: () => paletteEditor.getPaletteName(),
  getControlsParams: () => controls.getParams(),
  setMode: (next) => setMode(next),
  loadFile: (file, restore) => loadFile(file, restore),
  updateDitherLabels: () => updateDitherLabels(),
  updateDitherControls: () => updateDitherControls(),
  scheduleSessionSave: () => scheduleSessionSave(),
});

const qualityPanel = createQualityPanel({
  getWorker: () => worker,
  nextRequestId: () => nextRequestId++,
  getApp: () => app,
  getCanvasView: () => canvasView,
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
    palettePicker?.cancelDrag();
    palettePicker?.stop();
    paletteEditor.updatePaletteEditor();
  },
});

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
    if (message.requestId === app.previewRequestId && !app.hasResult) {
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
    app.previewBusy = false;
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
    // Map mode never extracts, so an "extract 0 ms" item would suggest otherwise.
    const statusItems = [
      ...sourceStatusItems(),
      { value: formatN(message.uniqueColors, 0), labelKey: 'status.unique' },
      { value: app.palette.length, labelKey: 'unit.colors', count: app.palette.length },
    ];
    if (mode === 'extract') {
      statusItems.push({
        valueKey: 'status.ms',
        params: { value: formatN(message.timings.extractMs, 0) },
        labelKey: 'status.extract',
      });
    }
    statusItems.push({
      valueKey: 'status.ms',
      params: { value: formatN(message.timings.mapMs, 0) },
      labelKey: 'status.map',
    });
    setStatus(statusItems);
    if (app.palette.length === 0) {
      // An indexed PNG needs at least one PLTE entry, so a fully transparent image has
      // nothing to export. Say why instead of leaving the disabled buttons unexplained.
      toastKey('toast.fullyTransparent', {}, 'error');
      setStatus([
        { valueKey: 'status.warning', labelKey: 'status.fullyTransparent' },
        ...sourceStatusItems(),
      ]);
    }
    if (paletteState.pendingTransparentRemap) {
      paletteState.pendingTransparentRemap = false;
      processPreview();
      return;
    }
    if (sessionState.restoringSession) {
      sessionState.restoringSession = false;
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
      app.previewBusy = false;
      if (sessionState.restoringSession) sessionState.restoringSession = false;
      updateExportState();
    }
  }
}

function updateExportState() {
  setExportEnabled(app.hasResult && app.palette.length > 0 && !app.exportBusy);
  paletteEditor.updatePaletteEditor();
  qualityPanel.updateAvailability();
}

function readDitherSettings() {
  return {
    method: ditherMethod?.value || 'none',
    strength: Number(ditherStrength?.value ?? 80) / 100,
    serpentine: ditherSerpentine?.checked ?? true,
    edgeStop: Number(edgeStop?.value ?? 50) / 100,
  };
}

/** Everything an undo step must restore besides the palette itself. */
function readSettings() {
  return {
    ...controls.getParams(),
    dither: readDitherSettings(),
    alphaThreshold: Number(alphaThreshold?.value ?? 128),
  };
}

/** @param {any} next @param {any} previous */
function settingsEqual(next, previous) {
  if (!next || !previous) return false;
  const nextDither = next.dither ?? {};
  const previousDither = previous.dither ?? {};
  return (
    next.method === previous.method &&
    next.colors === previous.colors &&
    next.space === previous.space &&
    next.alphaThreshold === previous.alphaThreshold &&
    nextDither.method === previousDither.method &&
    nextDither.strength === previousDither.strength &&
    nextDither.serpentine === previousDither.serpentine &&
    nextDither.edgeStop === previousDither.edgeStop
  );
}

/**
 * Restore controls from a history snapshot. Assigning values does not emit input
 * or change events, so no new history step is recorded.
 * @param {any} settings
 */
function applySettingsSnapshot(settings) {
  if (!settings || typeof settings !== 'object') return;
  settingsBaseline = null;
  settingsPushed = false;
  controls.setParams(settings);
  const dither = settings.dither ?? {};
  if (ditherMethod && typeof dither.method === 'string') ditherMethod.value = dither.method;
  if (ditherStrength && Number.isFinite(Number(dither.strength))) {
    ditherStrength.value = String(Math.round(Number(dither.strength) * 100));
  }
  if (ditherSerpentine && typeof dither.serpentine === 'boolean') {
    ditherSerpentine.checked = dither.serpentine;
  }
  if (edgeStop && Number.isFinite(Number(dither.edgeStop))) {
    edgeStop.value = String(Math.round(Number(dither.edgeStop) * 100));
  }
  if (alphaThreshold && Number.isFinite(Number(settings.alphaThreshold))) {
    alphaThreshold.value = String(Math.round(Number(settings.alphaThreshold)));
  }
  updateDitherLabels();
  updateDitherControls();
}

/** The state just before a settings gesture, including the current palette edits. */
function captureSettingsBaseline() {
  if (!app.hasResult || app.exportBusy) return;
  settingsBaseline = paletteEditor.paletteSnapshot();
  settingsPushed = false;
}

function commitSettingsHistory() {
  if (!settingsBaseline || settingsPushed || !app.hasResult) return;
  const current = paletteEditor.paletteSnapshot();
  if (
    settingsEqual(settingsBaseline.settings, current.settings) &&
    settingsBaseline.transparentId === current.transparentId
  ) {
    return;
  }
  paletteEditor.pushPaletteHistory(settingsBaseline);
  settingsPushed = true;
}

function getParams() {
  const base = controls.getParams();
  return {
    mode,
    ...base,
    palette: mode === 'map' ? fixedColors : undefined,
    dither: readDitherSettings(),
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

function setMode(next) {
  if (next !== 'extract' && next !== 'map') return;
  paletteEditor.resetPaletteEdits();
  settingsBaseline = null;
  settingsPushed = false;
  mode = next;
  modeExtract?.setAttribute('aria-selected', String(next === 'extract'));
  modeMap?.setAttribute('aria-selected', String(next === 'map'));
  if (extractControls) extractControls.hidden = next !== 'extract';
  if (mapControls) mapControls.hidden = next !== 'map';

  if (next === 'map') {
    // The select is the source of truth for the target palette, so a hash or a
    // restored session that lands in Map mode shows the palette it names, not the
    // built-in that happened to be selected at startup.
    if (!loadTargetPalette(paletteSelect?.value || 'pico-8') && fixedColors.length > 0) {
      app.palette = sortPalette(createPalette(fixedColors), sortOrder);
    }
  } else {
    app.palette = [];
  }
  paletteEditor.renderCurrentPalette();
  if (app.preview) processPreview();
  sessionUrl?.syncUrlState();
}

/**
 * @param {string} value
 * @returns {boolean}
 */
function loadTargetPalette(value) {
  paletteEditor.resetPaletteEdits();
  settingsBaseline = null;
  settingsPushed = false;
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
  app.previewBusy = true;
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

  if (!app.hasResult) {
    setExportEnabled(false);
    if (canvasEmpty) canvasEmpty.hidden = false;
    setStatusMessage('status.processingPreview');
  }
}

/**
 * @param {File} file
 * @param {any} [restore]
 */
async function loadFile(file, restore = null) {
  const requestId = ++loadRequestId;
  try {
    if (!restore) sessionState.persistence = true;
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

      const target = previewSize(width, height);
      // A full-resolution preview copies the source pixels exactly; a downscaled one is
      // smoothed so the mapping does not alias.
      preview = drawToImageData(bitmap, target.width, target.height, target.scaled);
    } catch (error) {
      bitmap.close?.();
      throw error;
    }
    // The original half of the canvas draws this decode at full resolution, so it stays
    // open for the whole session. Export still re-decodes the file for a fresh copy.
    app.originalBitmap?.close?.();
    app.originalBitmap = bitmap;

    app.name = file.name || 'image';
    app.width = width;
    app.height = height;
    app.preview = preview;
    app.reduced = null;
    app.palette = [];
    app.hasResult = false;
    paletteEditor.resetPaletteEdits();
    settingsBaseline = null;
    settingsPushed = false;
    if (restore) {
      app.palette = clonePalette(Array.isArray(restore.palette) ? restore.palette : []);
      app.paletteEdited = Boolean(restore.paletteEdited) || mode === 'map';
      setSortOrder(restore.sortOrder || 'source');
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
      // Restore the palette identity together with the colors. Otherwise the next
      // session save would name the restored palette after the built-in selected at
      // startup, and switching back to "Imported" would have no colors to reload.
      if (restore.paletteValue === 'imported') {
        importedColors = app.palette.map((entry) => ({ ...entry.color }));
        importedName = restore.paletteName || t('palette.restoredSession');
        fixedName = importedName;
      } else if (restore.paletteValue) {
        const builtin = BUILTIN_PALETTES.find(
          (palette) => palette.id === restore.paletteValue,
        );
        if (builtin) fixedName = builtin.name;
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
    rail.setAvailable(true);
    canvasView.setOriginal({ width, height, bitmap });
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
      sessionState.restoringSession = false;
      sessionState.persistence = false;
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

/**
 * The source line always names the full image; the preview size is added only when the
 * mapping pass runs on a smaller copy, because that is the resolution the export does not
 * share.
 * @returns {{ value: string, labelKey: string }[]}
 */
function sourceStatusItems() {
  const items = [{ value: `${app.width}×${app.height}`, labelKey: 'status.source' }];
  if (
    app.preview &&
    (app.preview.width !== app.width || app.preview.height !== app.height)
  ) {
    items.push({
      value: `${app.preview.width}×${app.preview.height}`,
      labelKey: 'status.preview',
    });
  }
  return items;
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
  sessionUrl?.renderStatus();
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
    commitSettingsHistory();
    processPreview();
    sessionUrl?.syncUrlState();
  },
});

// Extractor settings replace the color set, so manual edits and their markers no
// longer describe it. History keeps the prior state and undo restores it.
for (const id of ['method', 'space']) {
  document
    .getElementById(id)
    ?.addEventListener('change', () => paletteEditor.clearEditsForExtraction());
}
for (const id of ['colors', 'colors-number']) {
  document
    .getElementById(id)
    ?.addEventListener('input', () => paletteEditor.clearEditsForExtraction());
}

// One history step per gesture: capture the pre-change state on interaction start,
// then commit it once the debounced control handler reports a real change.
for (const id of [
  'method',
  'colors',
  'colors-number',
  'space',
  'dither-method',
  'dither-strength',
  'dither-serpentine',
  'edge-stop',
  'alpha-threshold',
  'transparent-index',
]) {
  const control = document.getElementById(id);
  if (!control) continue;
  control.addEventListener('pointerdown', captureSettingsBaseline);
  if (id === 'colors-number') control.addEventListener('focusin', captureSettingsBaseline);
  else control.addEventListener('keydown', captureSettingsBaseline);
}
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
palettePicker?.bindEvents();

sortDirectionButton?.addEventListener('click', () => {
  const direction = sortDirection(sortOrder);
  if (!direction) return;
  // The flip is one deliberate change, same as picking a family: record a step so
  // Ctrl+Z returns to the previous arrangement and direction.
  const before = paletteEditor.paletteSnapshot();
  setSortOrder(
    sortOrderFor(sortFamily(sortOrder), direction === 'asc' ? 'desc' : 'asc'),
  );
  if (before.sortOrder !== sortOrder) paletteEditor.pushPaletteHistory(before);
  paletteEditor.renderCurrentPalette();
  clearDownloadLinks();
  sessionUrl?.syncUrlState();
});

const scheduleProcess = debounce(processPreview, 150);
const syncUrlStateDebounced = debounce(() => sessionUrl?.syncUrlState(), 150);
const scheduleSessionSave = debounce(
  () => sessionUrl?.saveCurrentSession(),
  500,
);

populateBuiltinPalettes();
updateDitherLabels();
updateDitherControls();
paletteEditor.updatePaletteEditor();
renderSortControls();

sessionUrl?.bindEvents();

modeExtract?.addEventListener('click', () => setMode('extract'));
modeMap?.addEventListener('click', () => setMode('map'));

paletteSelect?.addEventListener('change', () => {
  if (!loadTargetPalette(paletteSelect.value)) return;
  if (mode === 'map' && app.preview) processPreview();
  sessionUrl?.syncUrlState();
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
  commitSettingsHistory();
  updateDitherControls();
  scheduleProcess();
  sessionUrl?.syncUrlState();
});
ditherStrength?.addEventListener('input', () => {
  commitSettingsHistory();
  updateDitherLabels();
  scheduleProcess();
  syncUrlStateDebounced();
});
ditherSerpentine?.addEventListener('change', () => {
  commitSettingsHistory();
  scheduleProcess();
  sessionUrl?.syncUrlState();
});
edgeStop?.addEventListener('input', () => {
  commitSettingsHistory();
  updateDitherLabels();
  scheduleProcess();
  syncUrlStateDebounced();
});
alphaThreshold?.addEventListener('input', () => {
  commitSettingsHistory();
  updateDitherLabels();
  scheduleProcess();
  syncUrlStateDebounced();
});
transparentIndex?.addEventListener('change', () => {
  commitSettingsHistory();
  palettePicker?.renderMarkers();
  scheduleProcess();
  sessionUrl?.syncUrlState();
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

window.addEventListener('hashchange', () => {
  settingsBaseline = null;
  settingsPushed = false;
});

window.addEventListener('beforeunload', () => {
  worker.terminate();
});

window.addEventListener('peiqq:localechange', refreshDynamicUi);
