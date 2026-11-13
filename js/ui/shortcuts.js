// @ts-check
/**
 * @param {{
 *   onFit:() => void,
 *   onZoom100:() => void,
 *   onToggleOriginal:() => void,
 *   onToggleHelp:() => void,
 *   onCycleTheme:() => void,
 * }} handlers
 */
export function initShortcuts(handlers) {
  document.addEventListener('keydown', (event) => {
    if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return;
    const target = /** @type {HTMLElement|null} */ (event.target);
    if (
      target &&
      (target.tagName === 'INPUT' ||
        target.tagName === 'SELECT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable)
    ) {
      return;
    }

    if (event.key === '?') {
      event.preventDefault();
      handlers.onToggleHelp();
      return;
    }

    switch (event.key.toLowerCase()) {
      case 'f':
        event.preventDefault();
        handlers.onFit();
        break;
      case '1':
        event.preventDefault();
        handlers.onZoom100();
        break;
      case 'o':
        event.preventDefault();
        handlers.onToggleOriginal();
        break;
      case 't':
        event.preventDefault();
        handlers.onCycleTheme();
        break;
      default:
        break;
    }
  });
}
