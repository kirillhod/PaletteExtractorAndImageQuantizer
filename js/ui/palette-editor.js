// @ts-check
import { formatHex } from '../core/color.js';
import {
  addPaletteEntry,
  movePaletteEntry,
  removePaletteEntry,
  setPaletteLock,
  sortPalette,
  updatePaletteEntry,
} from '../core/palette.js';
import { pickedMarkersFromArray, pickedMarkersToArray } from '../core/picked-markers.js';
import { countLabel, localizeError, t } from './i18n.js';
import { renderPalette } from './palette-view.js';
import { toast, toastKey } from './status.js';

/**
 * @typedef {Object} PaletteState
 * @property {boolean} editMode
 * @property {number|null} selectedId
 * @property {{ past: any[], future: any[], limit: number }} history
 * @property {{ u:number, v:number }|null} pendingPoint
 * @property {string} statusName
 * @property {number} statusCount
 * @property {{ kind:'imported'|'restored', name:string, count:number }|null} customOption
 * @property {number|null} pendingTransparentIndex
 * @property {boolean} pendingTransparentRemap
 */

/**
 * @typedef {Object} PickState
 * @property {boolean} active
 * @property {number|null} pointerId
 * @property {Map<number, {u:number,v:number}>} markers
 * @property {any|null} drag
 */

/**
 * @typedef {Object} PaletteEditorDeps
 * @property {any} app
 * @property {PaletteState} state
 * @property {PickState} pickState
 * @property {() => string} getSortOrder
 * @property {(order: string) => void} setSortOrder
 * @property {(hasPalette: boolean) => void} renderSortControls
 * @property {() => void} refreshPalettePreview
 * @property {() => any} getLastFile
 * @property {() => any} getSettings
 * @property {(settings:any) => void} applySettings
 * @property {() => void} onPaletteEdited
 * @property {() => void} requestPreview
 * @property {() => void} scheduleSessionSave
 * @property {() => void} syncUrlState
 * @property {() => void} clearDownloadLinks
 * @property {() => void} renderPickedMarkers
 * @property {() => void} stopPickMode
 * @property {() => void} startPickMode
 * @property {() => void} cancelMarkerDrag
 */

/**
 * Owns the palette strip, selection, editor controls, history, transparent index,
 * status text, and custom palette option. Picking and marker state stay in a shared
 * object so the picker can update colors without owning the palette model.
 *
 * @param {PaletteEditorDeps} deps
 */
export function createPaletteEditor(deps) {
  const { app, state, pickState } = deps;

  const paletteStrip = document.getElementById('palette-strip');
  const palettePanel = document.querySelector('.peiq-palette-panel');
  const paletteCount = document.getElementById('palette-count');
  const sortSelect = /** @type {HTMLSelectElement|null} */ (
    document.getElementById('palette-sort')
  );
  const paletteEdit = /** @type {HTMLButtonElement|null} */ (
    document.getElementById('palette-edit')
  );
  const paletteEditor = document.getElementById('palette-editor');
  const paletteEditorSlot = document.getElementById('palette-editor-slot');
  const paletteHex = /** @type {HTMLInputElement|null} */ (
    document.getElementById('palette-hex')
  );
  const paletteApply = /** @type {HTMLButtonElement|null} */ (
    document.getElementById('palette-apply')
  );
  const paletteAdd = /** @type {HTMLButtonElement|null} */ (
    document.getElementById('palette-add')
  );
  const paletteMoveLeft = /** @type {HTMLButtonElement|null} */ (
    document.getElementById('palette-move-left')
  );
  const paletteMoveRight = /** @type {HTMLButtonElement|null} */ (
    document.getElementById('palette-move-right')
  );
  const paletteRemove = /** @type {HTMLButtonElement|null} */ (
    document.getElementById('palette-remove')
  );
  const paletteLock = /** @type {HTMLButtonElement|null} */ (
    document.getElementById('palette-lock')
  );
  const palettePick = /** @type {HTMLButtonElement|null} */ (
    document.getElementById('palette-pick')
  );
  const paletteUndo = /** @type {HTMLButtonElement|null} */ (
    document.getElementById('palette-undo')
  );
  const paletteRedo = /** @type {HTMLButtonElement|null} */ (
    document.getElementById('palette-redo')
  );
  const paletteEditHint = document.getElementById('palette-edit-hint');
  const paletteHintPanel = document.getElementById('palette-hint-panel');
  const transparentIndex = /** @type {HTMLSelectElement|null} */ (
    document.getElementById('transparent-index')
  );
  const paletteStatus = document.getElementById('palette-status');
  const paletteSelect = /** @type {HTMLSelectElement|null} */ (
    document.getElementById('palette-select')
  );

  function renderPaletteStrip() {
    renderPalette(app.palette, paletteStrip, {
      editMode: state.editMode,
      selectedId: state.selectedId,
      onActivate: state.editMode ? selectPaletteEntry : null,
    });
    if (paletteCount) {
      paletteCount.textContent = countLabel('count.colors', app.palette.length);
    }
    deps.renderSortControls(app.palette.length > 0);
    deps.refreshPalettePreview();
  }

  /**
   * Update one entry without sorting the palette. Marker drag uses this on every
   * pointer move; the full sort and history commit happen once on release.
   *
   * @param {number} id
   * @param {{ r:number,g:number,b:number,a:number }} color
   */
  function setPaletteEntryColorLive(id, color) {
    const hex = formatHex(color);
    const entry = app.palette.find((candidate) => candidate.id === id);
    if (!entry || entry.hex === hex) return;
    app.palette = app.palette.map((candidate) =>
      candidate.id === id ? { ...candidate, color: { ...color }, hex } : candidate,
    );
    if (state.selectedId === id && paletteHex) paletteHex.value = hex;
    markPaletteEdited();
    renderPaletteStrip();
    deps.renderPickedMarkers();
  }

  function renderCurrentPalette() {
    app.palette = sortPalette(app.palette, deps.getSortOrder());
    if (
      state.selectedId !== null &&
      !app.palette.some((entry) => entry.id === state.selectedId)
    ) {
      state.selectedId = null;
      if (paletteHex) paletteHex.value = '';
    }
    const selected = selectedPaletteEntry();
    if (selected && paletteHex && document.activeElement !== paletteHex) {
      paletteHex.value = selected.hex;
    }
    renderPaletteStrip();
    updatePaletteEditor();

    const current = Number(transparentIndex?.value ?? -1);
    populateTransparentIndex(app.palette, current);
    deps.renderPickedMarkers();
    if (app.hasResult && deps.getLastFile()) deps.scheduleSessionSave();
  }

  /** @param {{ id:number, hex:string }} entry */
  function selectPaletteEntry(entry) {
    state.selectedId = entry.id;
    pickState.pendingPoint = null;
    if (paletteHex) paletteHex.value = entry.hex;
    renderCurrentPalette();
  }

  /**
   * Clear the edited palette entry. With no selection a Pick sample fills the HEX
   * field for Add instead of overwriting an existing color.
   */
  function clearPaletteSelection() {
    if (state.selectedId === null) return;
    state.selectedId = null;
    pickState.pendingPoint = null;
    if (paletteHex) paletteHex.value = '';
    renderCurrentPalette();
  }

  /** @returns {any|null} */
  function selectedPaletteEntry() {
    return app.palette.find((entry) => entry.id === state.selectedId) ?? null;
  }

  function updatePaletteEditor() {
    const selected = selectedPaletteEntry();
    const active = state.editMode && app.hasResult && app.palette.length > 0;
    if (paletteEdit) {
      // The pressed state, not the label, reports the mode. Swapping Edit for Done
      // changed the button width and rewrapped the palette bar, which resized the
      // canvas together with the editor.
      paletteEdit.textContent = t('palette.edit');
      paletteEdit.setAttribute('aria-pressed', String(state.editMode));
      paletteEdit.disabled = !app.hasResult || app.palette.length === 0 || app.exportBusy;
    }
    if (paletteEditorSlot) paletteEditorSlot.classList.toggle('is-open', active);
    if (paletteEditor) {
      paletteEditor.inert = !active;
      paletteEditor.setAttribute('aria-hidden', String(!active));
    }
    if (paletteHintPanel) paletteHintPanel.hidden = !active;
    if (paletteHex) paletteHex.disabled = app.exportBusy;
    if (palettePick) palettePick.disabled = !active || app.exportBusy;
    if (paletteApply) paletteApply.disabled = !selected || app.exportBusy;
    if (paletteAdd) {
      paletteAdd.disabled = !active || app.exportBusy || app.palette.length >= 256;
    }
    const position = selected
      ? app.palette.findIndex((entry) => entry.id === selected.id)
      : -1;
    const canMoveLeft =
      Boolean(selected) &&
      !selected.locked &&
      position > 0 &&
      !app.palette[position - 1].locked &&
      !app.exportBusy;
    const canMoveRight =
      Boolean(selected) &&
      !selected.locked &&
      position >= 0 &&
      position < app.palette.length - 1 &&
      !app.palette[position + 1].locked &&
      !app.exportBusy;
    if (paletteMoveLeft) paletteMoveLeft.disabled = !canMoveLeft;
    if (paletteMoveRight) paletteMoveRight.disabled = !canMoveRight;
    if (paletteRemove) {
      paletteRemove.disabled =
        !selected || selected.locked || app.palette.length <= 1 || app.exportBusy;
    }
    if (paletteLock) {
      paletteLock.disabled = !selected || app.exportBusy;
      const locked = Boolean(selected?.locked);
      const actionKey = locked ? 'palette.unlock' : 'palette.lock';
      paletteLock.setAttribute('aria-pressed', String(locked));
      paletteLock.setAttribute('data-i18n-aria-label', actionKey);
      paletteLock.setAttribute('data-i18n-title', actionKey);
      paletteLock.setAttribute('aria-label', t(actionKey));
      paletteLock.setAttribute('title', t(actionKey));
    }
    if (paletteUndo) {
      paletteUndo.disabled =
        !app.hasResult || app.exportBusy || state.history.past.length === 0;
    }
    if (paletteRedo) {
      paletteRedo.disabled =
        !app.hasResult || app.exportBusy || state.history.future.length === 0;
    }
  }

  /** @param {boolean} active */
  function setPaletteEditMode(active) {
    state.editMode = active;
    if (!active) {
      deps.cancelMarkerDrag();
      deps.stopPickMode();
      state.selectedId = null;
      pickState.pendingPoint = null;
      if (paletteHex) paletteHex.value = '';
    }
    renderCurrentPalette();
  }

  function currentTransparentId() {
    const position = Number(transparentIndex?.value ?? -1);
    return position >= 0 ? app.palette[position]?.id ?? null : null;
  }

  function paletteSnapshot() {
    return {
      palette: app.palette.map((entry) => ({ ...entry, color: { ...entry.color } })),
      sortOrder: deps.getSortOrder(),
      selectedId: state.selectedId,
      transparentId: currentTransparentId(),
      markers: pickedMarkersToArray(pickState.markers),
      paletteEdited: app.paletteEdited,
      settings: deps.getSettings(),
    };
  }

  /** @param {ReturnType<typeof paletteSnapshot>} snapshot */
  function pushPaletteHistory(snapshot) {
    state.history.past.push(snapshot);
    if (state.history.past.length > state.history.limit) state.history.past.shift();
    state.history.future.length = 0;
    updatePaletteEditor();
  }

  /** @param {ReturnType<typeof paletteSnapshot>} snapshot */
  function restorePaletteSnapshot(snapshot) {
    app.palette = snapshot.palette.map((entry) => ({
      ...entry,
      color: { ...entry.color },
    }));
    deps.setSortOrder(snapshot.sortOrder);
    state.selectedId = snapshot.selectedId;
    pickState.markers = pickedMarkersFromArray(snapshot.markers);
    pickState.pendingPoint = null;
    app.paletteEdited =
      typeof snapshot.paletteEdited === 'boolean' ? snapshot.paletteEdited : true;
    deps.onPaletteEdited();
    if (snapshot.settings) deps.applySettings(snapshot.settings);
    renderCurrentPalette();
    const selected = selectedPaletteEntry();
    if (paletteHex) paletteHex.value = selected?.hex ?? '';
    const position =
      snapshot.transparentId === null
        ? -1
        : app.palette.findIndex((entry) => entry.id === snapshot.transparentId);
    if (transparentIndex) {
      transparentIndex.value = position >= 0 ? String(position) : '-1';
    }
    deps.requestPreview();
    deps.syncUrlState();
  }

  function undoPaletteEdit() {
    if (!app.hasResult || app.exportBusy || state.history.past.length === 0) return;
    state.history.future.push(paletteSnapshot());
    const snapshot = state.history.past.pop();
    restorePaletteSnapshot(snapshot);
    toastKey('toast.undo', {}, 'success');
  }

  function redoPaletteEdit() {
    if (!app.hasResult || app.exportBusy || state.history.future.length === 0) return;
    state.history.past.push(paletteSnapshot());
    const snapshot = state.history.future.pop();
    restorePaletteSnapshot(snapshot);
    toastKey('toast.redo', {}, 'success');
  }

  function markPaletteEdited() {
    app.paletteEdited = true;
    deps.onPaletteEdited();
  }

  function resetPaletteEdits() {
    deps.cancelMarkerDrag();
    deps.stopPickMode();
    pickState.markers.clear();
    pickState.pendingPoint = null;
    pickState.drag = null;
    state.history.past.length = 0;
    state.history.future.length = 0;
    app.paletteEdited = false;
    state.editMode = false;
    state.selectedId = null;
    if (paletteHex) paletteHex.value = '';
    updatePaletteEditor();
  }

  /**
   * A new extraction replaces the color set, so the previous manual edits and
   * their markers no longer describe it. History keeps the editable state, so an
   * undo restores the palette, markers, and selection together with the settings.
   */
  function clearEditsForExtraction() {
    if (!app.paletteEdited && state.selectedId === null && pickState.markers.size === 0) {
      return;
    }
    deps.cancelMarkerDrag();
    deps.stopPickMode();
    pickState.markers.clear();
    pickState.pendingPoint = null;
    app.paletteEdited = false;
    state.selectedId = null;
    if (paletteHex) paletteHex.value = '';
    deps.renderPickedMarkers();
    renderCurrentPalette();
  }

  /** @returns {string} */
  function paletteHexValue() {
    return paletteHex?.value.trim() ?? '';
  }

  /** @param {string} value */
  function setHexInput(value) {
    if (paletteHex) paletteHex.value = value;
  }

  /**
   * @param {{ u:number, v:number }|null} [sample]
   */
  function applyPaletteHex(sample = null) {
    const selected = selectedPaletteEntry();
    if (!selected) return;
    const value = paletteHexValue();
    if (!value) {
      toastKey('toast.enterHex', {}, 'error');
      return;
    }
    try {
      const next = updatePaletteEntry(app.palette, selected.id, value);
      const before = paletteSnapshot();
      app.palette = next;
      if (sample) {
        if (selected.id === currentTransparentId()) pickState.markers.delete(selected.id);
        else pickState.markers.set(selected.id, sample);
      }
      const updated = app.palette.find((entry) => entry.id === selected.id);
      if (paletteHex && updated) paletteHex.value = updated.hex;
      markPaletteEdited();
      renderCurrentPalette();
      deps.requestPreview();
      pushPaletteHistory(before);
      toastKey('toast.colorUpdated', {}, 'success');
    } catch (error) {
      toast(localizeError(error), 'error');
    }
  }

  function addPaletteColor() {
    const value = paletteHexValue();
    if (!value) {
      toastKey('toast.enterHex', {}, 'error');
      return;
    }
    try {
      const next = addPaletteEntry(app.palette, value);
      const entry = next[next.length - 1];
      const before = paletteSnapshot();
      app.palette = next;
      state.selectedId = entry.id;
      if (pickState.pendingPoint && entry.id !== currentTransparentId()) {
        pickState.markers.set(entry.id, pickState.pendingPoint);
      }
      pickState.pendingPoint = null;
      if (paletteHex) paletteHex.value = entry.hex;
      markPaletteEdited();
      renderCurrentPalette();
      deps.requestPreview();
      pushPaletteHistory(before);
      toastKey('toast.colorAdded', { hex: entry.hex }, 'success');
    } catch (error) {
      toast(localizeError(error), 'error');
    }
  }

  function removePaletteColor() {
    const selected = selectedPaletteEntry();
    if (!selected) return;
    try {
      const next = removePaletteEntry(app.palette, selected.id);
      const before = paletteSnapshot();
      app.palette = next;
      pickState.markers.delete(selected.id);
      state.selectedId = null;
      if (paletteHex) paletteHex.value = '';
      markPaletteEdited();
      renderCurrentPalette();
      deps.requestPreview();
      pushPaletteHistory(before);
      toastKey('toast.colorRemoved', { hex: selected.hex }, 'success');
    } catch (error) {
      toast(localizeError(error), 'error');
    }
  }

  function togglePaletteLock() {
    const selected = selectedPaletteEntry();
    if (!selected) return;
    try {
      const next = setPaletteLock(app.palette, selected.id, !selected.locked);
      const before = paletteSnapshot();
      app.palette = next;
      markPaletteEdited();
      renderCurrentPalette();
      pushPaletteHistory(before);
      toastKey(
        selected.locked ? 'toast.unlocked' : 'toast.locked',
        { hex: selected.hex },
        'success',
      );
    } catch (error) {
      toast(localizeError(error), 'error');
    }
  }

  /** @param {'left'|'right'} direction */
  function moveSelectedPaletteEntry(direction) {
    const selected = selectedPaletteEntry();
    if (!selected) return;
    const transparentPosition = Number(transparentIndex?.value ?? -1);
    const transparentId =
      transparentPosition >= 0 ? app.palette[transparentPosition]?.id ?? null : null;
    try {
      const moved = movePaletteEntry(app.palette, selected.id, direction);
      const before = paletteSnapshot();
      deps.setSortOrder('manual');
      app.palette = moved;
      markPaletteEdited();
      renderCurrentPalette();
      if (transparentId !== null && transparentIndex) {
        const nextPosition = app.palette.findIndex((entry) => entry.id === transparentId);
        if (nextPosition >= 0) transparentIndex.value = String(nextPosition);
      }
      deps.requestPreview();
      pushPaletteHistory(before);
      updatePaletteEditor();
      deps.syncUrlState();
      toastKey(
        direction === 'left' ? 'toast.movedLeft' : 'toast.movedRight',
        { hex: selected.hex },
        'success',
      );
    } catch (error) {
      toast(localizeError(error), 'error');
    }
  }

  /**
   * @param {{ hex:string }[]} palette
   * @param {number} preferred
   */
  function populateTransparentIndex(palette, preferred) {
    if (!transparentIndex) return;
    transparentIndex.replaceChildren();
    const none = document.createElement('option');
    none.value = '-1';
    none.textContent = t('transparent.none');
    transparentIndex.append(none);
    palette.forEach((entry, index) => {
      const option = document.createElement('option');
      option.value = String(index);
      option.textContent = `${index} · ${entry.hex}`;
      transparentIndex.append(option);
    });
    transparentIndex.disabled = palette.length === 0;
    if (state.pendingTransparentIndex !== null && palette.length > 0) {
      const pending = state.pendingTransparentIndex;
      state.pendingTransparentIndex = null;
      transparentIndex.value =
        pending >= 0 && pending < palette.length ? String(pending) : '-1';
      if (app.hasResult) state.pendingTransparentRemap = true;
      return;
    }
    const valid = preferred >= 0 && preferred < palette.length;
    transparentIndex.value = valid ? String(preferred) : '-1';
  }

  /**
   * The palette name shown next to the count. Session saves use it so a restored
   * custom palette keeps its own name instead of the built-in selected at startup.
   * @returns {string}
   */
  function getPaletteName() {
    return state.statusName;
  }

  /**
   * @param {string} name
   * @param {number} count
   */
  function setPaletteStatus(name, count) {
    state.statusName = name;
    state.statusCount = count;
    renderPaletteStatus();
  }

  function renderPaletteStatus() {
    if (!paletteStatus || !state.statusName) return;
    paletteStatus.textContent = t('palette.status', {
      name: state.statusName,
      countLabel: countLabel('count.colors', state.statusCount),
    });
  }

  /**
   * @param {'imported'|'restored'} kind
   * @param {string} name
   * @param {number} count
   */
  function setCustomPaletteOption(kind, name, count) {
    state.customOption = { kind, name, count };
    renderCustomPaletteOption();
  }

  function renderCustomPaletteOption() {
    if (!paletteSelect || !state.customOption) return;
    const option = [...paletteSelect.options].find(
      (candidate) => candidate.value === 'imported',
    );
    if (!option) return;
    const key =
      state.customOption.kind === 'imported'
        ? 'palette.importedOption'
        : 'palette.restoredOption';
    option.textContent = t(key, {
      name: state.customOption.name,
      countLabel: countLabel('count.colors', state.customOption.count),
    });
  }

  function refreshHint() {
    if (!paletteEditHint) return;
    paletteEditHint.textContent = t(
      pickState.active ? 'palette.pickHint' : 'palette.editHint',
    );
  }

  /** @param {boolean} pressed */
  function setPickPressed(pressed) {
    palettePick?.setAttribute('aria-pressed', String(pressed));
  }

  function bindEvents() {
    sortSelect?.addEventListener('change', () => {
      deps.setSortOrder(sortSelect.value || 'source');
      renderCurrentPalette();
      deps.clearDownloadLinks();
      deps.syncUrlState();
    });

    paletteEdit?.addEventListener('click', () => setPaletteEditMode(!state.editMode));
    palettePanel?.addEventListener('click', (event) => {
      if (!state.editMode) return;
      const target = /** @type {Element|null} */ (event.target);
      // Any empty part of the palette card clears the selection, including the bar,
      // the strip gaps, and the editor row. Controls and swatches keep their action.
      if (target?.closest('button, input, select, textarea, label, a, .peiq-swatch')) return;
      clearPaletteSelection();
    });
    palettePanel?.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape' || !state.editMode || state.selectedId === null) return;
      if (pickState.active || pickState.drag) return;
      event.preventDefault();
      clearPaletteSelection();
    });
    paletteApply?.addEventListener('click', () => applyPaletteHex());
    paletteAdd?.addEventListener('click', addPaletteColor);
    paletteMoveLeft?.addEventListener('click', () => moveSelectedPaletteEntry('left'));
    paletteMoveRight?.addEventListener('click', () => moveSelectedPaletteEntry('right'));
    paletteRemove?.addEventListener('click', removePaletteColor);
    paletteLock?.addEventListener('click', togglePaletteLock);
    palettePick?.addEventListener('click', () => {
      if (pickState.active) deps.stopPickMode();
      else deps.startPickMode();
    });
    paletteUndo?.addEventListener('click', undoPaletteEdit);
    paletteRedo?.addEventListener('click', redoPaletteEdit);
    paletteHex?.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter') return;
      event.preventDefault();
      if (selectedPaletteEntry()) applyPaletteHex();
      else addPaletteColor();
    });
    paletteHex?.addEventListener('input', () => {
      pickState.pendingPoint = null;
    });
    document.addEventListener('keydown', (event) => {
      if (!app.hasResult || app.exportBusy) return;
      if (!(event.ctrlKey || event.metaKey) || event.altKey) return;
      const target = /** @type {HTMLElement|null} */ (event.target);
      // Text entry keeps its native undo; selects and sliders have none, so the
      // shared history still owns Ctrl/Cmd+Z there.
      const tag = target?.tagName;
      const inputType = tag === 'INPUT' ? /** @type {HTMLInputElement} */ (target).type : '';
      const isTextField =
        tag === 'TEXTAREA' ||
        Boolean(target?.isContentEditable) ||
        (tag === 'INPUT' &&
          inputType !== 'range' &&
          inputType !== 'checkbox' &&
          inputType !== 'radio' &&
          inputType !== 'button');
      if (isTextField) return;
      const key = event.key.toLowerCase();
      const code = event.code;
      if (code === 'KeyZ' || key === 'z') {
        event.preventDefault();
        if (event.shiftKey) redoPaletteEdit();
        else undoPaletteEdit();
      } else if (code === 'KeyY' || key === 'y') {
        event.preventDefault();
        redoPaletteEdit();
      }
    });
  }

  return {
    addPaletteColor,
    applyPaletteHex,
    bindEvents,
    clearEditsForExtraction,
    clearPaletteSelection,
    currentTransparentId,
    markPaletteEdited,
    moveSelectedPaletteEntry,
    paletteSnapshot,
    populateTransparentIndex,
    pushPaletteHistory,
    getPaletteName,
    refreshHint,
    removePaletteColor,
    renderCurrentPalette,
    renderCustomPaletteOption,
    renderPaletteStatus,
    renderPaletteStrip,
    resetPaletteEdits,
    restorePaletteSnapshot,
    redoPaletteEdit,
    selectPaletteEntry,
    selectedPaletteEntry,
    setCustomPaletteOption,
    setHexInput,
    setPaletteEditMode,
    setPaletteEntryColorLive,
    setPickPressed,
    setPaletteStatus,
    togglePaletteLock,
    undoPaletteEdit,
    updatePaletteEditor,
  };
}
