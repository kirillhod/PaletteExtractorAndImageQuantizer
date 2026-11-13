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
 * Encode an indexed PNG with PLTE and optional tRNS.
 * @param {{
 *   width:number,
 *   height:number,
 *   indices:Uint8Array,
 *   palette:{ color:{ r:number,g:number,b:number,a:number } }[],
 *   transparentIndex?: number,
 * }} input
 * @returns {Promise<Uint8Array>}
 */
export async function encodeIndexedPng(input) {
  const { width, height, indices, palette } = input;
  assertDimensions(width, height);
  if (!Array.isArray(palette) || palette.length < 1 || palette.length > 256) {
    throw new RangeError('palette must contain 1..256 entries');
  }
  if (indices.length !== width * height) {
    throw new RangeError('indices length must be width * height');
  }

  const colorCount = palette.length;
  const bitDepth = colorCount <= 2 ? 1 : colorCount <= 4 ? 2 : colorCount <= 16 ? 4 : 8;
  const transparentIndex = input.transparentIndex ?? -1;
  if (transparentIndex >= colorCount) throw new RangeError('transparent index is out of range');

  const rowBytes = Math.ceil((width * bitDepth) / 8);
  const raw = new Uint8Array((rowBytes + 1) * height);
  const mask = (1 << bitDepth) - 1;

  for (let y = 0; y < height; y++) {
    const rowStart = y * (rowBytes + 1);
    raw[rowStart] = 0;
    for (let x = 0; x < width; x++) {
      const index = indices[y * width + x];
      if (index >= colorCount) throw new RangeError(`index ${index} is outside the palette`);
      if (bitDepth === 8) {
        raw[rowStart + 1 + x] = index;
      } else {
        const bitPosition = x * bitDepth;
        const byteOffset = rowStart + 1 + (bitPosition >> 3);
        const shift = 8 - bitDepth - (bitPosition & 7);
        raw[byteOffset] |= (index & mask) << shift;
      }
    }
  }

  const plte = new Uint8Array(colorCount * 3);
  for (let i = 0; i < colorCount; i++) {
    plte[i * 3] = palette[i].color.r;
    plte[i * 3 + 1] = palette[i].color.g;
    plte[i * 3 + 2] = palette[i].color.b;
  }

  const hasAlpha = palette.some((entry) => entry.color.a < 255) || transparentIndex >= 0;
  /** @type {Uint8Array[]} */
  const extraChunks = [makeChunk('PLTE', plte)];
  if (hasAlpha) {
    const trns = new Uint8Array(colorCount).fill(255);
    for (let i = 0; i < colorCount; i++) {
      if (palette[i].color.a < 255) trns[i] = palette[i].color.a;
    }
    if (transparentIndex >= 0) trns[transparentIndex] = 0;
    extraChunks.push(makeChunk('tRNS', trns));
  }

  return encodeFromRaw(width, height, bitDepth, 3, raw, extraChunks);
}

/**
 * @param {number} width
 * @param {number} height
 * @param {number} bitDepth
 * @param {number} colorType
 * @param {Uint8Array} raw filtered rows
 * @param {Uint8Array[]} [extraChunks]
 * @returns {Promise<Uint8Array>}
 */
async function encodeFromRaw(width, height, bitDepth, colorType, raw, extraChunks = []) {
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
    ...extraChunks,
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
