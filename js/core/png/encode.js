// @ts-check
import { PNG_SIGNATURE, concatBytes, deflateZlib, makeChunk } from './chunks.js';

/**
 * Encode 8-bit RGBA pixels as a PNG (color type 6, filter 0).
 * @param {number} width
 * @param {number} height
 * @param {Uint8ClampedArray|Uint8Array} rgba
 * @returns {Promise<Uint8Array>}
 */
export async function encodeRgbaPng(width, height, rgba) {
  assertDimensions(width, height);
  if (rgba.length !== width * height * 4) {
    throw new RangeError('rgba length must be width * height * 4');
  }

  const rowBytes = width * 4;
  const raw = new Uint8Array((rowBytes + 1) * height);
  for (let y = 0; y < height; y++) {
    const target = y * (rowBytes + 1);
    raw[target] = 0;
    raw.set(rgba.subarray(y * rowBytes, (y + 1) * rowBytes), target + 1);
  }

  return encodeFromRaw(width, height, 8, 6, raw);
}

/**
 * Encode a palette strip. `Nx1` is horizontal (width N, height 1);
 * `1xN` is vertical (width 1, height N).
 * @param {{ r:number, g:number, b:number, a?:number }[]} colors
 * @param {{ orientation?: 'Nx1'|'1xN' }} [options]
 * @returns {Promise<Uint8Array>}
 */
export async function encodeStripPng(colors, options = {}) {
  if (!Array.isArray(colors) || colors.length < 1 || colors.length > 256) {
    throw new RangeError('strip must contain 1..256 colors');
  }
  const orientation = options.orientation ?? 'Nx1';
  if (orientation !== 'Nx1' && orientation !== '1xN') {
    throw new RangeError('orientation must be Nx1 or 1xN');
  }

  const hasAlpha = colors.some((color) => (color.a ?? 255) < 255);
  const channels = hasAlpha ? 4 : 3;
  const width = orientation === 'Nx1' ? colors.length : 1;
  const height = orientation === 'Nx1' ? 1 : colors.length;
  const rowBytes = width * channels;
  const raw = new Uint8Array((rowBytes + 1) * height);

  if (orientation === 'Nx1') {
    raw[0] = 0;
    for (let x = 0; x < colors.length; x++) {
      const color = colors[x];
      const offset = 1 + x * channels;
      raw[offset] = color.r;
      raw[offset + 1] = color.g;
      raw[offset + 2] = color.b;
      if (hasAlpha) raw[offset + 3] = color.a ?? 255;
    }
  } else {
    for (let y = 0; y < colors.length; y++) {
      const color = colors[y];
      const offset = y * (rowBytes + 1);
      raw[offset] = 0;
      raw[offset + 1] = color.r;
      raw[offset + 2] = color.g;
      raw[offset + 3] = color.b;
      if (hasAlpha) raw[offset + 4] = color.a ?? 255;
    }
  }

  return encodeFromRaw(width, height, 8, hasAlpha ? 6 : 2, raw);
}

/**
 * @param {number} width
 * @param {number} height
 * @param {number} bitDepth
 * @param {2|6} colorType
 * @param {Uint8Array} raw filtered rows
 * @returns {Promise<Uint8Array>}
 */
async function encodeFromRaw(width, height, bitDepth, colorType, raw) {
  const ihdr = new Uint8Array(13);
  const view = new DataView(ihdr.buffer);
  view.setUint32(0, width);
  view.setUint32(4, height);
  ihdr[8] = bitDepth;
  ihdr[9] = colorType;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const idat = await deflateZlib(raw);
  return concatBytes([
    PNG_SIGNATURE,
    makeChunk('IHDR', ihdr),
    makeChunk('IDAT', idat),
    makeChunk('IEND', new Uint8Array(0)),
  ]);
}

/**
 * @param {number} width
 * @param {number} height
 */
function assertDimensions(width, height) {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) {
    throw new RangeError('width and height must be positive integers');
  }
}
