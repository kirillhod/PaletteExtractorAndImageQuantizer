// @ts-check
const STORAGE_KEY = 'peiq.theme';
/** @type {const} */
const MODES = ['auto', 'light', 'dark'];

/**
 * @param {string|null|undefined} value
 * @returns {'auto'|'light'|'dark'}
 */
function normalizeMode(value) {
  return value === 'light' || value === 'dark' ? value : 'auto';
}

/**
 * @returns {'auto'|'light'|'dark'}
 */
function readMode() {
  return normalizeMode(document.documentElement.getAttribute('data-theme-mode'));
}

/**
 * @param {'auto'|'light'|'dark'} mode
 * @returns {'light'|'dark'}
 */
function effectiveTheme(mode) {
  if (mode !== 'auto') return mode;
  return window.matchMedia?.('(prefers-color-scheme: dark)')?.matches ? 'dark' : 'light';
}

/**
 * @param {'auto'|'light'|'dark'} mode
 * @returns {'auto'|'light'|'dark'}
 */
function nextMode(mode) {
  return MODES[(MODES.indexOf(mode) + 1) % MODES.length];
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
    if (live) live.textContent = `Theme: ${mode} (${theme}).`;
  }

  window.requestAnimationFrame(() => {
    root.classList.remove('peiq-theme-switching');
  });
}

/**
 * @param {'auto'|'light'|'dark'} mode
 */
function labelFor(mode) {
  if (mode === 'auto') {
    return 'Theme: automatic (follows system). Activate for light theme.';
  }
  if (mode === 'light') {
    return 'Theme: light. Activate for dark theme.';
  }
  return 'Theme: dark. Activate for automatic theme.';
}

export function initTheme() {
  const button = /** @type {HTMLButtonElement|null} */ (document.getElementById('theme-toggle'));
  applyMode(readMode(), { persist: false, announce: false });

  button?.addEventListener('click', () => {
    applyMode(nextMode(readMode()));
  });

  const media = window.matchMedia?.('(prefers-color-scheme: dark)');
  media?.addEventListener?.('change', () => {
    if (readMode() === 'auto') applyMode('auto', { persist: false, announce: false });
  });

  return {
    cycle() {
      applyMode(nextMode(readMode()));
    },
    getMode: readMode,
  };
}
