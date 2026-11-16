// @ts-check
import { t } from './i18n.js';

/** @typedef {import('../core/types.js').PaletteEntry} PaletteEntry */
/** @typedef {import('../core/picked-markers.js').PickedMarkers} PickedMarkers */

/**
 * @typedef {Object} PickedMarkersOptions
 * @property {HTMLElement} host
 * @property {(u:number, v:number) => { x:number, y:number }|null} toFramePoint
 * @property {(id:number) => void} onSelect
 * @property {(id:number, event:PointerEvent) => void} onDragStart
 * @property {(id:number, event:PointerEvent) => void} onDragMove
 * @property {(id:number, event:PointerEvent, moved:boolean) => void} onDragEnd
 * @property {(id:number) => void} onDragCancel
 * @property {(id:number, key:string, step:number) => void} onNudge
 */

/**
 * Draw and drag the sample anchors created by the eyedropper. The overlay owns
 * pointer capture; color sampling and undo stay in main.js.
 *
 * @param {PickedMarkersOptions} options
 */
export function createPickedMarkers(options) {
  const { host, toFramePoint, onSelect, onDragStart, onDragMove, onDragEnd, onDragCancel, onNudge } =
    options;

  /** @type {Map<number, HTMLButtonElement>} */
  const nodes = new Map();
  /** @type {{ id:number, pointerId:number, startX:number, startY:number, moved:boolean }|null} */
  let drag = null;
  let releasing = false;

  /**
   * @param {number} id
   * @param {PointerEvent} event
   */
  function beginDrag(id, event) {
    if (drag) return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    const node = nodes.get(id);
    if (!node) return;
    drag = {
      id,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      moved: false,
    };
    node.setPointerCapture(event.pointerId);
    node.classList.add('is-dragging');
    onSelect(id);
    onDragStart(id, event);
  }

  /** @param {PointerEvent} event */
  function moveDrag(event) {
    if (!drag || drag.pointerId !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    if (!drag.moved && Math.hypot(dx, dy) >= 3) drag.moved = true;
    if (!drag.moved) return;
    onDragMove(drag.id, event);
  }

  /** @param {PointerEvent} event */
  function endDrag(event) {
    if (!drag || drag.pointerId !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    const current = drag;
    drag = null;
    const node = nodes.get(current.id);
    node?.classList.remove('is-dragging');
    if (node?.hasPointerCapture(event.pointerId)) {
      releasing = true;
      node.releasePointerCapture(event.pointerId);
      releasing = false;
    }
    onDragEnd(current.id, event, current.moved);
  }

  /** @param {number} id */
  function cancelDrag(id) {
    if (!drag || drag.id !== id) return;
    const current = drag;
    drag = null;
    const node = nodes.get(current.id);
    node?.classList.remove('is-dragging');
    if (node?.hasPointerCapture(current.pointerId)) {
      releasing = true;
      node.releasePointerCapture(current.pointerId);
      releasing = false;
    }
    onDragCancel(current.id);
  }

  function cancelActiveDrag() {
    if (!drag) return;
    const id = drag.id;
    cancelDrag(id);
  }

  /**
   * @param {number} id
   * @param {HTMLButtonElement} node
   */
  function bind(id, node) {
    node.addEventListener('pointerdown', (event) => beginDrag(id, event));
    node.addEventListener('pointermove', moveDrag);
    node.addEventListener('pointerup', endDrag);
    node.addEventListener('pointercancel', () => cancelDrag(id));
    node.addEventListener('lostpointercapture', () => {
      if (!releasing) cancelDrag(id);
    });
    node.addEventListener('keydown', (event) => {
      if (!event.key.startsWith('Arrow')) return;
      event.preventDefault();
      onNudge(id, event.key, event.shiftKey ? 0.05 : 0.01);
    });
    node.addEventListener('focus', () => onSelect(id));
  }

  /**
   * @param {PaletteEntry[]} entries
   * @param {PickedMarkers} markers
   * @param {number|null} selectedId
   * @returns {{ id:number, entry:PaletteEntry, x:number, y:number, offsetX:number, offsetY:number }[]}
   */
  function layout(entries, markers, selectedId) {
    const items = [];
    for (const entry of entries) {
      const point = markers.get(entry.id);
      if (!point) continue;
      const framePoint = toFramePoint(point.u, point.v);
      if (!framePoint) continue;
      items.push({ id: entry.id, entry, x: framePoint.x, y: framePoint.y, offsetX: 0, offsetY: 0 });
    }

    items.sort((a, b) => a.id - b.id);
    const groups = [];
    for (const item of items) {
      let group = groups.find(
        (candidate) => Math.hypot(candidate.x - item.x, candidate.y - item.y) < 14,
      );
      if (!group) {
        group = { x: item.x, y: item.y, items: [] };
        groups.push(group);
      }
      group.items.push(item);
    }

    for (const group of groups) {
      group.items.sort((a, b) => {
        if (a.id === selectedId) return -1;
        if (b.id === selectedId) return 1;
        return a.id - b.id;
      });
      group.items.forEach((item, index) => {
        if (index === 0) return;
        const angle = ((index - 1) * Math.PI * 2) / Math.max(1, group.items.length - 1) - Math.PI / 2;
        item.offsetX = Math.cos(angle) * 14;
        item.offsetY = Math.sin(angle) * 14;
      });
    }

    return items;
  }

  /**
   * @param {{ entries: PaletteEntry[], markers: PickedMarkers, selectedId:number|null, active:boolean }} state
   */
  function render(state) {
    const { entries, markers, selectedId, active } = state;
    host.hidden = !active || markers.size === 0;
    if (!active) {
      for (const node of nodes.values()) node.remove();
      nodes.clear();
      return;
    }

    const items = layout(entries, markers, selectedId);
    const seen = new Set();
    for (const item of items) {
      seen.add(item.id);
      let node = nodes.get(item.id);
      if (!node) {
        node = document.createElement('button');
        node.type = 'button';
        node.className = 'peiq-picked-marker';
        node.dataset.entryId = String(item.id);
        bind(item.id, node);
        host.append(node);
        nodes.set(item.id, node);
      }
      node.style.left = `${item.x + item.offsetX}px`;
      node.style.top = `${item.y + item.offsetY}px`;
      node.style.setProperty('--marker-color', item.entry.hex);
      node.classList.toggle('is-selected', item.id === selectedId);
      node.classList.toggle('is-locked', item.entry.locked);
      node.tabIndex = item.id === selectedId ? 0 : -1;
      node.setAttribute('aria-pressed', String(item.id === selectedId));
      const label =
        t('palette.markerAria', { hex: item.entry.hex }) +
        (item.entry.locked ? t('palette.lockedSuffix') : '');
      node.setAttribute('aria-label', label);
      node.title = label;
    }

    for (const [id, node] of nodes) {
      if (seen.has(id)) continue;
      if (drag?.id === id) cancelDrag(id);
      node.remove();
      nodes.delete(id);
    }
  }

  return { render, cancelDrag: cancelActiveDrag };
}
