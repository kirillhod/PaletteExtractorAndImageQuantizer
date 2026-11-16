// @ts-check
import { t } from './i18n.js';

/** @type {string[]} */
const activeUrls = [];
/** @type {{ name:string, mime:string, data:ArrayBuffer, validation?:{ok:boolean,detail:string} }[]} */
let currentFiles = [];

/**
 * @param {{ name:string, mime:string, data:ArrayBuffer, validation?:{ok:boolean,detail:string} }[]} files
 */
export function showDownloadLinks(files) {
  currentFiles = files;
  renderDownloadLinks();
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
  if (!host || currentFiles.length === 0) return;

  const hint = document.createElement('p');
  hint.className = 'peiq-hint';
  hint.textContent = t('export.validatedHint');
  host.append(hint);

  for (const file of currentFiles) {
    const blob = new Blob([file.data], { type: file.mime });
    const url = URL.createObjectURL(blob);
    activeUrls.push(url);

    const link = document.createElement('a');
    link.className = 'peiq-btn peiq-btn--primary';
    link.href = url;
    link.download = file.name;
    link.rel = 'noopener';
    link.textContent = t('export.saveFile', { name: file.name });
    host.append(link);
  }

  host.hidden = false;
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
  clearElements();
}

/**
 * @param {boolean} enabled
 */
export function setExportEnabled(enabled) {
  for (const id of [
    'export-indexed',
    'copy-image',
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
 * Turn a validated export file into the PNG blob the clipboard expects.
 *
 * @param {{ mime:string, data:ArrayBuffer }[]} files
 * @returns {Blob|null}
 */
export function exportedPngBlob(files) {
  const file = files[0];
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
