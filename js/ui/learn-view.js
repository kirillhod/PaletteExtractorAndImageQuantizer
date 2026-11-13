// @ts-check
/**
 * @returns {{ toggle:() => void, close:() => void, isOpen:() => boolean }}
 */
export function initLearn() {
  const helpButton = /** @type {HTMLButtonElement|null} */ (document.getElementById('help-toggle'));
  const drawer = /** @type {HTMLElement|null} */ (document.getElementById('help-drawer'));
  const closeButton = /** @type {HTMLButtonElement|null} */ (document.getElementById('help-close'));
  if (!helpButton || !drawer || !closeButton) {
    return { toggle() {}, close() {}, isOpen: () => false };
  }

  /** @type {HTMLElement|null} */
  let lastFocus = null;

  /** @param {boolean} open */
  function setOpen(open) {
    drawer.setAttribute('data-open', String(open));
    drawer.setAttribute('aria-hidden', String(!open));
    helpButton.setAttribute('aria-expanded', String(open));
    if (open) {
      lastFocus = /** @type {HTMLElement|null} */ (document.activeElement);
      drawer.removeAttribute('inert');
      closeButton.focus();
    } else {
      drawer.setAttribute('inert', '');
      const target =
        lastFocus && lastFocus !== document.body && typeof lastFocus.focus === 'function'
          ? lastFocus
          : helpButton;
      target.focus();
      lastFocus = null;
    }
  }

  function isOpen() {
    return drawer.getAttribute('data-open') === 'true';
  }

  function toggle() {
    setOpen(!isOpen());
  }

  function close() {
    if (isOpen()) setOpen(false);
  }

  setOpen(false);
  helpButton.addEventListener('click', toggle);
  closeButton.addEventListener('click', close);

  document.addEventListener('click', (event) => {
    if (!isOpen()) return;
    const target = /** @type {Node} */ (event.target);
    if (drawer.contains(target) || helpButton.contains(target)) return;
    close();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && isOpen()) {
      event.preventDefault();
      close();
    }
  });

  return { toggle, close, isOpen };
}
