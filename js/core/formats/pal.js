// @ts-check
/** @typedef {import('../types.js').RGBA8} RGBA8 */

/**
 * Parse a JASC `.pal` palette.
 * @param {string} text
 * @returns {{ colors: RGBA8[], names: (string|null)[] }}
 */
export function parsePalPalette(text) {
  const lines = text.split(/\r?\n/).map((line) => line.trim());
  if (lines[0] !== 'JASC-PAL') throw new Error('not a JASC palette (missing JASC-PAL)');
  if (lines[1] !== '0100') throw new Error(`unsupported JASC version: ${lines[1] ?? 'missing'}`);

  const count = Number(lines[2]);
  if (!Number.isInteger(count) || count < 1 || count > 256) {
    throw new Error('invalid JASC palette count');
  }

  /** @type {RGBA8[]} */
  const colors = [];
  for (let i = 0; i < count; i++) {
    const line = lines[3 + i];
    if (!line) throw new Error(`missing JASC color ${i + 1}`);
    const match = line.match(/^(\d{1,3})\s+(\d{1,3})\s+(\d{1,3})$/);
    if (!match) throw new Error(`invalid JASC color: ${line}`);
    const r = Number(match[1]);
    const g = Number(match[2]);
    const b = Number(match[3]);
    if (r > 255 || g > 255 || b > 255) throw new Error(`invalid JASC color: ${line}`);
    colors.push({ r, g, b, a: 255 });
  }

  return { colors, names: colors.map(() => null) };
}

/**
 * @param {RGBA8[]} colors
 */
export function formatPalPalette(colors) {
  return [
    'JASC-PAL',
    '0100',
    String(colors.length),
    ...colors.map((color) => `${color.r} ${color.g} ${color.b}`),
    '',
  ].join('\n');
}
