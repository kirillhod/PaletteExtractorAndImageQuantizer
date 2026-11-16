// @ts-check

/** @typedef {'extract'|'map'} UrlMode */
/** @typedef {'popularity'|'median-cut'|'wu'|'octree'|'kmeans'} UrlMethod */
/** @typedef {'oklab'|'srgb'} UrlSpace */
/** @typedef {'none'|'floyd-steinberg'|'atkinson'|'stucki'|'jarvis'|'burkes'|'sierra'|'bayer2'|'bayer4'|'bayer8'|'blue-noise'} UrlDither */
/** @typedef {'source'|'manual'|'hue-asc'|'hue-desc'|'lightness-asc'|'lightness-desc'|'perceptual'|'perceptual-path'|'perceptual-flow'} UrlSort */

/**
 * @typedef {Object} UrlState
 * @property {UrlMode} mode
 * @property {UrlMethod} method
 * @property {number} colors
 * @property {UrlSpace} space
 * @property {string} palette
 * @property {UrlDither} dither
 * @property {number} strength
 * @property {boolean} serpentine
 * @property {number} edgeStop
 * @property {number} alphaThreshold
 * @property {number} transparentIndex
 * @property {UrlSort} sortOrder
 */

export const URL_VERSION = 1;

/** @type {UrlState} */
export const URL_DEFAULTS = {
  mode: 'extract',
  method: 'wu',
  colors: 16,
  space: 'oklab',
  palette: 'pico-8',
  dither: 'none',
  strength: 80,
  serpentine: true,
  edgeStop: 50,
  alphaThreshold: 128,
  transparentIndex: -1,
  sortOrder: 'source',
};

const METHODS = new Set(['popularity', 'median-cut', 'wu', 'octree', 'kmeans']);
const SPACES = new Set(['oklab', 'srgb']);
const DITHERS = new Set([
  'none',
  'floyd-steinberg',
  'atkinson',
  'stucki',
  'jarvis',
  'burkes',
  'sierra',
  'bayer2',
  'bayer4',
  'bayer8',
  'blue-noise',
]);
const SORTS = new Set([
  'source',
  'manual',
  'hue-asc',
  'hue-desc',
  'lightness-asc',
  'lightness-desc',
  'perceptual',
  'perceptual-path',
  'perceptual-flow',
]);
const PALETTE_ID = /^[a-z0-9][a-z0-9-]{0,39}$/;

/**
 * Serialize settings for the URL hash. Defaults are omitted; image data is never
 * represented. The key order is fixed for stable URLs.
 *
 * @param {UrlState} state
 * @returns {string} hash without `#`, starting with `v=1`
 */
export function encodeUrlState(state) {
  const normalized = normalizeState(state);
  /** @type {[string,string][]} */
  const pairs = [['v', String(URL_VERSION)]];

  const add = (key, value, fallback) => {
    if (String(value) !== String(fallback)) pairs.push([key, String(value)]);
  };

  add('mode', normalized.mode, URL_DEFAULTS.mode);
  add('method', normalized.method, URL_DEFAULTS.method);
  add('colors', normalized.colors, URL_DEFAULTS.colors);
  add('space', normalized.space, URL_DEFAULTS.space);
  add('palette', normalized.palette, URL_DEFAULTS.palette);
  add('dither', normalized.dither, URL_DEFAULTS.dither);
  add('strength', normalized.strength, URL_DEFAULTS.strength);
  if (normalized.serpentine !== URL_DEFAULTS.serpentine) {
    pairs.push(['serpentine', normalized.serpentine ? '1' : '0']);
  }
  add('edge', normalized.edgeStop, URL_DEFAULTS.edgeStop);
  add('alpha', normalized.alphaThreshold, URL_DEFAULTS.alphaThreshold);
  add('transparent', normalized.transparentIndex, URL_DEFAULTS.transparentIndex);
  add('sort', normalized.sortOrder, URL_DEFAULTS.sortOrder);

  return pairs.map(([key, value]) => `${key}=${encodeURIComponent(value)}`).join('&');
}

/**
 * Parse a location hash (with or without a leading `#`) into validated state.
 * Unknown keys and image fields are ignored.
 *
 * @param {string} hash
 * @returns {UrlState}
 */
export function decodeUrlState(hash) {
  const text = String(hash ?? '').replace(/^#/, '');
  const params = new URLSearchParams(text);
  const pick = (key, fallback) => params.get(key) ?? fallback;
  const number = (key, fallback, min, max) => {
    const raw = params.get(key);
    if (raw === null) return fallback;
    const value = Number(raw);
    return Number.isFinite(value) ? Math.min(max, Math.max(min, Math.round(value))) : fallback;
  };

  return normalizeState({
    mode: pick('mode', URL_DEFAULTS.mode),
    method: pick('method', URL_DEFAULTS.method),
    colors: number('colors', URL_DEFAULTS.colors, 2, 256),
    space: pick('space', URL_DEFAULTS.space),
    palette: pick('palette', URL_DEFAULTS.palette),
    dither: pick('dither', URL_DEFAULTS.dither),
    strength: number('strength', URL_DEFAULTS.strength, 0, 100),
    serpentine: pick('serpentine', URL_DEFAULTS.serpentine ? '1' : '0') !== '0',
    edgeStop: number('edge', URL_DEFAULTS.edgeStop, 0, 100),
    alphaThreshold: number('alpha', URL_DEFAULTS.alphaThreshold, 0, 255),
    transparentIndex: number('transparent', URL_DEFAULTS.transparentIndex, -1, 255),
    sortOrder: pick('sort', URL_DEFAULTS.sortOrder),
  });
}

/**
 * @param {Partial<UrlState>} state
 * @returns {UrlState}
 */
function normalizeState(state) {
  return {
    mode: state.mode === 'map' ? 'map' : 'extract',
    method: METHODS.has(String(state.method)) ? /** @type {UrlMethod} */ (state.method) : URL_DEFAULTS.method,
    colors: clampInt(state.colors, 2, 256, URL_DEFAULTS.colors),
    space: SPACES.has(String(state.space)) ? /** @type {UrlSpace} */ (state.space) : URL_DEFAULTS.space,
    palette:
      typeof state.palette === 'string' && PALETTE_ID.test(state.palette)
        ? state.palette
        : URL_DEFAULTS.palette,
    dither: DITHERS.has(String(state.dither)) ? /** @type {UrlDither} */ (state.dither) : URL_DEFAULTS.dither,
    strength: clampInt(state.strength, 0, 100, URL_DEFAULTS.strength),
    serpentine: state.serpentine !== false,
    edgeStop: clampInt(state.edgeStop, 0, 100, URL_DEFAULTS.edgeStop),
    alphaThreshold: clampInt(state.alphaThreshold, 0, 255, URL_DEFAULTS.alphaThreshold),
    transparentIndex: clampInt(state.transparentIndex, -1, 255, URL_DEFAULTS.transparentIndex),
    sortOrder: SORTS.has(String(state.sortOrder))
      ? /** @type {UrlSort} */ (state.sortOrder)
      : URL_DEFAULTS.sortOrder,
  };
}

/**
 * @param {unknown} value
 * @param {number} min
 * @param {number} max
 * @param {number} fallback
 */
function clampInt(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, Math.round(number)));
}
