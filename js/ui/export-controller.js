// @ts-check
import { paletteHexList } from '../core/palette.js';
import { formatGplPalette, parseGplPalette } from '../core/formats/gpl.js';
import { formatHexPalette, parseHexPalette } from '../core/formats/hex.js';
import { formatPaletteJson, parsePaletteJson } from '../core/formats/json.js';
import { copyText } from './dom.js';
import {
  clearDownloadLinks,
  getStripOrientation,
  setExportEnabled,
  showDownloadLinks,
} from './export-view.js';
import { countLabel, localizeDetail, localizeError, t } from './i18n.js';
import { setStatusMessage, toast, toastKey } from './status.js';

/**
 * @typedef {Object} ExportApp
 * @property {string} name
 * @property {number} width
 * @property {number} height
 * @property {any[]} palette
 * @property {boolean} hasResult
 * @property {boolean} previewBusy
 * @property {number} exportRequestId
 * @property {boolean} exportBusy
 */

/**
 * @typedef {Object} ExportDeps
 * @property {ExportApp} app
 * @property {() => Worker} getWorker
 * @property {() => number} nextRequestId
 * @property {() => any} getParams
 * @property {() => any} getProcessParams
 * @property {() => string} getColorSpace
 * @property {() => string} getSortOrder
 * @property {() => Promise<ImageData|null>} decodeFullImage
 * @property {() => void} refreshExportState
 * @property {() => void} prepareForExport
 */

/**
 * Owns the export pipeline: request ids, progress, worker jobs, validation, and the
 * validated Save/Copy rows. The app shell calls `handleExported` from the worker message
 * handler and `cancelExport` when an image or setting change invalidates the job.
 *
 * @param {ExportDeps} deps
 */
export function createExportController(deps) {
  const { app } = deps;
  let progressKey = '';
  let validationDetailRaw = '';

  /** @param {string} labelKey */
  function setExportProgress(labelKey) {
    progressKey = labelKey;
    const host = document.getElementById('export-progress');
    const labelNode = document.getElementById('export-progress-label');
    const panel = document.querySelector('.peiq-export-panel');
    if (labelNode) labelNode.textContent = t(labelKey);
    if (host) host.hidden = false;
    if (panel) panel.setAttribute('aria-busy', 'true');
  }

  function clearExportProgress() {
    progressKey = '';
    const host = document.getElementById('export-progress');
    const panel = document.querySelector('.peiq-export-panel');
    if (host) host.hidden = true;
    if (panel) panel.removeAttribute('aria-busy');
  }

  /**
   * @param {string} labelKey
   * @returns {number} request id, or 0 when an export is already running
   */
  function beginExport(labelKey) {
    if (app.previewBusy) {
      // The last result and its controls stay visible while a preview runs; say why
      // a click during that short window does not start an export.
      setStatusMessage('status.processingPreview');
      return 0;
    }
    if (!app.hasResult || app.palette.length === 0 || app.exportBusy) return 0;
    const id = deps.nextRequestId();
    app.exportRequestId = id;
    app.exportBusy = true;
    setExportEnabled(false);
    deps.prepareForExport();
    clearDownloadLinks();
    setExportProgress(labelKey);
    return id;
  }

  function finishExport() {
    app.exportBusy = false;
    clearExportProgress();
    deps.refreshExportState();
  }

  function cancelExport() {
    if (!app.exportBusy) return;
    deps.getWorker().postMessage({ type: 'cancel', requestId: app.exportRequestId });
    app.exportRequestId = 0;
    finishExport();
  }

  /**
   * Apply the worker's export result. Returns false when the message belongs to a stale
   * request, so the caller can keep its other branches simple.
   *
   * @param {any} message
   * @returns {boolean}
   */
  function handleExported(message) {
    if (message.requestId !== app.exportRequestId) return false;
    const files = message.files ?? [];
    const ok = files.length > 0 && files.every((file) => file.validation?.ok);
    if (!ok) {
      const detail = localizeDetail(files[0]?.validation?.detail);
      toastKey('toast.exportFailedValidation', { detail }, 'error');
      setStatusMessage('status.exportFailedValidation');
      clearDownloadLinks();
      finishExport();
      return true;
    }
    showDownloadLinks(files);
    validationDetailRaw = files[0]?.validation?.detail ?? '';
    const detail = localizeDetail(validationDetailRaw);
    toastKey('toast.validatedDownload', {}, 'success');
    setStatusMessage('status.validatedReady', { detail });
    finishExport();
    return true;
  }

  function exportStrip() {
    const id = beginExport('status.progressStrip');
    if (!id) return;
    setStatusMessage('status.buildingStrip');
    deps.getWorker().postMessage({
      type: 'export-strip',
      requestId: id,
      palette: app.palette,
      name: app.name,
      orientation: getStripOrientation(),
      transparentIndex: Number(document.getElementById('transparent-index')?.value ?? -1),
    });
  }

  async function exportReduced() {
    const id = beginExport('status.progressEncode');
    if (!id) return;
    setStatusMessage('status.encodingReduced');
    const params = deps.getProcessParams();
    const name = app.name;
    try {
      const full = await deps.decodeFullImage();
      if (!full) throw new Error(t('error.imageDecode'));
      if (!app.exportBusy || app.exportRequestId !== id) return;
      deps.getWorker().postMessage(
        {
          type: 'export-reduced',
          requestId: id,
          image: { data: full.data.buffer, width: app.width, height: app.height },
          params,
          name,
        },
        [full.data.buffer],
      );
    } catch (error) {
      if (app.exportRequestId !== id) return;
      toast(localizeError(error), 'error');
      finishExport();
    }
  }

  async function exportIndexed() {
    const id = beginExport('status.progressIndex');
    if (!id) return;
    setStatusMessage('status.encodingIndexed');
    const params = deps.getParams();
    const name = app.name;
    const palette = app.palette.map((entry) => ({ ...entry, color: { ...entry.color } }));
    try {
      const full = await deps.decodeFullImage();
      if (!full) throw new Error(t('error.imageDecode'));
      if (!app.exportBusy || app.exportRequestId !== id) return;
      deps.getWorker().postMessage(
        {
          type: 'export-indexed',
          requestId: id,
          image: { data: full.data.buffer, width: app.width, height: app.height },
          palette,
          params,
          name,
        },
        [full.data.buffer],
      );
    } catch (error) {
      if (app.exportRequestId !== id) return;
      toast(localizeError(error), 'error');
      finishExport();
    }
  }

  function copyHex() {
    if (!app.hasResult || app.palette.length === 0 || app.exportBusy) return;
    copyText(paletteHexList(app.palette))
      .then(() =>
        toastKey(
          'toast.copiedHexValues',
          { countLabel: countLabel('count.hexValues', app.palette.length) },
          'success',
        ),
      )
      .catch(() => toastKey('toast.clipboardUnavailable', {}, 'error'));
  }

  async function exportPaletteFile() {
    const id = beginExport('status.progressPaletteFile');
    if (!id) return;
    const formatValue = document.getElementById('palette-format')?.value;
    const format = formatValue === 'gpl' ? 'gpl' : formatValue === 'json' ? 'json' : 'hex';
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
          order: deps.getSortOrder(),
          space: deps.getColorSpace(),
        });
        parsed = parsePaletteJson(text).colors;
      } else {
        text = formatHexPalette(colors);
        parsed = parseHexPalette(text).colors;
      }
    } catch (error) {
      finishExport();
      toastKey('toast.paletteBuildFailed', { detail: localizeError(error) }, 'error');
      return;
    }

    const compareAlpha = format !== 'gpl';
    const validation = validatePaletteColors(parsed, expected, compareAlpha, format);
    if (!validation.ok) {
      finishExport();
      toastKey(
        'toast.paletteValidationFailed',
        { detail: localizeDetail(validation.detail) },
        'error',
      );
      setStatusMessage('status.validationFailed');
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
    toastKey('toast.paletteFileReady', {}, 'success');
    validationDetailRaw = validation.detail;
    setStatusMessage('status.validatedReady', {
      detail: localizeDetail(validationDetailRaw),
    });
    finishExport();
  }

  return {
    beginExport,
    cancelExport,
    clearExportProgress,
    copyHex,
    exportIndexed,
    exportPaletteFile,
    exportReduced,
    exportStrip,
    finishExport,
    getProgressKey: () => progressKey,
    getValidationDetail: () => validationDetailRaw,
    handleExported,
    setExportProgress,
  };
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
