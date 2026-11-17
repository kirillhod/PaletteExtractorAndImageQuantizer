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
 * A letter shortcut fires for the produced Latin letter or for the physical key
 * position. The second half is what keeps F, O, E, and T alive on a Russian or other
 * non-Latin layout, where those keys produce Cyrillic letters.
 *
 * @param {KeyboardEvent} event
 * @param {string} letter
 * @returns {boolean}
 */
function isLetterShortcut(event, letter) {
  const produced = typeof event.key === 'string' ? event.key.toLowerCase() : '';
  return produced === letter || event.code === `Key${letter.toUpperCase()}`;
}

/**
 * `1` matches the produced digit on layouts that need Shift for it, and the top-row
 * key position on layouts that move it. Shift+1 stays `!` on a US layout.
 *
 * @param {KeyboardEvent} event
 * @returns {boolean}
 */
function isZoomShortcut(event) {
  return event.key === '1' || (event.code === 'Digit1' && !event.shiftKey);
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

    if (isLetterShortcut(event, 'f')) {
      event.preventDefault();
      handlers.onFit();
    } else if (isZoomShortcut(event)) {
      event.preventDefault();
      handlers.onZoom100();
    } else if (isLetterShortcut(event, 'o')) {
      event.preventDefault();
      handlers.onToggleOriginal();
    } else if (isLetterShortcut(event, 'e')) {
      event.preventDefault();
      handlers.onToggleErrorMap();
    } else if (isLetterShortcut(event, 't')) {
      event.preventDefault();
      handlers.onCycleTheme();
    }
  });
}
