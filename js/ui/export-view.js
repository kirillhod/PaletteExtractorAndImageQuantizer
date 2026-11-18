// @ts-check
import { copyText } from './dom.js';
import { countLabel, t } from './i18n.js';
import { toastKey } from './status.js';

/**
 * @typedef {{ key:string, params?:Record<string, unknown> }} ExportWarning
 * @typedef {Object} ExportFileView
 * @property {string} name
 * @property {string} mime
 * @property {ArrayBuffer} data
 * @property {{ ok:boolean, detail:string }} [validation]
 * @property {ExportWarning[]} [warnings]
 */

/** @type {string[]} */
const activeUrls = [];
/** @type {ExportFileView[]} */
let currentFiles = [];
/** @type {boolean} */
let pulseNextRender = false;

/**
 * @param {ExportFileView[]} files
 * @param {{ pulse?: boolean }} [options]
 */
export function showDownloadLinks(files, options = {}) {
  currentFiles = files;
  pulseNextRender = options.pulse === true;
  renderDownloadLinks();
}

/**
 * Keep the validated block in place while a new export runs. The block stays visible
 * with the previous file, so the panel does not collapse and reopen on every save, but
 * its links cannot be activated until the new result replaces them.
 *
 * @param {boolean} pending
 */
export function setDownloadPending(pending) {
  const host = document.getElementById('download-result');
  if (!host) return;
  if (pending) {
    host.setAttribute('aria-busy', 'true');
    host.setAttribute('inert', '');
  } else {
    host.removeAttribute('aria-busy');
    host.removeAttribute('inert');
  }
}

/**
 * Rebuild the hints and link labels after a locale change.
 */
export function refreshDownloadLinks() {
  if (currentFiles.length > 0) renderDownloadLinks();
}

function renderDownloadLinks() {
  clearElements();
  const host = document.getElementById('download-result');
  if (!host || currentFiles.length === 0) {
    pulseNextRender = false;
    return;
  }

  const hint = document.createElement('p');
  hint.className = 'peiq-hint';
  hint.textContent = t('export.validatedHint');
  host.append(hint);

  const warnings = currentFiles.flatMap((file) => file.warnings ?? []);
  if (warnings.length > 0) {
    const warning = document.createElement('p');
    warning.className = 'peiq-hint peiq-hint--warning';
    warning.textContent = warnings.map(warningText).join(' ');
    host.append(warning);
  }

  for (const file of currentFiles) {
    const blob = new Blob([file.data], { type: file.mime });
    const url = URL.createObjectURL(blob);
    activeUrls.push(url);

    const row = document.createElement('div');
    row.className = 'peiq-download-result__file';

    const link = document.createElement('a');
    link.className = `peiq-btn peiq-btn--primary${pulseNextRender ? ' is-saved' : ''}`;
    link.href = url;
    link.download = file.name;
    link.rel = 'noopener';
    link.textContent = t('export.saveFile', { name: file.name });

    const copy = document.createElement('button');
    copy.type = 'button';
    copy.className = 'peiq-btn peiq-btn--small';
    copy.textContent = t('export.copyFile');
    copy.setAttribute('aria-label', t('export.copyFileAria', { name: file.name }));
    copy.addEventListener('click', () => copyFile(file));

    row.append(link, copy);
    host.append(row);
  }

  host.hidden = false;
  pulseNextRender = false;
}

/**
 * @param {ExportWarning} warning
 * @returns {string}
 */
function warningText(warning) {
  const params = { ...(warning.params ?? {}) };
  if (typeof params.count === 'number') {
    params.countLabel = countLabel('count.pixels', params.count);
  }
  return t(warning.key, params);
}

/**
 * Copy one already validated export. PNG files go to the clipboard as images;
 * palette files are copied as text. The file bytes are ready, so no worker job
 * or user-activation handoff is needed here.
 *
 * @param {{ name:string, mime:string, data:ArrayBuffer }} file
 */
async function copyFile(file) {
  try {
    if (file.mime === 'image/png') {
      const ClipboardItemCtor = /** @type {any} */ (window).ClipboardItem;
      if (!supportsImageClipboard(navigator.clipboard, ClipboardItemCtor)) {
        throw new Error('image clipboard unavailable');
      }
      const blob = exportedPngBlob(file);
      if (!blob) throw new Error('not a PNG export');
      await navigator.clipboard.write([new ClipboardItemCtor({ 'image/png': blob })]);
    } else {
      const text = await new Blob([file.data]).text();
      await copyText(text);
    }
    toastKey('toast.copiedFile', { name: file.name }, 'success');
  } catch {
    toastKey('toast.copyFileUnavailable', { name: file.name }, 'error');
  }
}

function clearElements() {
  for (const url of activeUrls) URL.revokeObjectURL(url);
  activeUrls.length = 0;
  const host = document.getElementById('download-result');
  if (host) {
    host.replaceChildren();
    host.hidden = true;
  }
}

export function clearDownloadLinks() {
  currentFiles = [];
  pulseNextRender = false;
  const host = document.getElementById('download-result');
  if (host) {
    host.removeAttribute('aria-busy');
    host.removeAttribute('inert');
  }
  clearElements();
}

/**
 * @param {boolean} enabled
 */
export function setExportEnabled(enabled) {
  for (const id of [
    'export-indexed',
    'export-strip',
    'export-reduced',
    'copy-hex',
    'export-palette',
  ]) {
    const button = /** @type {HTMLButtonElement|null} */ (document.getElementById(id));
    if (button) button.disabled = !enabled;
  }
}

/**
 * The Clipboard API only accepts images where `write` and `ClipboardItem` exist.
 * Kept pure so Node tests can cover feature detection.
 *
 * @param {{ write?: unknown }|null|undefined} clipboard
 * @param {unknown} ClipboardItemCtor
 * @returns {boolean}
 */
export function supportsImageClipboard(clipboard, ClipboardItemCtor) {
  return Boolean(
    clipboard &&
      typeof clipboard.write === 'function' &&
      typeof ClipboardItemCtor === 'function',
  );
}

/**
 * Turn a validated image export into the PNG blob the clipboard expects.
 *
 * @param {{ mime:string, data:ArrayBuffer }} file
 * @returns {Blob|null}
 */
export function exportedPngBlob(file) {
  if (!file || file.mime !== 'image/png') return null;
  return new Blob([file.data], { type: 'image/png' });
}

/**
 * @returns {'Nx1'|'1xN'}
 */
export function getStripOrientation() {
  const select = /** @type {HTMLSelectElement|null} */ (document.getElementById('strip-orientation'));
  return select?.value === '1xN' ? '1xN' : 'Nx1';
}
