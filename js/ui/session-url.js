// @ts-check
import {
  SESSION_VERSION,
  cloneHistory,
  clonePalette,
  isValidSessionRecord,
} from '../core/session-state.js';
import { pickedMarkersToArray } from '../core/picked-markers.js';
import { decodeUrlState, encodeUrlState } from '../core/url-state.js';
import { BUILTIN_PALETTES } from '../core/palettes/builtin.js';
import { localizeError, t } from './i18n.js';
import { clearSession, loadSession, saveSession } from './session-store.js';
import { setStatusMessage, toastKey } from './status.js';

/**
 * @typedef {Object} SessionState
 * @property {boolean} applyingUrlState
 * @property {boolean} restoringSession
 * @property {boolean} persistence
 * @property {boolean} saveWarned
 * @property {string} statusKey
 */

/**
 * @typedef {Object} SessionUrlDeps
 * @property {any} app
 * @property {SessionState} session
 * @property {any} paletteState
 * @property {any} pickState
 * @property {any} paletteEditor
 * @property {() => string} getMode
 * @property {() => string} getSortOrder
 * @property {(order: string) => void} setSortOrder
 * @property {() => any} getLastFile
 * @property {(file: any) => void} setLastFile
 * @property {() => number} getLoadRequestId
 * @property {() => string} getFixedName
 * @property {() => string} getImportedName
 * @property {() => any} getControlsParams
 * @property {(next: 'extract'|'map') => void} setMode
 * @property {(file: File, restore?: any) => Promise<void>} loadFile
 * @property {() => void} updateDitherLabels
 * @property {() => void} updateDitherControls
 * @property {() => void} scheduleSessionSave
 */

/**
 * Owns URL-hash settings, the saved-session record, restore, and the session
 * status line. The app shell keeps the image and settings; this module only reads
 * them through callbacks and writes the shared state object.
 *
 * @param {SessionUrlDeps} deps
 */
export function createSessionUrl(deps) {
  const { app, session, paletteState, pickState, paletteEditor } = deps;

  const paletteSelect = /** @type {HTMLSelectElement|null} */ (
    document.getElementById('palette-select')
  );
  const ditherMethod = /** @type {HTMLSelectElement|null} */ (
    document.getElementById('dither-method')
  );
  const ditherStrength = /** @type {HTMLInputElement|null} */ (
    document.getElementById('dither-strength')
  );
  const ditherSerpentine = /** @type {HTMLInputElement|null} */ (
    document.getElementById('dither-serpentine')
  );
  const edgeStop = /** @type {HTMLInputElement|null} */ (
    document.getElementById('edge-stop')
  );
  const alphaThreshold = /** @type {HTMLInputElement|null} */ (
    document.getElementById('alpha-threshold')
  );
  const transparentIndex = /** @type {HTMLSelectElement|null} */ (
    document.getElementById('transparent-index')
  );
  const sortSelect = /** @type {HTMLSelectElement|null} */ (
    document.getElementById('palette-sort')
  );
  const sessionClear = /** @type {HTMLButtonElement|null} */ (
    document.getElementById('session-clear')
  );
  const sessionStatus = document.getElementById('session-status');

  function buildUrlState() {
    const params = deps.getControlsParams();
    const selectedPalette = paletteSelect?.value ?? 'pico-8';
    const palette = BUILTIN_PALETTES.some((entry) => entry.id === selectedPalette)
      ? selectedPalette
      : 'pico-8';
    return {
      mode: deps.getMode(),
      method: params.method,
      colors: params.colors,
      space: params.space,
      palette,
      dither: ditherMethod?.value || 'none',
      strength: Number(ditherStrength?.value ?? 80),
      serpentine: ditherSerpentine?.checked ?? true,
      edgeStop: Number(edgeStop?.value ?? 50),
      alphaThreshold: Number(alphaThreshold?.value ?? 128),
      transparentIndex: Number(transparentIndex?.value ?? -1),
      sortOrder: deps.getSortOrder(),
    };
  }

  function syncUrlState() {
    if (session.applyingUrlState) return;
    const hash = encodeUrlState(buildUrlState());
    const next = `${location.pathname}${location.search}#${hash}`;
    if (`${location.pathname}${location.search}${location.hash}` !== next) {
      window.history.replaceState(null, '', next);
    }
    deps.scheduleSessionSave();
  }

  function applyUrlState(state) {
    session.applyingUrlState = true;
    try {
      const method = /** @type {HTMLSelectElement|null} */ (
        document.getElementById('method')
      );
      const colors = /** @type {HTMLInputElement|null} */ (document.getElementById('colors'));
      const colorsNumber = /** @type {HTMLInputElement|null} */ (
        document.getElementById('colors-number')
      );
      const space = /** @type {HTMLSelectElement|null} */ (document.getElementById('space'));
      if (method) method.value = state.method;
      if (colors) colors.value = String(state.colors);
      if (colorsNumber) colorsNumber.value = String(state.colors);
      if (space) space.value = state.space;
      if (ditherMethod) ditherMethod.value = state.dither;
      if (ditherStrength) ditherStrength.value = String(state.strength);
      if (ditherSerpentine) ditherSerpentine.checked = state.serpentine;
      if (edgeStop) edgeStop.value = String(state.edgeStop);
      if (alphaThreshold) alphaThreshold.value = String(state.alphaThreshold);
      deps.setSortOrder(state.sortOrder);
      if (paletteSelect) paletteSelect.value = state.palette;

      deps.setMode(state.mode);
      paletteState.pendingTransparentIndex =
        state.mode === 'map' || state.transparentIndex >= 0
          ? state.transparentIndex
          : null;
      paletteEditor.renderCurrentPalette();
      deps.updateDitherLabels();
      deps.updateDitherControls();
    } finally {
      session.applyingUrlState = false;
    }
  }

  function buildSessionRecord() {
    const lastFile = deps.getLastFile();
    if (!lastFile) return null;
    return {
      version: SESSION_VERSION,
      image: {
        name: lastFile instanceof File ? lastFile.name : 'image',
        type: lastFile.type || 'application/octet-stream',
        size: lastFile.size,
      },
      state: {
        settings: buildUrlState(),
        paletteValue: paletteSelect?.value ?? 'pico-8',
        paletteName: deps.getFixedName() || deps.getImportedName() || '',
        palette: clonePalette(app.palette),
        paletteEdited: app.paletteEdited,
        sortOrder: deps.getSortOrder(),
        selectedId: paletteState.selectedId,
        transparentId: paletteEditor.currentTransparentId(),
        markers: pickedMarkersToArray(pickState.markers),
        editing: paletteState.editMode,
        history: cloneHistory(paletteState.history),
      },
    };
  }

  async function saveCurrentSession() {
    const lastFile = deps.getLastFile();
    if (session.restoringSession || !session.persistence || !lastFile || !app.hasResult) {
      return;
    }
    const file = lastFile;
    try {
      // Store bytes, not a File or Blob. Mobile browsers may not preserve a picked
      // file's backing data across a reload even when IndexedDB returns a Blob.
      const bytes = await file.arrayBuffer();
      if (deps.getLastFile() !== file || !session.persistence) return;
      if (bytes.byteLength === 0 || (file.size > 0 && bytes.byteLength !== file.size)) {
        throw new Error('saved image bytes are incomplete');
      }
      const record = buildSessionRecord();
      if (!record) return;
      record.image.bytes = bytes;
      record.image.size = bytes.byteLength;
      await saveSession(record);
      session.statusKey = 'session.saved';
      renderStatus();
    } catch (error) {
      if (!session.saveWarned) {
        session.saveWarned = true;
        toastKey(
          'toast.sessionSaveFailed',
          { detail: localizeError(error) },
          'error',
        );
      }
      session.persistence = false;
    }
  }

  function renderStatus() {
    if (sessionStatus && session.statusKey) {
      sessionStatus.textContent = t(session.statusKey);
    }
  }

  async function forgetSavedSession() {
    try {
      await clearSession();
      deps.setLastFile(null);
      session.persistence = false;
      session.statusKey = 'session.cleared';
      renderStatus();
      toastKey('toast.sessionCleared', {}, 'success');
    } catch (error) {
      toastKey(
        'toast.sessionClearFailed',
        { detail: localizeError(error) },
        'error',
      );
    }
  }

  async function initialize() {
    const restoreGuard = deps.getLoadRequestId();
    const hashState = decodeUrlState(location.hash);
    let record = null;
    try {
      record = await loadSession();
    } catch (error) {
      if (deps.getLoadRequestId() !== restoreGuard) return;
      session.persistence = false;
      toastKey(
        'toast.sessionUnavailable',
        { detail: localizeError(error) },
        'error',
      );
    }
    // Dropping an image while the session is being read is a newer user action.
    // Do not apply saved settings or start a restore that would replace it.
    if (deps.getLoadRequestId() !== restoreGuard) return;
    if (!record) {
      applyUrlState(hashState);
      return;
    }
    if (!isValidSessionRecord(record)) {
      clearSession().catch((error) => {
        toastKey(
          'toast.sessionResetFailed',
          { detail: localizeError(error) },
          'error',
        );
      });
      applyUrlState(hashState);
      return;
    }

    const sessionSettings = record.state.settings;
    const hashMatches =
      !location.hash || encodeUrlState(hashState) === encodeUrlState(sessionSettings);
    applyUrlState(hashMatches ? sessionSettings : hashState);
    session.restoringSession = true;
    let bytes = null;
    if (record.version === SESSION_VERSION) {
      bytes = record.image.bytes;
    } else if (record.image.blob instanceof Blob) {
      try {
        bytes = await record.image.blob.arrayBuffer();
      } catch {
        bytes = null;
      }
    }
    if (!(bytes instanceof ArrayBuffer) || bytes.byteLength === 0) {
      session.restoringSession = false;
      session.persistence = false;
      clearSession().catch((error) => {
        toastKey(
          'toast.sessionResetFailed',
          { detail: localizeError(error) },
          'error',
        );
      });
      toastKey('toast.sessionRestoreFailed', {}, 'error');
      setStatusMessage('status.sessionRestoreFailed');
      return;
    }
    const file = new File([bytes], record.image.name, {
      type: record.image.type || 'application/octet-stream',
    });
    await deps.loadFile(file, hashMatches ? record.state : null);
  }

  function bindEvents() {
    sessionClear?.addEventListener('click', forgetSavedSession);
    window.addEventListener('hashchange', () => {
      if (session.applyingUrlState) return;
      applyUrlState(decodeUrlState(location.hash));
    });
    // Read once so an existing session is restored before the first interaction.
    initialize();
  }

  return {
    applyUrlState,
    bindEvents,
    buildUrlState,
    buildSessionRecord,
    forgetSavedSession,
    initialize,
    renderStatus,
    saveCurrentSession,
    syncUrlState,
  };
}
