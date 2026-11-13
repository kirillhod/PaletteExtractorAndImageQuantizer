// @ts-check
/**
 * Lightweight tooltips for the small `?` buttons. The bubble is appended to <body> and
 * positioned with fixed coordinates, so it is not clipped by the scrolling rail.
 *
 * Mouse and keyboard show on hover/focus; touch uses focus and an outside tap to close.
 */

const SHOW_DELAY = 120;
const MARGIN = 8;

export function initTooltips() {
  const buttons = /** @type {HTMLButtonElement[]} */ (
    [...document.querySelectorAll('.peiq-help[data-tooltip]')]
  );
  if (buttons.length === 0) return;

  /** @type {{ button: HTMLButtonElement, node: HTMLDivElement } | null} */
  let active = null;
  let showTimer = 0;
  let nextId = 0;
  let lastPointerType = 'mouse';
  let shownOnPointerDown = false;

  function hide() {
    window.clearTimeout(showTimer);
    if (!active) return;
    active.button.removeAttribute('aria-describedby');
    active.node.remove();
    active = null;
  }

  /**
   * @param {HTMLButtonElement} button
   * @param {HTMLDivElement} node
   */
  function place(button, node) {
    node.style.left = '0px';
    node.style.top = '0px';
    const buttonRect = button.getBoundingClientRect();
    const nodeRect = node.getBoundingClientRect();

    let left = buttonRect.left + buttonRect.width / 2 - nodeRect.width / 2;
    left = Math.max(
      MARGIN,
      Math.min(window.innerWidth - nodeRect.width - MARGIN, left),
    );

    let top = buttonRect.bottom + MARGIN;
    if (top + nodeRect.height > window.innerHeight - MARGIN) {
      top = buttonRect.top - nodeRect.height - MARGIN;
    }
    if (top < MARGIN) top = MARGIN;

    node.style.left = `${Math.round(left)}px`;
    node.style.top = `${Math.round(top)}px`;
  }

  /** @param {HTMLButtonElement} button */
  function show(button) {
    if (active?.button === button) return;
    hide();

    const text = button.dataset.tooltip ?? '';
    if (!text) return;

    const node = document.createElement('div');
    node.className = 'peiq-tooltip';
    node.id = `peiq-tooltip-${++nextId}`;
    node.setAttribute('role', 'tooltip');
    node.textContent = text;
    document.body.append(node);
    button.setAttribute('aria-describedby', node.id);

    active = { button, node };
    place(button, node);
  }

  for (const button of buttons) {
    const text = button.dataset.tooltip ?? '';
    if (!text) continue;
    if (!button.hasAttribute('aria-label')) button.setAttribute('aria-label', text);

    button.addEventListener('pointerenter', (event) => {
      if (event.pointerType === 'touch') return;
      window.clearTimeout(showTimer);
      showTimer = window.setTimeout(() => show(button), SHOW_DELAY);
    });

    button.addEventListener('pointerleave', () => {
      window.clearTimeout(showTimer);
      if (active?.button === button && document.activeElement !== button) hide();
    });

    button.addEventListener('focus', () => show(button));
    button.addEventListener('blur', () => {
      if (active?.button === button) hide();
    });

    button.addEventListener('pointerdown', (event) => {
      lastPointerType = event.pointerType;
      shownOnPointerDown = Boolean(active && active.button === button);
    });

    button.addEventListener('click', () => {
      if (lastPointerType !== 'touch') return;
      if (shownOnPointerDown) {
        hide();
        return;
      }
      if (!active || active.button !== button) show(button);
    });
  }

  document.addEventListener(
    'pointerdown',
    (event) => {
      if (!active) return;
      const target = /** @type {Node} */ (event.target);
      if (active.button.contains(target) || active.node.contains(target)) return;
      hide();
    },
    true,
  );

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && active) {
      event.preventDefault();
      hide();
    }
  });

  function reposition() {
    if (active) place(active.button, active.node);
  }

  window.addEventListener('scroll', reposition, true);
  window.addEventListener('resize', reposition);
}
