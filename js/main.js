// @ts-check
import { parseHex } from './core/color.js';
import { createPalette, paletteHexList, sortPalette } from './core/palette.js';
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

const MAX_PIXELS = 16_777_216;
const PREVIEW_EDGE = 1024;

const hero = document.getElementById('hero');
const workspace = document.getElementById('workspace');
const frame = /** @type {HTMLElement} */ (document.getElementById('canvas-frame'));
const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('view-canvas'));
const divider = /** @type {HTMLElement} */ (document.getElementById('divider'));
const paletteStrip = document.getElementById('palette-strip');
const paletteCount = document.getElementById('palette-count');
const sortSelect = /** @type {HTMLSelectElement|null} */ (document.getElementById('palette-sort'));
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
  hasResult: false,
  previewRequestId: 0,
  exportRequestId: 0,
};

let nextRequestId = 1;
let worker = createWorker();
let sortOrder = 'source';
/** @type {'extract'|'map'} */
let mode = 'extract';
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
    return;
  }

  if (message.type === 'result') {
    if (message.requestId !== app.previewRequestId) return;
    app.palette = message.palette;
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
      updateExportState();
      return;
    }
    showDownloadLinks(files);
    const detail = files[0]?.validation?.detail ?? 'export complete';
    toast('Validated. Click Save to download.', 'success');
    setStatusMessage(`Validated: ${detail} — save link ready`);
    updateExportState();
    return;
  }

  if (message.type === 'error') {
    if (message.requestId !== app.previewRequestId && message.requestId !== app.exportRequestId) {
      return;
    }
    toast(message.message || 'Processing failed', 'error');
    setStatusMessage('Error');
    if (canvasEmpty) canvasEmpty.hidden = true;
    updateExportState();
  }
}

function updateExportState() {
  setExportEnabled(app.hasResult && app.palette.length > 0);
}

function renderCurrentPalette() {
  app.palette = sortPalette(app.palette, sortOrder);
  renderPalette(app.palette, paletteStrip);
  if (paletteCount) paletteCount.textContent = `${app.palette.length} colors`;
  if (sortSelect) sortSelect.disabled = app.palette.length === 0;

  const current = Number(transparentIndex?.value ?? -1);
  const preferred = mode === 'map' && current < 0 ? 0 : current;
  populateTransparentIndex(app.palette, preferred);
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

/**
 * @param {'extract'|'map'} next
 */
function setMode(next) {
  if (next !== 'extract' && next !== 'map') return;
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
      params: getParams(),
    },
    [copy.buffer],
  );

  setExportEnabled(false);
  if (canvasEmpty && !app.hasResult) canvasEmpty.hidden = false;
  setStatusMessage('Processing preview…');
}

async function loadFile(file) {
  try {
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
  if (!app.hasResult || app.palette.length === 0) return;
  const id = nextRequestId++;
  app.exportRequestId = id;
  setExportEnabled(false);
  setStatusMessage('Building and validating the palette strip…');
  clearDownloadLinks();
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
  if (!app.hasResult || !app.full || app.palette.length === 0) return;
  const id = nextRequestId++;
  app.exportRequestId = id;
  setExportEnabled(false);
  setStatusMessage('Encoding the full-resolution PNG…');
  clearDownloadLinks();
  const copy = new Uint8ClampedArray(app.full.data);
  worker.postMessage(
    {
      type: 'export-reduced',
      requestId: id,
      image: { data: copy.buffer, width: app.width, height: app.height },
      params: getParams(),
      name: app.name,
    },
    [copy.buffer],
  );
}

function exportIndexed() {
  if (!app.hasResult || !app.full || app.palette.length === 0) return;
  const id = nextRequestId++;
  app.exportRequestId = id;
  setExportEnabled(false);
  setStatusMessage('Encoding and validating the indexed PNG…');
  clearDownloadLinks();
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
  if (!app.hasResult || app.palette.length === 0) return;
  copyText(paletteHexList(app.palette))
    .then(() => toast(`Copied ${app.palette.length} HEX values`, 'success'))
    .catch(() => toast('Clipboard is unavailable', 'error'));
}

function toggleOriginalState() {
  const next = toggleOriginal.getAttribute('aria-pressed') !== 'true';
  toggleOriginal.setAttribute('aria-pressed', String(next));
  toggleOriginal.textContent = next ? 'Reduced' : 'Original';
  canvasView.setShowOriginal(next);
}

const controls = initControls({ onChange: processPreview });

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

document.getElementById('fit-view')?.addEventListener('click', () => canvasView.fit());
document.getElementById('zoom-100')?.addEventListener('click', () => canvasView.zoom100());
sortSelect?.addEventListener('change', () => {
  sortOrder = sortSelect.value || 'source';
  renderCurrentPalette();
  clearDownloadLinks();
});

const scheduleProcess = debounce(processPreview, 150);

populateBuiltinPalettes();
updateDitherLabels();
updateDitherControls();

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
