// @ts-check
/**
 * Locale resolution and message formatting. DOM-free so it runs under `node --test`.
 */

export const SUPPORTED_LOCALES = /** @type {const} */ (['en', 'ru']);
export const LOCALE_MODES = /** @type {const} */ (['auto', 'en', 'ru']);
export const DEFAULT_LOCALE = 'en';

/**
 * @typedef {'en'|'ru'} Locale
 * @typedef {'auto'|'en'|'ru'} LocaleMode
 * @typedef {Record<string, string>} MessageTable
 */

/**
 * @param {unknown} value
 * @returns {Locale|null}
 */
export function normalizeLocale(value) {
  const text = String(value ?? '').toLowerCase();
  if (text.startsWith('ru')) return 'ru';
  if (text.startsWith('en')) return 'en';
  return null;
}

/**
 * Pick the first supported language from a browser language list.
 * @param {readonly string[]} [languages]
 * @returns {Locale}
 */
export function detectLocale(languages = []) {
  for (const language of languages) {
    const locale = normalizeLocale(language);
    if (locale) return locale;
  }
  return DEFAULT_LOCALE;
}

/**
 * @param {LocaleMode|string} mode
 * @param {readonly string[]} [languages]
 * @returns {Locale}
 */
export function resolveLocale(mode, languages = []) {
  if (mode === 'en' || mode === 'ru') return mode;
  return detectLocale(languages);
}

/**
 * @param {LocaleMode|string} value
 * @returns {LocaleMode}
 */
export function normalizeLocaleMode(value) {
  return value === 'en' || value === 'ru' ? value : 'auto';
}

/**
 * @param {LocaleMode} mode
 * @returns {LocaleMode}
 */
export function nextLocaleMode(mode) {
  const index = LOCALE_MODES.indexOf(mode);
  return LOCALE_MODES[(index + 1) % LOCALE_MODES.length];
}

/**
 * @param {string} template
 * @param {Record<string, unknown>} [params]
 * @returns {string}
 */
export function interpolate(template, params = {}) {
  return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (match, key) => {
    const value = params[key];
    return value === undefined || value === null ? '' : String(value);
  });
}

/**
 * @param {Record<string, MessageTable>} messages
 * @param {Locale} locale
 * @param {string} key
 * @param {Record<string, unknown>} [params]
 * @returns {string}
 */
export function formatMessage(messages, locale, key, params = {}) {
  const table = messages[locale] ?? messages[DEFAULT_LOCALE];
  const fallback = messages[DEFAULT_LOCALE];
  const template = table[key] ?? fallback[key] ?? key;
  return interpolate(template, params);
}

/**
 * @param {Locale} locale
 * @param {number} count
 * @returns {string}
 */
export function pluralCategory(locale, count) {
  try {
    return new Intl.PluralRules(locale).select(count);
  } catch {
    return count === 1 ? 'one' : 'other';
  }
}

/**
 * @param {Record<string, MessageTable>} messages
 * @param {Locale} locale
 * @param {string} baseKey
 * @param {number} count
 * @param {Record<string, unknown>} [params]
 * @returns {string}
 */
export function formatPlural(messages, locale, baseKey, count, params = {}) {
  const category = pluralCategory(locale, count);
  const table = messages[locale] ?? messages[DEFAULT_LOCALE];
  const fallback = messages[DEFAULT_LOCALE];
  const key = `${baseKey}.${category}`;
  const template =
    table[key] ??
    table[`${baseKey}.other`] ??
    fallback[key] ??
    fallback[`${baseKey}.other`] ??
    table[baseKey] ??
    fallback[baseKey] ??
    baseKey;
  return interpolate(template, { ...params, count });
}

/**
 * Format a decimal with the locale separator (for MP values).
 * @param {Locale} locale
 * @param {number} value
 * @param {number} [maximumFractionDigits]
 * @returns {string}
 */
export function formatNumber(locale, value, maximumFractionDigits = 1) {
  try {
    return new Intl.NumberFormat(locale, { maximumFractionDigits }).format(value);
  } catch {
    return String(value);
  }
}
