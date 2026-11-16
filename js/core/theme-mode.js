// @ts-check
/** @typedef {'auto'|'light'|'dark'} ThemeMode */

/** @type {readonly ThemeMode[]} */
export const THEME_MODES = ['auto', 'light', 'dark'];

/**
 * @param {string|null|undefined} value
 * @returns {ThemeMode}
 */
export function normalizeThemeMode(value) {
  return value === 'light' || value === 'dark' ? value : 'auto';
}

/**
 * @param {ThemeMode} mode
 * @returns {ThemeMode}
 */
export function nextThemeMode(mode) {
  const safe = normalizeThemeMode(mode);
  return THEME_MODES[(THEME_MODES.indexOf(safe) + 1) % THEME_MODES.length];
}

/**
 * @param {ThemeMode} mode
 * @param {boolean} prefersDark
 * @returns {'light'|'dark'}
 */
export function resolveTheme(mode, prefersDark) {
  if (mode !== 'auto') return mode;
  return prefersDark ? 'dark' : 'light';
}
