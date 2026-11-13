// @ts-check
/**
 * Built-in palettes. Values are factual hardware/community palettes; sources are listed
 * in IMPLEMENTATION_PLAN.md Appendix C.
 */

/**
 * @typedef {{ id:string, name:string, colors:string[] }} BuiltinPalette
 */

/** @type {BuiltinPalette[]} */
export const BUILTIN_PALETTES = [
  {
    id: 'pico-8',
    name: 'PICO-8',
    colors: [
      '#000000', '#1d2b53', '#7e2553', '#008751', '#ab5236', '#5f574f', '#c2c3c7',
      '#fff1e8', '#ff004d', '#ffa300', '#ffec27', '#00e436', '#29adff', '#83769c',
      '#ff77a8', '#ffccaa',
    ],
  },
  {
    id: 'gameboy-dmg',
    name: 'Game Boy DMG',
    colors: ['#0f380f', '#306230', '#8bac0f', '#9bbc0f'],
  },
  {
    id: 'c64',
    name: 'Commodore 64 (VICE)',
    colors: [
      '#000000', '#ffffff', '#880000', '#aaffee', '#cc44cc', '#00cc55', '#0000aa',
      '#eeee77', '#dd8855', '#664400', '#ff7777', '#333333', '#777777', '#aaff66',
      '#0088ff', '#bbbbbb',
    ],
  },
  {
    id: 'zx-spectrum',
    name: 'ZX Spectrum',
    colors: [
      '#000000', '#0000d7', '#d70000', '#d700d7', '#00d700', '#00d7d7', '#d7d700',
      '#d7d7d7', '#0000ff', '#ff0000', '#ff00ff', '#00ff00', '#00ffff', '#ffff00',
      '#ffffff',
    ],
  },
  {
    id: 'ega',
    name: 'EGA',
    colors: [
      '#000000', '#0000aa', '#00aa00', '#00aaaa', '#aa0000', '#aa00aa', '#aa5500',
      '#aaaaaa', '#555555', '#5555ff', '#55ff55', '#55ffff', '#ff5555', '#ff55ff',
      '#ffff55', '#ffffff',
    ],
  },
];

/**
 * @param {string} id
 * @returns {BuiltinPalette|undefined}
 */
export function getBuiltinPalette(id) {
  return BUILTIN_PALETTES.find((palette) => palette.id === id);
}
