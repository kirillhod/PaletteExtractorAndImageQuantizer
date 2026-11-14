// @ts-check
import { parseHex } from '../color.js';
import { paletteHash } from '../palette.js';
import { ALGORITHM_VERSION, APP_VERSION } from '../version.js';

/** @typedef {import('../types.js').RGBA8} RGBA8 */
/** @typedef {import('../types.js').Palette} Palette */

/**
 * Parse the native palette JSON. Also accepts a plain array of hex strings or
 * `{hex}` / `{rgb}` objects for convenience.
 * @param {string|unknown} input
 * @returns {{ colors: RGBA8[], names: (string|null)[], name: string|null }}
 */
export function parsePaletteJson(input) {
  const data = typeof input === 'string' ? JSON.parse(input) : input;
  if (Array.isArray(data)) {
    return {
      colors: data.map((entry) => parseEntry(entry).color),
      names: data.map((entry) => parseEntry(entry).name),
      name: null,
    };
  }
  if (!data || typeof data !== 'object') throw new Error('invalid palette JSON');

  /** @type {any} */
  const root = data;
  if (root.format !== undefined && root.format !== 'peiq/palette') {
    throw new Error(`unsupported palette JSON format: ${String(root.format)}`);
  }
  if (root.version !== undefined && root.version !== 1) {
    throw new Error(`unsupported palette JSON version: ${String(root.version)}`);
  }
  if (!Array.isArray(root.entries)) throw new Error('palette JSON is missing entries');

  const parsed = root.entries.map((entry) => parseEntry(entry));
  const colors = parsed.map((entry) => entry.color);
  const names = parsed.map((entry) => entry.name);
  return {
    colors,
    names,
    name: root.meta?.name ?? root.name ?? null,
  };
}

/**
 * @param {unknown} entry
 * @returns {{ color: RGBA8, name: string|null }}
 */
function parseEntry(entry) {
  if (typeof entry === 'string') {
    return { color: parseHex(entry), name: null };
  }
  if (!entry || typeof entry !== 'object') throw new Error('invalid palette entry');

  /** @type {any} */
  const value = entry;
  if (typeof value.hex === 'string') {
    return { color: parseHex(value.hex), name: value.name ?? null };
  }
  if (Array.isArray(value.rgb) && value.rgb.length >= 3) {
    const r = Number(value.rgb[0]);
    const g = Number(value.rgb[1]);
    const b = Number(value.rgb[2]);
    const a = value.alpha === undefined ? 255 : Number(value.alpha);
    if (![r, g, b, a].every((channel) => Number.isFinite(channel) && channel >= 0 && channel <= 255)) {
      throw new Error('invalid RGB(A) palette entry');
    }
    return { color: { r, g, b, a }, name: value.name ?? null };
  }
  throw new Error('palette entry needs hex or rgb');
}

/**
 * Serialize the native palette JSON. Async because the palette hash uses WebCrypto
 * when available.
 *
 * @param {Palette} palette
 * @param {{ name?: string, order?: string, space?: string }} [options]
 * @returns {Promise<string>}
 */
export async function formatPaletteJson(palette, options = {}) {
  const order = options.order ?? 'source';
  const space = options.space ?? 'oklab';
  const entries = palette.map((entry) => ({
    id: entry.id,
    index: entry.index,
    hex: entry.hex,
    rgb: [entry.color.r, entry.color.g, entry.color.b],
    alpha: entry.color.a,
    ...(entry.name ? { name: entry.name } : {}),
  }));
  const payload = {
    format: 'peiq/palette',
    version: 1,
    meta: {
      name: options.name ?? 'palette',
      tool: APP_VERSION,
      algorithmVersion: ALGORITHM_VERSION,
    },
    order,
    space,
    entries,
    hash: await paletteHash(palette, { order, space }),
  };
  return `${JSON.stringify(payload, null, 2)}\n`;
}
