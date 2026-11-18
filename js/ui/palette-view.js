// @ts-check
import { copyText, el } from './dom.js';
import { t } from './i18n.js';
import { toastKey } from './status.js';

/** A press shorter than this stays a click; a longer one picks the swatch up. */
const DRAG_THRESHOLD = 5;
/** A completed drag must not also count as a click on the swatch it started from. */
const CLICK_AFTER_DRAG_MS = 350;

/** @type {number} */
let lastDragEnd = 0;

/** @type {WeakMap<HTMLElement, (event: PointerEvent) => void>} */
const reorderHandlers = new WeakMap();

/**
 * @param {{ id:number, hex:string, locked?:boolean }[]} palette
 * @param {HTMLElement|null} host
 * @param {{
 *   editMode?: boolean,
 *   selectedId?: number|null,
 *   onActivate?: (entry:any) => void,
 *   onReorder?: (id:number, position:number) => void,
 * }} [options]
 */
export function renderPalette(palette, host, options = {}) {
  if (!host) return;
  const { editMode = false, selectedId = null, onActivate = null, onReorder = null } = options;
  host.replaceChildren();
  host.classList.toggle('is-reorderable', editMode && Boolean(onReorder));

  for (const entry of palette) {
    const selected = editMode && entry.id === selectedId;
    const locked = entry.locked === true;
    const action = editMode
      ? t('palette.swatchEdit', { hex: entry.hex })
      : t('palette.swatchCopy', { hex: entry.hex });
    const suffix = locked ? t('palette.lockedSuffix') : '';
    const button = el('button', {
      className: [
        'peiq-swatch',
        selected ? 'is-selected' : '',
        locked ? 'is-locked' : '',
      ].filter(Boolean).join(' '),
      attrs: {
        type: 'button',
        title: `${action}${suffix}`,
        'aria-label': `${action}${suffix}`,
        'data-entry-id': String(entry.id),
        ...(editMode ? { 'aria-pressed': String(selected) } : {}),
      },
    });
    button.style.setProperty('--swatch', entry.hex);
    if (locked) button.append(createLockBadge());
    button.addEventListener('click', () => {
      // The drag already committed the move; do not also select or copy on release.
      if (performance.now() - lastDragEnd < CLICK_AFTER_DRAG_MS) return;
      if (onActivate) {
        onActivate(entry);
        return;
      }
      copyText(entry.hex)
        .then(() => toastKey('toast.copiedHex', { hex: entry.hex }, 'success'))
        .catch(() => toastKey('toast.clipboardUnavailable', {}, 'error'));
    });
    host.append(button);
  }

  if (editMode && onReorder) initReorder(host, palette, onReorder);
  else detachReorder(host);
}

/**
 * Pointer drag reordering for Edit mode. Mouse and pen only: a touch screen has to keep
 * the strip scrollable, so the arrow buttons stay the touch path. Keyboard and
 * screen-reader users keep the arrows as well.
 *
 * @param {HTMLElement} host
 * @param {{ id:number, locked?:boolean }[]} palette
 * @param {(id:number, position:number) => void} onReorder
 */
function initReorder(host, palette, onReorder) {
  detachReorder(host);
  const handler = (event) => {
    if (event.pointerType === 'touch' || event.button !== 0) return;
    const target = /** @type {HTMLElement|null} */ (event.target);
    const button = /** @type {HTMLElement|null} */ (target?.closest?.('.peiq-swatch') ?? null);
    if (!button) return;
    const id = Number(button.dataset.entryId);
    const from = palette.findIndex((entry) => entry.id === id);
    if (from < 0 || palette[from].locked) return;
    beginDrag(event, { button, id, from, palette, onReorder });
  };
  reorderHandlers.set(host, handler);
  host.addEventListener('pointerdown', handler);
}

/** @param {HTMLElement} host */
function detachReorder(host) {
  const handler = reorderHandlers.get(host);
  if (!handler) return;
  host.removeEventListener('pointerdown', handler);
  reorderHandlers.delete(host);
}

/**
 * @param {PointerEvent} event
 * @param {{
 *   button: HTMLElement,
 *   id: number,
 *   from: number,
 *   palette: { id:number }[],
 *   onReorder: (id:number, position:number) => void,
 * }} context
 */
function beginDrag(event, context) {
  const { button, id, from, palette, onReorder } = context;
  const state = {
    button,
    id,
    from,
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    active: false,
    targetIndex: /** @type {number|null} */ (null),
    targetNode: /** @type {HTMLElement|null} */ (null),
    done: false,
  };

  function clearTarget() {
    if (state.targetNode) {
      state.targetNode.classList.remove('is-drop-before', 'is-drop-after');
    }
    state.targetNode = null;
    state.targetIndex = null;
  }

  /**
   * @param {number} clientX
   * @param {number} clientY
   */
  function updateTarget(clientX, clientY) {
    const node = document.elementFromPoint(clientX, clientY);
    const swatch = /** @type {HTMLElement|null} */ (node?.closest?.('.peiq-swatch') ?? null);
    if (!swatch || swatch === state.button) {
      clearTarget();
      return;
    }
    const index = palette.findIndex((entry) => String(entry.id) === swatch.dataset.entryId);
    if (index < 0) {
      clearTarget();
      return;
    }
    const rect = swatch.getBoundingClientRect();
    const after = clientX > rect.left + rect.width / 2;
    const insertAt = after ? index + 1 : index;
    const position = state.from < insertAt ? insertAt - 1 : insertAt;
    if (state.targetNode && state.targetNode !== swatch) {
      state.targetNode.classList.remove('is-drop-before', 'is-drop-after');
    }
    state.targetNode = swatch;
    swatch.classList.toggle('is-drop-before', !after);
    swatch.classList.toggle('is-drop-after', after);
    state.targetIndex = position;
  }

  /** @param {boolean} cancelled */
  function finish(cancelled) {
    if (state.done) return;
    state.done = true;
    window.removeEventListener('pointermove', onMove, true);
    window.removeEventListener('pointerup', onUp, true);
    window.removeEventListener('pointercancel', onCancel, true);
    window.removeEventListener('keydown', onKey, true);
    state.button.classList.remove('is-dragging');
    if (state.button.hasPointerCapture?.(state.pointerId)) {
      state.button.releasePointerCapture(state.pointerId);
    }
    const target = state.targetIndex;
    const moved = state.active && !cancelled && target !== null && target !== state.from;
    clearTarget();
    if (state.active) lastDragEnd = performance.now();
    if (moved && target !== null) onReorder(state.id, target);
  }

  /** @param {PointerEvent} moveEvent */
  function onMove(moveEvent) {
    if (state.done) return;
    const dx = moveEvent.clientX - state.startX;
    const dy = moveEvent.clientY - state.startY;
    if (!state.active) {
      if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
      state.active = true;
      state.button.classList.add('is-dragging');
      state.button.setPointerCapture?.(moveEvent.pointerId);
      window.getSelection()?.removeAllRanges();
    }
    moveEvent.preventDefault();
    updateTarget(moveEvent.clientX, moveEvent.clientY);
  }

  /** @param {KeyboardEvent} keyEvent */
  function onKey(keyEvent) {
    if (keyEvent.key !== 'Escape') return;
    keyEvent.preventDefault();
    keyEvent.stopPropagation();
    finish(true);
  }

  const onUp = () => finish(false);
  const onCancel = () => finish(true);

  window.addEventListener('pointermove', onMove, true);
  window.addEventListener('pointerup', onUp, true);
  window.addEventListener('pointercancel', onCancel, true);
  window.addEventListener('keydown', onKey, true);
}

const SVG_NS = 'http://www.w3.org/2000/svg';

/** @returns {SVGSVGElement} */
function createLockBadge() {
  const badge = document.createElementNS(SVG_NS, 'svg');
  badge.setAttribute('viewBox', '0 0 24 24');
  badge.setAttribute('class', 'peiq-swatch__lock');
  badge.setAttribute('aria-hidden', 'true');

  const shackle = document.createElementNS(SVG_NS, 'path');
  shackle.setAttribute('d', 'M8 11V8a4 4 0 0 1 8 0v3');
  shackle.setAttribute('fill', 'none');
  shackle.setAttribute('stroke', 'currentColor');
  shackle.setAttribute('stroke-width', '3');
  shackle.setAttribute('stroke-linecap', 'round');

  const body = document.createElementNS(SVG_NS, 'rect');
  body.setAttribute('x', '5');
  body.setAttribute('y', '10');
  body.setAttribute('width', '14');
  body.setAttribute('height', '10');
  body.setAttribute('rx', '2');
  body.setAttribute('fill', 'currentColor');

  badge.append(shackle, body);
  return badge;
}
