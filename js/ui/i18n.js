// @ts-check
import { MESSAGES } from '../content/messages.js';
import {
  DEFAULT_LOCALE,
  formatMessage,
  formatNumber,
  formatPlural,
  nextLocaleMode,
  normalizeLocaleMode,
  resolveLocale,
} from '../core/i18n.js';

const STORAGE_KEY = 'peiq.locale';
const EVENT_NAME = 'peiqq:localechange';

/** @type {import('../core/i18n.js').LocaleMode} */
let mode = 'auto';
/** @type {import('../core/i18n.js').Locale} */
let locale = DEFAULT_LOCALE;
let initialized = false;

/**
 * @returns {import('../core/i18n.js').LocaleMode}
 */
function readMode() {
  try {
    return normalizeLocaleMode(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    return 'auto';
  }
}

/**
 * @returns {readonly string[]}
 */
function browserLanguages() {
  if (Array.isArray(navigator.languages) && navigator.languages.length > 0) {
    return navigator.languages;
  }
  return navigator.language ? [navigator.language] : [];
}

/** @returns {import('../core/i18n.js').Locale} */
export function getLocale() {
  return locale;
}

/** @returns {import('../core/i18n.js').LocaleMode} */
export function getLocaleMode() {
  return mode;
}

/**
 * @param {string} key
 * @param {Record<string, unknown>} [params]
 * @returns {string}
 */
export function t(key, params = {}) {
  return formatMessage(MESSAGES, locale, key, params);
}

/**
 * @param {string} baseKey
 * @param {number} count
 * @param {Record<string, unknown>} [params]
 * @returns {string}
 */
export function tp(baseKey, count, params = {}) {
  return formatPlural(MESSAGES, locale, baseKey, count, params);
}

/**
 * @param {number} value
 * @param {number} [maximumFractionDigits]
 * @returns {string}
 */
export function formatN(value, maximumFractionDigits = 1) {
  return formatNumber(locale, value, maximumFractionDigits);
}

/**
 * @param {string} baseKey
 * @param {number} count
 * @returns {string}
 */
export function countLabel(baseKey, count) {
  return tp(baseKey, count, { count });
}

/**
 * Apply translations to annotations in the static HTML.
 * @param {ParentNode} [root]
 */
export function translateStatic(root = document) {
  for (const node of root.querySelectorAll('[data-i18n]')) {
    const key = node.getAttribute('data-i18n');
    if (key) node.textContent = t(key);
  }
  for (const node of root.querySelectorAll('[data-i18n-aria-label]')) {
    const key = node.getAttribute('data-i18n-aria-label');
    if (key) node.setAttribute('aria-label', t(key));
  }
  for (const node of root.querySelectorAll('[data-i18n-title]')) {
    const key = node.getAttribute('data-i18n-title');
    if (key) node.setAttribute('title', t(key));
  }
  for (const node of root.querySelectorAll('[data-i18n-content]')) {
    const key = node.getAttribute('data-i18n-content');
    if (key) node.setAttribute('content', t(key));
  }
  for (const node of root.querySelectorAll('[data-i18n-placeholder]')) {
    const key = node.getAttribute('data-i18n-placeholder');
    if (key) node.setAttribute('placeholder', t(key));
  }
  for (const node of root.querySelectorAll('[data-i18n-tooltip]')) {
    const key = node.getAttribute('data-i18n-tooltip');
    if (!key) continue;
    const text = t(key);
    node.setAttribute('data-tooltip', text);
    if (!node.hasAttribute('data-i18n-aria-label')) {
      node.setAttribute('aria-label', text);
    }
  }
}

/**
 * @param {import('../core/i18n.js').LocaleMode} next
 * @param {{ persist?: boolean, announce?: boolean }} [options]
 */
export function setLocaleMode(next, options = {}) {
  const { persist = true, announce = true } = options;
  mode = normalizeLocaleMode(next);
  locale = resolveLocale(mode, browserLanguages());
  const root = document.documentElement;
  root.lang = locale;
  root.setAttribute('data-locale', locale);
  root.setAttribute('data-locale-mode', mode);

  if (persist) {
    try {
      window.localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      // The selected language still applies for this page.
    }
  }

  translateStatic(document);
  updateLocaleToggle();

  if (announce) {
    const live = document.getElementById('live-region');
    if (live) {
      live.textContent = t('locale.announce', {
        language: t(`locale.language.${locale}`),
      });
    }
  }

  window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: { locale, mode } }));
}

function updateLocaleToggle() {
  const button = /** @type {HTMLButtonElement|null} */ (
    document.getElementById('locale-toggle')
  );
  if (!button) return;
  const language = t(`locale.language.${locale}`);
  button.dataset.mode = mode;
  button.textContent = t(`locale.short.${mode}`);
  button.setAttribute('aria-label', t(`locale.label.${mode}`, { language }));
  button.setAttribute('title', t(`locale.label.${mode}`, { language }));
}

export function cycleLocale() {
  setLocaleMode(nextLocaleMode(mode));
}

/**
 * Resolve the stored preference and auto-detected language before the first render.
 */
export function initI18n() {
  if (initialized) return;
  initialized = true;
  mode = readMode();
  locale = resolveLocale(mode, browserLanguages());

  const button = /** @type {HTMLButtonElement|null} */ (
    document.getElementById('locale-toggle')
  );
  button?.addEventListener('click', cycleLocale);

  window.addEventListener('languagechange', () => {
    if (mode === 'auto') setLocaleMode('auto', { persist: false });
  });

  setLocaleMode(mode, { persist: false, announce: false });
}

/**
 * Map common core and import errors to localized text. Unknown errors keep their
 * original message so diagnostics are not lost.
 * @param {unknown} error
 * @returns {string}
 */
export function localizeError(error) {
  const message =
    error instanceof Error ? error.message : String(error ?? '').trim();
  if (!message) return t('error.unknown');
  if (message in EXACT_ERRORS) return t(EXACT_ERRORS[message]);
  for (const pattern of ERROR_PATTERNS) {
    const match = pattern.re.exec(message);
    if (match) return t(pattern.key, pattern.params(match));
  }
  return message;
}

/**
 * Localize validation summaries produced by the core pipeline and palette export.
 * Unknown details stay in their original form.
 * @param {string|undefined|null} detail
 * @returns {string}
 */
export function localizeDetail(detail) {
  const text = typeof detail === 'string' ? detail : '';
  if (!text) return t('status.unknownValidationError');
  if (text === 'decoded image is empty') return t('validation.emptyDecoded');
  if (text === 'indexed PNG dimensions do not match') {
    return t('validation.indexedDimensions');
  }

  let match = /^(\d+) colors · (\d+)×(\d+) · exact$/.exec(text);
  if (match) {
    return `${tp('count.colors', Number(match[1]))} · ${match[2]}×${match[3]} · ${t(
      'validation.exact',
    )}`;
  }

  match = /^(\d+) colors · (\d+)-bit indexed · exact$/.exec(text);
  if (match) {
    return `${tp('count.colors', Number(match[1]))} · ${t('validation.indexed', {
      bits: match[2],
    })} · ${t('validation.exact')}`;
  }

  match = /^(\d+)×(\d+) · palette compliant$/.exec(text);
  if (match) {
    return `${match[1]}×${match[2]} · ${t('validation.paletteCompliant')}`;
  }

  match = /^pixel (\d+) does not match palette$/.exec(text);
  if (match) return t('validation.pixelNotMatchPalette', { index: match[1] });

  match = /^pixel (\d+) is outside the palette$/.exec(text);
  if (match) return t('validation.pixelOutsidePalette', { index: match[1] });

  match = /^pixel (\d+) alpha does not match the index map$/.exec(text);
  if (match) return t('validation.pixelAlphaMismatch', { index: match[1] });

  match = /^pixel (\d+) does not match the index map$/.exec(text);
  if (match) return t('validation.pixelIndexMismatch', { index: match[1] });

  match = /^decoded (\d+)×(\d+), expected (\d+)×(\d+)$/.exec(text);
  if (match) {
    return t('validation.decodedSize', {
      width: match[1],
      height: match[2],
      expectedWidth: match[3],
      expectedHeight: match[4],
    });
  }

  match = /^(\d+) colors · \.([a-z0-9]+) · RGB exact(; alpha not stored by GPL)?$/.exec(
    text,
  );
  if (match) {
    const colors = tp('count.colors', Number(match[1]));
    return (
      t('validation.paletteColorsRoundTrip', {
        countLabel: colors,
        format: match[2],
      }) + (match[3] ? t('validation.paletteAlphaNote') : '')
    );
  }

  match = /^read (\d+) colors, expected (\d+)$/.exec(text);
  if (match) {
    return t('validation.paletteCountMismatch', {
      read: match[1],
      expected: match[2],
    });
  }

  match = /^color (\d+) does not round-trip$/.exec(text);
  if (match) return t('validation.paletteColorMismatch', { index: match[1] });

  return text;
}

/** @type {Record<string, string>} */
const EXACT_ERRORS = {
  'palette must not be empty': 'error.paletteEmpty',
  'palette entry not found': 'error.paletteEntryMissing',
  'locked color cannot be removed': 'error.lockedRemove',
  'palette must keep at least one color': 'error.paletteKeepOne',
  'locked color cannot be moved': 'error.lockedMove',
  'locked color blocks this move': 'error.lockedBlock',
  'color already exists in the palette': 'error.duplicateColor',
  'PNG palette file is missing bytes': 'error.palettePngBytes',
  'ASE palette import arrives in M3; use .gpl, .pal, .hex, .json or a PNG strip':
    'error.paletteAseUnsupported',
  'palette file is missing text': 'error.paletteTextMissing',
  'palette PNG must be exactly 1 pixel tall or 1 pixel wide':
    'error.palettePngShape',
  'palette PNG must contain 1..256 colors': 'error.palettePngCount',
  'palette must contain 1..256 colors': 'error.paletteCount',
  'palette contains an invalid color channel': 'error.paletteChannel',
  'not a GIMP palette (missing "GIMP Palette" header)': 'error.gplHeader',
  'invalid palette JSON': 'error.jsonInvalid',
  'palette JSON is missing entries': 'error.jsonEntries',
  'invalid palette entry': 'error.jsonEntry',
  'invalid RGB(A) palette entry': 'error.jsonRgb',
  'palette entry needs hex or rgb': 'error.jsonColor',
  'not a JASC palette (missing JASC-PAL)': 'error.jascHeader',
  'invalid JASC palette count': 'error.jascCount',
  'not a PNG: too short': 'error.pngSignatureShort',
  'not a PNG: bad signature': 'error.pngSignature',
  'PNG has invalid dimensions': 'error.pngDimensions',
  'interlaced PNG is not supported': 'error.pngInterlaced',
  '16-bit PNG is not supported': 'error.png16Bit',
  'PNG is missing a valid IHDR': 'error.pngIhdr',
  'PNG has no IDAT data': 'error.pngIdat',
  'truncated PNG chunk': 'error.pngTruncated',
  'indexed PNG is missing PLTE': 'error.pngPlte',
  'PNG palette index out of range': 'error.pngIndex',
};

/** @type {{ re: RegExp, key: string, params: (match: RegExpExecArray) => Record<string, string> }[]} */
const ERROR_PATTERNS = [
  {
    re: /^invalid hex color: (.+)$/,
    key: 'error.hexInvalid',
    params: (match) => ({ hex: match[1] }),
  },
  { re: /^palette is limited to \d+ colors$/, key: 'error.paletteFull', params: () => ({}) },
  {
    re: /^unsupported palette JSON format: (.+)$/,
    key: 'error.jsonFormat',
    params: (match) => ({ format: match[1] }),
  },
  {
    re: /^unsupported palette JSON version: (.+)$/,
    key: 'error.jsonVersion',
    params: (match) => ({ version: match[1] }),
  },
  {
    re: /^invalid GPL color: (.+)$/,
    key: 'error.gplColor',
    params: (match) => ({ line: match[1] }),
  },
  {
    re: /^unsupported JASC version: (.+)$/,
    key: 'error.jascVersion',
    params: (match) => ({ version: match[1] }),
  },
  {
    re: /^missing JASC color (\d+)$/,
    key: 'error.jascMissing',
    params: (match) => ({ index: match[1] }),
  },
  {
    re: /^invalid JASC color: (.+)$/,
    key: 'error.jascColor',
    params: (match) => ({ line: match[1] }),
  },
  {
    re: /^PNG CRC mismatch in (.+)$/,
    key: 'error.pngCrc',
    params: (match) => ({ type: match[1] }),
  },
];
