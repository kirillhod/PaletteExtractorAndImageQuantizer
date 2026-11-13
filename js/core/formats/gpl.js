// @ts-check
/** @typedef {import('../types.js').RGBA8} RGBA8 */

/**
 * Parse a GIMP `.gpl` palette.
 * @param {string} text
 * @returns {{ colors: RGBA8[], names: (string|null)[] }}
 */
export function parseGplPalette(text) {
  /** @type {RGBA8[]} */
  const colors = [];
  /** @type {(string|null)[]} */
  const names = [];
  const lines = text.split(/\r?\n/);

  if (!/^GIMP Palette/i.test((lines[0] ?? '').trim())) {
    throw new Error('not a GIMP palette (missing "GIMP Palette" header)');
  }

  for (const rawLine of lines.slice(1)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const match = line.match(/^(\d{1,3})\s+(\d{1,3})\s+(\d{1,3})\s*(.*)$/);
    if (!match) continue;
    const r = Number(match[1]);
    const g = Number(match[2]);
    const b = Number(match[3]);
    if (r > 255 || g > 255 || b > 255) throw new Error(`invalid GPL color: ${line}`);
    colors.push({ r, g, b, a: 255 });
    names.push(match[4].trim() || null);
  }

  return { colors, names };
}

/**
 * @param {RGBA8[]} colors
 * @param {string} name
 * @param {(string|null)[]} [names]
 */
export function formatGplPalette(colors, name = 'Palette', names = []) {
  const rows = colors.map((color, index) => {
    const entryName = names[index] || `Color ${index + 1}`;
    return `${color.r} ${color.g} ${color.b}\t${entryName}`;
  });
  return ['GIMP Palette', `Name: ${name}`, 'Columns: 16', '#', ...rows, ''].join('\n');
}
