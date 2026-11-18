// @ts-check
import { t } from './i18n.js';

const MAX_FILE_BYTES = 64 * 1024 * 1024;

/**
 * @param {{
 *   onFile:(file:File) => void,
 *   onError:(message:string) => void,
 *   hasImage?: () => boolean,
 * }} handlers
 */
export function initDropzone(handlers) {
  const input = /** @type {HTMLInputElement|null} */ (document.getElementById('file-input'));
  const pick = document.getElementById('pick-image');
  const change = document.getElementById('change-image');
  const dropTarget = document.getElementById('drop-target');
  const replaceDialog = /** @type {HTMLDialogElement|null} */ (
    document.getElementById('replace-image-dialog')
  );

  function openPicker() {
    input?.click();
  }

  /**
   * Ask before a drop, a pick, or a paste replaces a loaded image. The footer's
   * confirmation dialog is reused; `window.confirm` covers a browser without
   * `showModal`, so the guard is never skipped silently.
   *
   * @returns {Promise<boolean>}
   */
  function confirmReplace() {
    if (!handlers.hasImage?.()) return Promise.resolve(true);
    if (!replaceDialog || typeof replaceDialog.showModal !== 'function') {
      return Promise.resolve(window.confirm(t('replace.text')));
    }
    return new Promise((resolve) => {
      const onClose = () => {
        replaceDialog.removeEventListener('close', onClose);
        resolve(replaceDialog.returnValue === 'replace');
      };
      replaceDialog.addEventListener('close', onClose);
      try {
        replaceDialog.returnValue = '';
        replaceDialog.showModal();
      } catch {
        replaceDialog.removeEventListener('close', onClose);
        resolve(false);
      }
    });
  }

  /** @param {File|null|undefined} file */
  async function accept(file) {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      handlers.onError(t('error.notImage'));
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      handlers.onError(t('error.fileTooLarge'));
      return;
    }
    if (!(await confirmReplace())) return;
    handlers.onFile(file);
  }

  pick?.addEventListener('click', openPicker);
  change?.addEventListener('click', openPicker);

  input?.addEventListener('change', () => {
    const file = input.files?.[0] ?? null;
    input.value = '';
    void accept(file);
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
    void accept(event.dataTransfer?.files?.[0]);
  });

  document.addEventListener('paste', (event) => {
    const file = event.clipboardData?.files?.[0];
    if (!file) return;
    event.preventDefault();
    void accept(file);
  });

  return { openPicker };
}
