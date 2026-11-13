// @ts-check
/** @type {string[]} */
const activeUrls = [];

/**
 * @param {{ name:string, mime:string, data:ArrayBuffer, validation?:{ok:boolean,detail:string} }[]} files
 */
export function showDownloadLinks(files) {
  clearDownloadLinks();
  const host = document.getElementById('download-result');
  if (!host) return;

  const hint = document.createElement('p');
  hint.className = 'peiq-hint';
  hint.textContent = 'Validated. Click Save to write the file.';
  host.append(hint);

  for (const file of files) {
    const blob = new Blob([file.data], { type: file.mime });
    const url = URL.createObjectURL(blob);
    activeUrls.push(url);

    const link = document.createElement('a');
    link.className = 'peiq-btn peiq-btn--primary';
    link.href = url;
    link.download = file.name;
    link.rel = 'noopener';
    link.textContent = `Save ${file.name}`;
    host.append(link);
  }

  host.hidden = false;
}

export function clearDownloadLinks() {
  for (const url of activeUrls) URL.revokeObjectURL(url);
  activeUrls.length = 0;
  const host = document.getElementById('download-result');
  if (host) {
    host.replaceChildren();
    host.hidden = true;
  }
}

/**
 * @param {boolean} enabled
 */
export function setExportEnabled(enabled) {
  for (const id of ['export-indexed', 'export-strip', 'export-reduced', 'copy-hex']) {
    const button = /** @type {HTMLButtonElement|null} */ (document.getElementById(id));
    if (button) button.disabled = !enabled;
  }
}

/**
 * @returns {'Nx1'|'1xN'}
 */
export function getStripOrientation() {
  const select = /** @type {HTMLSelectElement|null} */ (document.getElementById('strip-orientation'));
  return select?.value === '1xN' ? '1xN' : 'Nx1';
}
