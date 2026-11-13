// @ts-check
import { decodePng } from '../png/decode.js';
import { parseHexPalette } from '../formats/hex.js';
import { parseGplPalette } from '../formats/gpl.js';
import { parsePalPalette } from '../formats/pal.js';
import { parsePaletteJson } from '../formats/json.js';

/** @typedef {import('../types.js').RGBA8} RGBA8 */

/**
 * @typedef {Object} ImportedPalette
 * @property {string} name
 * @property {RGBA8[]} colors
 * @property {(string|null)[]} names
 * @property {string} format
 */

/**
 * @param {{ name:string, text?:string, bytes?:Uint8Array }} input
 * @returns {Promise<ImportedPalette>}
 */
export async function parsePaletteFile(input) {
  const name = input.name || 'palette';
  const extension = name.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] ?? '';
  const text = input.text;

  if (extension === 'png') {
    if (!input.bytes) throw new Error('PNG palette file is missing bytes');
    const decoded = await decodePng(input.bytes);
    const colors = colorsFromStrip(decoded);
    return { name, colors, names: colors.map(() => null), format: 'png' };
  }

  if (extension === 'ase') {
    throw new Error('ASE palette import arrives in M3; use .gpl, .pal, .hex, .json or a PNG strip');
  }

  if (text === undefined) throw new Error('palette file is missing text');

  if (extension === 'hex') {
    const parsed = parseHexPalette(text);
    return { name, colors: validateColors(parsed.colors), names: parsed.names, format: 'hex' };
  }
  if (extension === 'gpl') {
    const parsed = parseGplPalette(text);
    return { name, colors: validateColors(parsed.colors), names: parsed.names, format: 'gpl' };
  }
  if (extension === 'pal') {
    const parsed = parsePalPalette(text);
    return { name, colors: validateColors(parsed.colors), names: parsed.names, format: 'pal' };
  }
  if (extension === 'json') {
    const parsed = parsePaletteJson(text);
    return {
      name: parsed.name || name,
      colors: validateColors(parsed.colors),
      names: parsed.names,
      format: 'json',
    };
  }

  throw new Error(
    `unsupported palette format "${extension || 'unknown'}"; use .hex, .gpl, .pal, .json or a PNG strip`,
  );
}

/**
 * @param {{ width:number, height:number, data:Uint8ClampedArray }} decoded
 * @returns {RGBA8[]}
 */
function colorsFromStrip(decoded) {
  if (decoded.width !== 1 && decoded.height !== 1) {
    throw new Error('palette PNG must be exactly 1 pixel tall or 1 pixel wide');
  }
  const count = Math.max(decoded.width, decoded.height);
  if (count < 1 || count > 256) throw new Error('palette PNG must contain 1..256 colors');

  /** @type {RGBA8[]} */
  const colors = [];
  for (let i = 0; i < count; i++) {
    const offset = i * 4;
    colors.push({
      r: decoded.data[offset],
      g: decoded.data[offset + 1],
      b: decoded.data[offset + 2],
      a: decoded.data[offset + 3],
    });
  }
  return validateColors(colors);
}

/**
 * @param {RGBA8[]} colors
 * @returns {RGBA8[]}
 */
function validateColors(colors) {
  if (!Array.isArray(colors) || colors.length < 1 || colors.length > 256) {
    throw new Error('palette must contain 1..256 colors');
  }
  for (const color of colors) {
    for (const channel of [color.r, color.g, color.b, color.a]) {
      if (!Number.isFinite(channel) || channel < 0 || channel > 255) {
        throw new Error('palette contains an invalid color channel');
      }
    }
  }
  return colors;
}
