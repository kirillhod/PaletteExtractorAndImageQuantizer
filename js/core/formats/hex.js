// @ts-check
import { parseHex } from '../color.js';

/** @typedef {import('../types.js').RGBA8} RGBA8 */

/**
 * Parse a Lospec-style `.hex` list. Blank lines and `;` / `//` comments are ignored.
 * @param {string} text
 * @returns {{ colors: RGBA8[], names: (string|null)[] }}
 */
export function parseHexPalette(text) {
  /** @type {RGBA8[]} */
  const colors = [];
  /** @type {(string|null)[]} */
  const names = [];

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith(';') || line.startsWith('//')) continue;
    const match = line.match(/^#?([0-9a-fA-F]{3,8})\b/);
    if (!match) continue;
    // `#rrggbb` is the common case; parseHex also accepts #rgb/#rgba/#rrggbbaa.
    const color = parseHex(line.startsWith('#') ? match[0] : `#${match[1]}`);
    colors.push(color);
    const rest = line.slice(match[0].length).trim();
    names.push(rest || null);
  }

  return { colors, names };
}

/**
 * @param {RGBA8[]} colors
 * @param {{ alpha?: boolean }} [options]
 */
export function formatHexPalette(colors, options = {}) {
  const alpha = options.alpha ?? colors.some((color) => color.a < 255);
  return colors
    .map((color) => {
      const base = `#${hex(color.r)}${hex(color.g)}${hex(color.b)}`;
      return alpha ? `${base}${hex(color.a)}` : base;
    })
    .join('\n');
}

/**
 * @param {number} value
 */
function hex(value) {
  return Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, '0');
}
