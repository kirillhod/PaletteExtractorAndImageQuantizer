// @ts-check
/**
 * @param {{ name:string, mime:string, data:ArrayBuffer }[]} files
 */
export function downloadFiles(files) {
  for (const file of files) {
    const blob = new Blob([file.data], { type: file.mime });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = file.name;
    anchor.rel = 'noopener';
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }
}

/**
 * @param {boolean} enabled
 */
export function setExportEnabled(enabled) {
  for (const id of ['export-strip', 'export-reduced', 'copy-hex']) {
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
