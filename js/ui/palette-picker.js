// @ts-check
import { formatHex } from '../core/color.js';
import { updatePaletteEntry } from '../core/palette.js';
import { localizeError } from './i18n.js';
import { createPickedMarkers } from './picked-markers.js';
import { toast, toastKey } from './status.js';

const PICK_LOUPE_SIZE = 108;
const PICK_LOUPE_CELLS = 9;
const PICK_LOUPE_CELL = PICK_LOUPE_SIZE / PICK_LOUPE_CELLS;
const PICK_LOUPE_RADIUS = (PICK_LOUPE_CELLS - 1) / 2;

/**
 * @param {{ source: { width:number, height:number }, x:number, y:number }} sample
 * @returns {{ u:number, v:number }}
 */
function normalizePickPoint(sample) {
  return {
    u: Math.min(1, Math.max(0, (sample.x + 0.5) / sample.source.width)),
    v: Math.min(1, Math.max(0, (sample.y + 0.5) / sample.source.height)),
  };
}

/**
 * @typedef {Object} PalettePickerDeps
 * @property {any} app
 * @property {any} state
 * @property {any} pickState
 * @property {any} canvasView
 * @property {any} paletteEditor
 * @property {HTMLElement|null} host
 * @property {() => void} requestPreview
 * @property {() => void} scheduleProcess
 */

/**
 * Owns pick mode, the loupe and preview, the picked-color markers, and marker
 * dragging. Palette edits are committed through the palette editor so history and
 * markers stay in one place.
 *
 * @param {PalettePickerDeps} deps
 */
export function createPalettePicker(deps) {
  const { app, state, pickState, canvasView, paletteEditor } = deps;

  const frame = /** @type {HTMLElement} */ (document.getElementById('canvas-frame'));
  const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('view-canvas'));
  const pickPreview = document.getElementById('palette-pick-preview');
  const pickPreviewSwatch = document.getElementById('palette-pick-swatch');
  const pickPreviewHex = document.getElementById('palette-pick-hex');
  const pickLoupe = document.getElementById('palette-pick-loupe');
  const pickLoupeCanvas = /** @type {HTMLCanvasElement|null} */ (
    document.getElementById('palette-pick-canvas')
  );
  const pickLoupeHex = document.getElementById('palette-pick-loupe-hex');

  /** @type {ReturnType<typeof createPickedMarkers>|null} */
  let view = null;
  if (deps.host) {
    view = createPickedMarkers({
      host: deps.host,
      toFramePoint: (u, v) => canvasView.imagePointToFrame(u, v),
      onSelect: selectPickedMarker,
      onDragStart: startPickedMarkerDrag,
      onDragMove: movePickedMarkerDrag,
      onDragEnd: endPickedMarkerDrag,
      onDragCancel: cancelPickedMarkerDrag,
      onNudge: nudgePickedMarker,
    });
  }

  function start() {
    if (!state.editMode || !app.hasResult || app.exportBusy) return;
    pickState.active = true;
    paletteEditor.setPickPressed(true);
    frame.classList.add('is-picking');
    paletteEditor.refreshHint();
    hidePickPreview();
    hidePickLoupe();
    paletteEditor.updatePaletteEditor();
  }

  function stop() {
    if (!pickState.active) return;
    pickState.active = false;
    paletteEditor.setPickPressed(false);
    frame.classList.remove('is-picking');
    if (pickState.pointerId !== null) {
      if (canvas.hasPointerCapture(pickState.pointerId)) {
        canvas.releasePointerCapture(pickState.pointerId);
      }
      pickState.pointerId = null;
    }
    hidePickPreview();
    hidePickLoupe();
    paletteEditor.refreshHint();
    paletteEditor.updatePaletteEditor();
  }

  function cancelDrag() {
    view?.cancelDrag();
  }

  function hidePickPreview() {
    if (pickPreview) pickPreview.hidden = true;
  }

  function hidePickLoupe() {
    if (pickLoupe) pickLoupe.hidden = true;
  }

  /**
   * Draw a magnified crop around the sampled pixel. The extra context makes touch
   * picking possible: the finger no longer covers the only visible sample.
   * @param {{ color: { r:number,g:number,b:number,a:number }, source: { data: Uint8ClampedArray, width:number, height:number }, x:number, y:number }} sample
   */
  function drawPickLoupe(sample) {
    if (!pickLoupeCanvas) return;
    const ctx = pickLoupeCanvas.getContext('2d');
    if (!ctx) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const pixels = Math.round(PICK_LOUPE_SIZE * dpr);
    if (pickLoupeCanvas.width !== pixels || pickLoupeCanvas.height !== pixels) {
      pickLoupeCanvas.width = pixels;
      pickLoupeCanvas.height = pixels;
    }
    ctx.setTransform(pixels / PICK_LOUPE_SIZE, 0, 0, pixels / PICK_LOUPE_SIZE, 0, 0);
    ctx.clearRect(0, 0, PICK_LOUPE_SIZE, PICK_LOUPE_SIZE);

    const { source, x, y } = sample;
    for (let dy = -PICK_LOUPE_RADIUS; dy <= PICK_LOUPE_RADIUS; dy++) {
      for (let dx = -PICK_LOUPE_RADIUS; dx <= PICK_LOUPE_RADIUS; dx++) {
        const sourceX = x + dx;
        const sourceY = y + dy;
        if (sourceX < 0 || sourceY < 0 || sourceX >= source.width || sourceY >= source.height) {
          continue;
        }
        const offset = (sourceY * source.width + sourceX) * 4;
        const alpha = source.data[offset + 3];
        if (alpha === 0) continue;
        ctx.fillStyle = `rgba(${source.data[offset]}, ${source.data[offset + 1]}, ${source.data[offset + 2]}, ${alpha / 255})`;
        ctx.fillRect(
          (dx + PICK_LOUPE_RADIUS) * PICK_LOUPE_CELL,
          (dy + PICK_LOUPE_RADIUS) * PICK_LOUPE_CELL,
          PICK_LOUPE_CELL,
          PICK_LOUPE_CELL,
        );
      }
    }

    const styles = getComputedStyle(document.documentElement);
    const accent = styles.getPropertyValue('--peiq-accent').trim();
    if (accent) ctx.strokeStyle = accent;
    ctx.lineWidth = 2;
    const center = PICK_LOUPE_RADIUS * PICK_LOUPE_CELL;
    ctx.strokeRect(center + 1, center + 1, PICK_LOUPE_CELL - 2, PICK_LOUPE_CELL - 2);
    const mid = PICK_LOUPE_SIZE / 2;
    ctx.beginPath();
    ctx.moveTo(mid, 0);
    ctx.lineTo(mid, center - 3);
    ctx.moveTo(mid, center + PICK_LOUPE_CELL + 3);
    ctx.lineTo(mid, PICK_LOUPE_SIZE);
    ctx.moveTo(0, mid);
    ctx.lineTo(center - 3, mid);
    ctx.moveTo(center + PICK_LOUPE_CELL + 3, mid);
    ctx.lineTo(PICK_LOUPE_SIZE, mid);
    ctx.stroke();
  }

  /** @param {number} clientX @param {number} clientY */
  function positionPickLoupe(clientX, clientY) {
    if (!pickLoupe) return;
    const rect = pickLoupe.getBoundingClientRect();
    const gap = 18;
    const margin = 8;
    let left = clientX - rect.width / 2;
    let top = clientY - rect.height - gap;
    if (top < margin) top = clientY + gap;
    left = Math.min(Math.max(margin, left), window.innerWidth - rect.width - margin);
    top = Math.min(Math.max(margin, top), window.innerHeight - rect.height - margin);
    pickLoupe.style.left = `${Math.round(left)}px`;
    pickLoupe.style.top = `${Math.round(top)}px`;
  }

  /** @param {PointerEvent} event */
  function updatePickLoupe(event) {
    if (!pickLoupe) return;
    const sample = canvasView.pickSample(event.clientX, event.clientY);
    if (!sample || sample.color.a === 0) {
      hidePickLoupe();
      return;
    }
    drawPickLoupe(sample);
    if (pickLoupeHex) pickLoupeHex.textContent = formatHex(sample.color);
    pickLoupe.hidden = false;
    positionPickLoupe(event.clientX, event.clientY);
  }

  /** @param {PointerEvent} event */
  function updatePickPreview(event) {
    if (!pickState.active) return;
    const color = canvasView.pickColor(event.clientX, event.clientY);
    if (!color || color.a === 0) {
      hidePickPreview();
      return;
    }
    const hex = formatHex(color);
    if (pickPreviewSwatch) pickPreviewSwatch.style.setProperty('--pick-color', hex);
    if (pickPreviewHex) pickPreviewHex.textContent = hex;
    if (!pickPreview) return;

    pickPreview.hidden = false;
    const gap = 14;
    const rect = pickPreview.getBoundingClientRect();
    let left = event.clientX + gap;
    let top = event.clientY + gap;
    if (left + rect.width > window.innerWidth - 8) {
      left = event.clientX - rect.width - gap;
    }
    if (top + rect.height > window.innerHeight - 8) {
      top = event.clientY - rect.height - gap;
    }
    pickPreview.style.left = `${Math.max(8, Math.round(left))}px`;
    pickPreview.style.top = `${Math.max(8, Math.round(top))}px`;
  }

  /** @param {PointerEvent} event */
  function updatePickFeedback(event) {
    if (!pickState.active) return;
    if (pickState.pointerId !== null) {
      updatePickLoupe(event);
      hidePickPreview();
    } else {
      updatePickPreview(event);
      hidePickLoupe();
    }
  }

  /**
   * @param {number} id
   * @param {{ r:number,g:number,b:number,a:number }} color
   * @returns {boolean}
   */
  function hasDuplicatePaletteColor(id, color) {
    return app.palette.some(
      (entry) =>
        entry.id !== id &&
        entry.color.r === color.r &&
        entry.color.g === color.g &&
        entry.color.b === color.b &&
        entry.color.a === color.a,
    );
  }

  /** Remove markers for entries that no longer exist or became transparent. */
  function prunePickedMarkers() {
    const ids = new Set(app.palette.map((entry) => entry.id));
    for (const id of pickState.markers.keys()) {
      if (!ids.has(id)) pickState.markers.delete(id);
    }
    const transparent = paletteEditor.currentTransparentId();
    if (transparent !== null) pickState.markers.delete(transparent);
    if (pickState.pendingPoint && app.palette.length === 0) pickState.pendingPoint = null;
  }

  function renderMarkers() {
    if (!view) return;
    prunePickedMarkers();
    view.render({
      entries: app.palette,
      markers: pickState.markers,
      selectedId: state.selectedId,
      active: state.editMode && app.hasResult && !app.exportBusy,
    });
  }

  /** @param {number} id */
  function selectPickedMarker(id) {
    const entry = app.palette.find((candidate) => candidate.id === id);
    if (!entry) return;
    state.selectedId = id;
    pickState.pendingPoint = null;
    paletteEditor.setHexInput(entry.hex);
    paletteEditor.renderCurrentPalette();
  }

  /**
   * @param {number} id
   * @param {PointerEvent} event
   */
  function startPickedMarkerDrag(id, event) {
    if (!state.editMode || app.exportBusy) return;
    const entry = app.palette.find((candidate) => candidate.id === id);
    if (!entry) return;
    pickState.drag = { id, before: paletteEditor.paletteSnapshot(), moved: false };
    pickState.pendingPoint = null;
    hidePickPreview();
    updatePickLoupe(event);
  }

  /**
   * @param {number} id
   * @param {PointerEvent} event
   */
  function movePickedMarkerDrag(id, event) {
    if (!pickState.drag || pickState.drag.id !== id) return;
    const sample = canvasView.pickSample(event.clientX, event.clientY);
    if (!sample || sample.color.a === 0) {
      hidePickLoupe();
      return;
    }
    pickState.drag.moved = true;
    pickState.markers.set(id, normalizePickPoint(sample));
    paletteEditor.setPaletteEntryColorLive(id, sample.color);
    updatePickLoupe(event);
    deps.scheduleProcess();
  }

  /**
   * @param {number} id
   * @param {PointerEvent} event
   * @param {boolean} moved
   */
  function endPickedMarkerDrag(id, event, moved) {
    if (!pickState.drag || pickState.drag.id !== id) return;
    const transaction = pickState.drag;
    pickState.drag = null;
    hidePickLoupe();
    if (!moved) {
      paletteEditor.renderCurrentPalette();
      return;
    }
    const sample = canvasView.pickSample(event.clientX, event.clientY);
    if (!sample || sample.color.a === 0) {
      paletteEditor.restorePaletteSnapshot(transaction.before);
      toastKey(
        sample ? 'toast.pickTransparent' : 'toast.pickOutside',
        {},
        'error',
      );
      return;
    }
    if (hasDuplicatePaletteColor(id, sample.color)) {
      paletteEditor.restorePaletteSnapshot(transaction.before);
      toastKey('error.duplicateColor', {}, 'error');
      return;
    }
    pickState.markers.set(id, normalizePickPoint(sample));
    paletteEditor.setPaletteEntryColorLive(id, sample.color);
    paletteEditor.renderCurrentPalette();
    deps.requestPreview();
    paletteEditor.pushPaletteHistory(transaction.before);
    toastKey('toast.colorUpdated', {}, 'success');
  }

  /** @param {number} id */
  function cancelPickedMarkerDrag(id) {
    if (!pickState.drag || pickState.drag.id !== id) return;
    const transaction = pickState.drag;
    pickState.drag = null;
    hidePickLoupe();
    paletteEditor.restorePaletteSnapshot(transaction.before);
  }

  /**
   * @param {number} id
   * @param {string} key
   * @param {number} step
   */
  function nudgePickedMarker(id, key, step) {
    if (!state.editMode || app.exportBusy) return;
    const point = pickState.markers.get(id);
    if (!point) return;
    const dx = key === 'ArrowLeft' ? -step : key === 'ArrowRight' ? step : 0;
    const dy = key === 'ArrowUp' ? -step : key === 'ArrowDown' ? step : 0;
    if (dx === 0 && dy === 0) return;
    const nextPoint = {
      u: Math.min(1, Math.max(0, point.u + dx)),
      v: Math.min(1, Math.max(0, point.v + dy)),
    };
    const color = canvasView.pickColorAtImagePoint(nextPoint.u, nextPoint.v);
    if (!color || color.a === 0) return;
    const before = paletteEditor.paletteSnapshot();
    try {
      app.palette = updatePaletteEntry(app.palette, id, formatHex(color));
      pickState.markers.set(id, nextPoint);
      state.selectedId = id;
      paletteEditor.setHexInput(formatHex(color));
      paletteEditor.markPaletteEdited();
      paletteEditor.renderCurrentPalette();
      deps.requestPreview();
      paletteEditor.pushPaletteHistory(before);
    } catch (error) {
      toast(localizeError(error), 'error');
    }
  }

  /** @param {PointerEvent} event */
  function handleCanvasPick(event) {
    if (!pickState.active || pickState.pointerId !== null) return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    pickState.pointerId = event.pointerId;
    canvas.setPointerCapture(event.pointerId);
    updatePickFeedback(event);
  }

  /** @param {PointerEvent} event */
  function handlePickEnd(event) {
    if (!pickState.active || pickState.pointerId !== event.pointerId) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    pickState.pointerId = null;
    if (canvas.hasPointerCapture(event.pointerId)) {
      canvas.releasePointerCapture(event.pointerId);
    }
    const sample = canvasView.pickSample(event.clientX, event.clientY);
    hidePickPreview();
    hidePickLoupe();
    if (!sample) {
      toastKey('toast.pickOutside', {}, 'error');
      return;
    }
    if (sample.color.a === 0) {
      toastKey('toast.pickTransparent', {}, 'error');
      return;
    }
    const color = sample.color;
    // Keep Pick armed after a successful sample so several swatches can be
    // recolored without pressing the button again. Pick toggles off, and Esc
    // still stops the mode.
    paletteEditor.setHexInput(formatHex(color));
    if (paletteEditor.selectedPaletteEntry()) {
      paletteEditor.applyPaletteHex(normalizePickPoint(sample));
    } else {
      pickState.pendingPoint = normalizePickPoint(sample);
      toastKey('toast.picked', { hex: formatHex(color) }, 'success');
    }
  }

  /** @param {PointerEvent} event */
  function handlePickCancel(event) {
    if (pickState.pointerId !== event.pointerId) return;
    pickState.pointerId = null;
    hidePickPreview();
    hidePickLoupe();
  }

  function bindEvents() {
    canvas.addEventListener('pointerdown', handleCanvasPick, { capture: true });
    canvas.addEventListener('pointerup', handlePickEnd, { capture: true });
    canvas.addEventListener('pointercancel', handlePickCancel, { capture: true });
    canvas.addEventListener('lostpointercapture', handlePickCancel);
    frame.addEventListener('pointermove', updatePickFeedback);
    frame.addEventListener('pointerleave', () => {
      if (pickState.pointerId === null) {
        hidePickPreview();
        hidePickLoupe();
      }
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && pickState.drag) {
        event.preventDefault();
        view?.cancelDrag();
        return;
      }
      if (event.key === 'Escape' && pickState.active) {
        event.preventDefault();
        stop();
      }
    });
  }

  return {
    bindEvents,
    cancelDrag,
    renderMarkers,
    start,
    stop,
  };
}
