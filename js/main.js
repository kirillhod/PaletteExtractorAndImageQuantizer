// @ts-check
import { paletteHexList } from './core/palette.js';
import { copyText } from './ui/dom.js';
import { createCanvasView } from './ui/canvas-view.js';
import { initControls } from './ui/controls.js';
import { initDropzone } from './ui/dropzone.js';
import { downloadFiles, getStripOrientation, setExportEnabled } from './ui/export-view.js';
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
    renderPalette(app.palette, paletteStrip);
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
      updateExportState();
      return;
    }
    downloadFiles(files);
    const detail = files[0]?.validation?.detail ?? 'export complete';
    toast(`Validated: ${detail}`, 'success');
    setStatusMessage(`Validated: ${detail}`);
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

function processPreview() {
  if (!app.preview) return;
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
      params: controls.getParams(),
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

    if (hero) hero.hidden = true;
    if (workspace) workspace.hidden = false;
    canvasView.setOriginal(preview);
    renderPalette([], paletteStrip);
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
  worker.postMessage({
    type: 'export-strip',
    requestId: id,
    palette: app.palette,
    name: app.name,
    orientation: getStripOrientation(),
  });
}

function exportReduced() {
  if (!app.hasResult || !app.full || app.palette.length === 0) return;
  const id = nextRequestId++;
  app.exportRequestId = id;
  setExportEnabled(false);
  setStatusMessage('Encoding the full-resolution PNG…');
  const copy = new Uint8ClampedArray(app.full.data);
  worker.postMessage(
    {
      type: 'export-reduced',
      requestId: id,
      image: { data: copy.buffer, width: app.width, height: app.height },
      params: controls.getParams(),
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
toggleOriginal.addEventListener('click', toggleOriginalState);
document.getElementById('export-strip')?.addEventListener('click', exportStrip);
document.getElementById('export-reduced')?.addEventListener('click', exportReduced);
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
