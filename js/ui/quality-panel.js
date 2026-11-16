// @ts-check
import { el } from './dom.js';
import { t, tp } from './i18n.js';

/**
 * @typedef {Object} QualityDeps
 * @property {() => Worker} getWorker
 * @property {() => number} nextRequestId
 * @property {() => any} getApp
 * @property {() => any} getCanvasView
 */

/**
 * Owns the Quality panel: request lifecycle, stats rendering, the error map, and
 * the locale refresh. The preview pipeline cancels the panel through `reset` so a
 * stale measurement can never describe the previous image.
 *
 * @param {QualityDeps} deps
 */
export function createQualityPanel(deps) {
  const qaRun = /** @type {HTMLButtonElement|null} */ (document.getElementById('qa-run'));
  const qaStatus = document.getElementById('qa-status');
  const qaStats = document.getElementById('qa-stats');
  const qaMean = document.getElementById('qa-mean');
  const qaP95 = document.getElementById('qa-p95');
  const qaMax = document.getElementById('qa-max');
  const qaErrorField = document.getElementById('qa-error-field');
  const qaErrorToggle = /** @type {HTMLInputElement|null} */ (
    document.getElementById('qa-error-toggle')
  );
  const qaWorst = document.getElementById('qa-worst');

  /** @type {any|null} */
  let result = null;
  let requestId = 0;
  let busy = false;
  let failed = false;
  // The user's intent, not the checkbox or the map buffers: it survives a preview
  // reset so a settings or palette change re-measures and redraws the overlay.
  let mapOn = false;
  // A slider drag produces a preview every few hundred ms. Waiting a little after the
  // last one keeps the synchronous CIEDE2000 pass from delaying the next preview.
  let measureTimer = 0;
  const AUTO_MEASURE_DELAY = 350;

  function cancelAutoMeasure() {
    if (!measureTimer) return;
    clearTimeout(measureTimer);
    measureTimer = 0;
  }

  /**
   * Mirror `mapOn` and `result` onto the toggle, the map, and the markers.
   */
  function applyMap() {
    if (qaErrorToggle) qaErrorToggle.checked = mapOn;
    // Keep the toggle reachable while a re-measure is pending, even without stats.
    if (qaErrorField) qaErrorField.hidden = !mapOn && !result;
    if (!mapOn || !result) {
      clearMap();
      return;
    }
    const view = deps.getCanvasView();
    if (!view) return;
    view.setErrorMap(result.errorMap);
    view.setWorstPixels(result.worstPixels);
  }

  /** @param {boolean} on */
  function setMapIntent(on) {
    mapOn = on;
    if (!on) cancelAutoMeasure();
    applyMap();
  }

  function updateAvailability() {
    if (!qaRun) return;
    const app = deps.getApp();
    qaRun.disabled =
      !app.hasResult || !app.reduced || app.palette.length === 0 || busy || app.exportBusy;
  }

  /**
   * Drop the current measurement but keep the user's error-map intent, so a new
   * preview of the same image can re-measure and redraw it.
   * @param {{ disable?: boolean }} [options]
   */
  function reset(options = {}) {
    cancelAutoMeasure();
    if (requestId) {
      deps.getWorker().postMessage({ type: 'cancel', requestId });
      requestId = 0;
    }
    busy = false;
    failed = false;
    result = null;
    if (qaStats) qaStats.hidden = true;
    if (qaErrorToggle) qaErrorToggle.checked = mapOn;
    if (qaErrorField) qaErrorField.hidden = !mapOn;
    clearMap();
    if (qaWorst) {
      qaWorst.hidden = true;
      qaWorst.replaceChildren();
    }
    if (qaStatus) qaStatus.textContent = t('quality.statusInitial');
    updateAvailability();
    if (options.disable && qaRun) qaRun.disabled = true;
  }

  function run() {
    const app = deps.getApp();
    if (!app.preview || !app.reduced || busy || app.palette.length === 0) return;
    reset();
    const id = deps.nextRequestId();
    requestId = id;
    busy = true;
    failed = false;
    if (qaStatus) qaStatus.textContent = t('quality.statusMeasuring');
    updateAvailability();
    const original = new Uint8ClampedArray(app.preview.data);
    const mapped = new Uint8ClampedArray(app.reduced.data);
    deps.getWorker().postMessage(
      {
        type: 'qa',
        requestId: id,
        width: app.preview.width,
        height: app.preview.height,
        original: { data: original.buffer },
        mapped: { data: mapped.buffer },
      },
      [original.buffer, mapped.buffer],
    );
  }

  function render() {
    if (!result) return;
    if (qaStats) qaStats.hidden = false;
    if (qaMean) qaMean.textContent = result.deltaE00Mean.toFixed(2);
    if (qaP95) qaP95.textContent = result.deltaE00P95.toFixed(2);
    if (qaMax) qaMax.textContent = result.deltaE00Max.toFixed(2);
    if (qaErrorField) qaErrorField.hidden = false;
    applyMap();
    if (qaWorst) {
      qaWorst.hidden = false;
      qaWorst.replaceChildren();
      qaWorst.append(el('p', { className: 'peiq-label', text: t('quality.worst') }));
      result.worstPixels.forEach((pixel, index) => {
        const row = el('div', { className: 'peiq-qa-worst__row' });
        row.append(
          el('span', { className: 'peiq-qa-worst__rank', text: String(index + 1) }),
          el('span', { text: `${pixel.x}, ${pixel.y}` }),
          el('span', { text: pixel.deltaE00.toFixed(2) }),
        );
        qaWorst.append(row);
      });
    }
    if (qaStatus) {
      qaStatus.textContent = t('quality.statusMeasured', {
        countLabel: tp('count.pixels', result.pixels, { count: result.pixels }),
      });
    }
    updateAvailability();
  }

  function clearMap() {
    const view = deps.getCanvasView();
    view?.setErrorMap(null);
    view?.setWorstPixels(null);
  }

  function showMap() {
    if (!qaErrorToggle) return;
    setMapIntent(qaErrorToggle.checked);
  }

  function toggleMap() {
    if (!qaErrorToggle) return;
    // Before the first measurement the only meaningful action is to turn a pending
    // overlay off; enabling it without stats has nothing to draw.
    if (!result && !mapOn) return;
    const section = document.getElementById('qa-section');
    if (section) /** @type {HTMLDetailsElement} */ (section).open = true;
    setMapIntent(!mapOn);
  }

  /**
   * Called after a preview result. The error map is a persistent overlay: if it is
   * on, measure the new preview and put the map back without a click. The short delay
   * lets a slider drag settle so only the last preview is measured.
   */
  function autoMeasure() {
    if (!mapOn || result) return;
    cancelAutoMeasure();
    measureTimer = setTimeout(() => {
      measureTimer = 0;
      if (!mapOn || result) return;
      if (busy) {
        autoMeasure();
        return;
      }
      run();
    }, AUTO_MEASURE_DELAY);
  }

  /**
   * Apply a worker `quality` message. Returns false when it belongs to a stale request.
   * @param {any} message
   * @returns {boolean}
   */
  function handleMessage(message) {
    if (message.requestId !== requestId) return false;
    busy = false;
    failed = false;
    result = {
      ...message.result,
      errorMap: {
        data: new Uint8ClampedArray(message.result.errorMap.data),
        width: message.result.errorMap.width,
        height: message.result.errorMap.height,
      },
    };
    render();
    return true;
  }

  /** @param {number} id */
  function matches(id) {
    return id === requestId;
  }

  function fail() {
    busy = false;
    failed = true;
    if (qaStatus) qaStatus.textContent = t('quality.statusFailed');
    updateAvailability();
  }

  function refreshLabels() {
    if (!qaStatus) return;
    if (busy) qaStatus.textContent = t('quality.statusMeasuring');
    else if (failed) qaStatus.textContent = t('quality.statusFailed');
    else if (result) {
      qaStatus.textContent = t('quality.statusMeasured', {
        countLabel: tp('count.pixels', result.pixels, { count: result.pixels }),
      });
    } else qaStatus.textContent = t('quality.statusInitial');
    if (result && qaWorst) {
      const label = qaWorst.querySelector('.peiq-label');
      if (label) label.textContent = t('quality.worst');
    }
  }

  function clearIntent() {
    mapOn = false;
    cancelAutoMeasure();
    applyMap();
  }

  qaRun?.addEventListener('click', run);
  qaErrorToggle?.addEventListener('change', showMap);

  return {
    autoMeasure,
    clearIntent,
    fail,
    handleMessage,
    matches,
    refreshLabels,
    reset,
    run,
    showMap,
    toggleMap,
    updateAvailability,
  };
}
