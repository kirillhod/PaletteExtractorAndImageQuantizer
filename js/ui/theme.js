// @ts-check
import { normalizeThemeMode, resolveTheme, nextThemeMode } from '../core/theme-mode.js';
import { t } from './i18n.js';

const STORAGE_KEY = 'peiq.theme';

/**
 * @param {'auto'|'light'|'dark'} mode
 * @returns {'light'|'dark'}
 */
function effectiveTheme(mode) {
  const prefersDark = Boolean(window.matchMedia?.('(prefers-color-scheme: dark)')?.matches);
  return resolveTheme(mode, prefersDark);
}

/**
 * @returns {'auto'|'light'|'dark'}
 */
function readMode() {
  return normalizeThemeMode(document.documentElement.getAttribute('data-theme-mode'));
}

/**
 * @param {'auto'|'light'|'dark'} mode
 * @param {{ persist?: boolean, announce?: boolean }} [options]
 */
function applyMode(mode, options = {}) {
  const { persist = true, announce = true } = options;
  const root = document.documentElement;
  const theme = effectiveTheme(mode);

  root.classList.add('peiq-theme-switching');
  root.setAttribute('data-theme', theme);
  root.setAttribute('data-theme-mode', mode);

  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', theme === 'light' ? '#f5f5f5' : '#1c1e22');

  const button = /** @type {HTMLButtonElement|null} */ (document.getElementById('theme-toggle'));
  if (button) {
    button.setAttribute('data-mode', mode);
    button.setAttribute('aria-label', labelFor(mode));
  }

  if (persist) {
    try {
      window.localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      // localStorage may be unavailable; auto remains the fallback.
    }
  }

  if (announce) {
    const live = document.getElementById('live-region');
    if (live) {
      live.textContent = t('theme.announce', {
        mode: t(`theme.mode.${mode}`),
        theme: t(`theme.name.${theme}`),
      });
    }
  }

  window.requestAnimationFrame(() => {
    root.classList.remove('peiq-theme-switching');
  });
}

/**
 * @param {'auto'|'light'|'dark'} mode
 */
function labelFor(mode) {
  return t(`theme.label.${mode}`);
}

export function initTheme() {
  const button = /** @type {HTMLButtonElement|null} */ (document.getElementById('theme-toggle'));
  applyMode(readMode(), { persist: false, announce: false });

  button?.addEventListener('click', () => {
    applyMode(nextThemeMode(readMode()));
  });

  const media = window.matchMedia?.('(prefers-color-scheme: dark)');
  media?.addEventListener?.('change', () => {
    if (readMode() === 'auto') applyMode('auto', { persist: false, announce: false });
  });

  window.addEventListener('peiqq:localechange', () => {
    if (button) button.setAttribute('aria-label', labelFor(readMode()));
  });

  return {
    cycle() {
      applyMode(nextThemeMode(readMode()));
    },
    getMode: readMode,
  };
}
