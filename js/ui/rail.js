// @ts-check
import { nextRailState, normalizeRailState } from '../core/rail-state.js';
import { t } from './i18n.js';

const STORAGE_KEY = 'peiq.rail';

/**
 * @returns {import('../core/rail-state.js').RailState}
 */
function readState() {
  return normalizeRailState(document.documentElement.getAttribute('data-rail'));
}

/**
 * @param {import('../core/rail-state.js').RailState} state
 * @returns {string}
 */
function labelFor(state) {
  return state === 'open' ? t('rail.hide') : t('rail.show');
}

/**
 * @param {import('../core/rail-state.js').RailState} state
 * @param {{ persist?: boolean, announce?: boolean }} [options]
 */
function applyState(state, options = {}) {
  const { persist = true, announce = true } = options;
  const button = /** @type {HTMLButtonElement|null} */ (document.getElementById('rail-toggle'));
  document.documentElement.setAttribute('data-rail', state);

  if (button) {
    button.setAttribute('aria-expanded', String(state === 'open'));
    button.setAttribute('aria-label', labelFor(state));
    button.setAttribute('title', labelFor(state));
  }

  if (persist) {
    try {
      window.localStorage.setItem(STORAGE_KEY, state);
    } catch {
      // Storage can be unavailable; the rail stays usable for this visit.
    }
  }

  if (announce) {
    const live = document.getElementById('live-region');
    if (live) {
      live.textContent = t(state === 'open' ? 'rail.announce.shown' : 'rail.announce.hidden');
    }
  }
}

export function initRail() {
  const button = /** @type {HTMLButtonElement|null} */ (document.getElementById('rail-toggle'));
  applyState(readState(), { persist: false, announce: false });

  button?.addEventListener('click', () => {
    applyState(nextRailState(readState()));
  });

  window.addEventListener('peiqq:localechange', () => {
    if (button) {
      const label = labelFor(readState());
      button.setAttribute('aria-label', label);
      button.setAttribute('title', label);
    }
  });

  return {
    getState: readState,
    toggle() {
      applyState(nextRailState(readState()));
    },
    /** The toggle only makes sense once the workspace replaces the empty state. */
    setAvailable(/** @type {boolean} */ available) {
      if (button) button.hidden = !available;
    },
  };
}
