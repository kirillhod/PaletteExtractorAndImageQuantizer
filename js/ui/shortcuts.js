// @ts-check

/** Input types that do not accept typed text, so a letter cannot be lost there. */
const NON_TEXT_INPUT_TYPES = new Set([
  'button',
  'checkbox',
  'color',
  'file',
  'radio',
  'range',
  'reset',
  'submit',
]);

/**
 * A field that owns printable characters. Help stays available from every other
 * control, because `?` cannot collide with a select's type-ahead or a slider.
 *
 * @param {HTMLElement|null} target
 * @returns {boolean}
 */
function isTextEntry(target) {
  if (!target) return false;
  if (target.isContentEditable) return true;
  if (target.tagName === 'TEXTAREA') return true;
  if (target.tagName !== 'INPUT') return false;
  return !NON_TEXT_INPUT_TYPES.has(/** @type {HTMLInputElement} */ (target).type);
}

/**
 * @param {{
 *   onFit:() => void,
 *   onZoom100:() => void,
 *   onToggleOriginal:() => void,
 *   onToggleHelp:() => void,
 *   onCycleTheme:() => void,
 *   onToggleErrorMap:() => void,
 * }} handlers
 */
export function initShortcuts(handlers) {
  document.addEventListener('keydown', (event) => {
    if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return;
    const target = /** @type {HTMLElement|null} */ (event.target);

    if (event.key === '?') {
      if (isTextEntry(target)) return;
      event.preventDefault();
      handlers.onToggleHelp();
      return;
    }

    if (
      target &&
      (target.tagName === 'INPUT' ||
        target.tagName === 'SELECT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable)
    ) {
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
      case 'e':
        event.preventDefault();
        handlers.onToggleErrorMap();
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
