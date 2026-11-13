// @ts-check
const MAX_FILE_BYTES = 64 * 1024 * 1024;

/**
 * @param {{ onFile:(file:File) => void, onError:(message:string) => void }} handlers
 */
export function initDropzone(handlers) {
  const input = /** @type {HTMLInputElement|null} */ (document.getElementById('file-input'));
  const pick = document.getElementById('pick-image');
  const change = document.getElementById('change-image');
  const dropTarget = document.getElementById('drop-target');

  function openPicker() {
    input?.click();
  }

  /** @param {File|null|undefined} file */
  function accept(file) {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      handlers.onError('That file is not an image. Use PNG, JPEG, WebP, GIF, BMP, or AVIF.');
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      handlers.onError('This file is larger than 64 MiB. Use a smaller image.');
      return;
    }
    handlers.onFile(file);
  }

  pick?.addEventListener('click', openPicker);
  change?.addEventListener('click', openPicker);

  input?.addEventListener('change', () => {
    const file = input.files?.[0] ?? null;
    input.value = '';
    accept(file);
  });

  document.addEventListener('dragover', (event) => {
    event.preventDefault();
    dropTarget?.classList.add('is-dragover');
  });

  document.addEventListener('dragleave', (event) => {
    if (!event.relatedTarget) dropTarget?.classList.remove('is-dragover');
  });

  document.addEventListener('drop', (event) => {
    event.preventDefault();
    dropTarget?.classList.remove('is-dragover');
    accept(event.dataTransfer?.files?.[0]);
  });

  document.addEventListener('paste', (event) => {
    const file = event.clipboardData?.files?.[0];
    if (!file) return;
    event.preventDefault();
    accept(file);
  });

  return { openPicker };
}
