// @ts-check
import { concatBytes, inflateZlib, readChunks } from './chunks.js';

/**
 * Decode a non-interlaced 8-bit PNG (grayscale, RGB, indexed, RGBA).
 * Indexed PNGs support bit depths 1/2/4/8. 16-bit and interlaced files are rejected.
 *
 * @param {Uint8Array} bytes
 * @returns {Promise<{ width:number, height:number, data:Uint8ClampedArray }>}
 */
export async function decodePng(bytes) {
  const chunks = readChunks(bytes);
  const ihdr = chunks.find((chunk) => chunk.type === 'IHDR');
  if (!ihdr || ihdr.data.length !== 13) throw new Error('PNG is missing a valid IHDR');

  const header = new DataView(ihdr.data.buffer, ihdr.data.byteOffset, 13);
  const width = header.getUint32(0);
  const height = header.getUint32(4);
  const bitDepth = ihdr.data[8];
  const colorType = ihdr.data[9];
  const compression = ihdr.data[10];
  const filterMethod = ihdr.data[11];
  const interlace = ihdr.data[12];

  if (width < 1 || height < 1) throw new Error('PNG has invalid dimensions');
  if (compression !== 0 || filterMethod !== 0) throw new Error('unsupported PNG compression/filter');
  if (interlace !== 0) throw new Error('interlaced PNG is not supported');
  if (bitDepth === 16) throw new Error('16-bit PNG is not supported');
  if (colorType !== 0 && colorType !== 2 && colorType !== 3 && colorType !== 6) {
    throw new Error(`unsupported PNG color type ${colorType}`);
  }
  if ((colorType === 0 || colorType === 2 || colorType === 6) && bitDepth !== 8) {
    throw new Error(`unsupported PNG bit depth ${bitDepth} for color type ${colorType}`);
  }
  if (colorType === 3 && ![1, 2, 4, 8].includes(bitDepth)) {
    throw new Error(`unsupported indexed PNG bit depth ${bitDepth}`);
  }

  const bitsPerPixel =
    colorType === 0 ? bitDepth : colorType === 2 ? bitDepth * 3 : colorType === 3 ? bitDepth : bitDepth * 4;
  const bpp = Math.max(1, Math.ceil(bitsPerPixel / 8));
  const rowBytes = Math.ceil((width * bitsPerPixel) / 8);
  const expected = (rowBytes + 1) * height;

  const idatParts = chunks.filter((chunk) => chunk.type === 'IDAT').map((chunk) => chunk.data);
  if (idatParts.length === 0) throw new Error('PNG has no IDAT data');
  const raw = await inflateZlib(concatBytes(idatParts));
  if (raw.length !== expected) {
    throw new Error(`unexpected PNG data length: ${raw.length}, expected ${expected}`);
  }

  const pixels = unfilter(raw, width, height, rowBytes, bpp);
  const data = toRgba(pixels, width, height, rowBytes, colorType, bitDepth, chunks);

  return { width, height, data };
}

/**
 * @param {Uint8Array} raw
 * @param {number} width
 * @param {number} height
 * @param {number} rowBytes
 * @param {number} bpp
 * @returns {Uint8Array}
 */
function unfilter(raw, width, height, rowBytes, bpp) {
  const out = new Uint8Array(rowBytes * height);
  for (let y = 0; y < height; y++) {
    const src = y * (rowBytes + 1);
    const filter = raw[src];
    const dst = y * rowBytes;
    for (let x = 0; x < rowBytes; x++) {
      const value = raw[src + 1 + x];
      const a = x >= bpp ? out[dst + x - bpp] : 0;
      const b = y > 0 ? out[dst - rowBytes + x] : 0;
      const c = x >= bpp && y > 0 ? out[dst - rowBytes + x - bpp] : 0;
      let decoded;
      switch (filter) {
        case 0:
          decoded = value;
          break;
        case 1:
          decoded = value + a;
          break;
        case 2:
          decoded = value + b;
          break;
        case 3:
          decoded = value + ((a + b) >> 1);
          break;
        case 4:
          decoded = value + paeth(a, b, c);
          break;
        default:
          throw new Error(`unsupported PNG filter ${filter}`);
      }
      out[dst + x] = decoded & 0xff;
    }
  }
  return out;
}

/**
 * @param {number} a
 * @param {number} b
 * @param {number} c
 */
function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

/**
 * @param {Uint8Array} pixels
 * @param {number} width
 * @param {number} height
 * @param {number} rowBytes
 * @param {number} colorType
 * @param {number} bitDepth
 * @param {{ type:string, data:Uint8Array }[]} chunks
 * @returns {Uint8ClampedArray}
 */
function toRgba(pixels, width, height, rowBytes, colorType, bitDepth, chunks) {
  const rgba = new Uint8ClampedArray(width * height * 4);
  const paletteChunk = chunks.find((chunk) => chunk.type === 'PLTE');
  const trnsChunk = chunks.find((chunk) => chunk.type === 'tRNS');

  if (colorType === 6) {
    for (let y = 0; y < height; y++) {
      const src = y * rowBytes;
      const dst = y * width * 4;
      rgba.set(pixels.subarray(src, src + width * 4), dst);
    }
    return rgba;
  }

  if (colorType === 2) {
    for (let y = 0; y < height; y++) {
      const src = y * rowBytes;
      const dst = y * width * 4;
      for (let x = 0; x < width; x++) {
        rgba[dst + x * 4] = pixels[src + x * 3];
        rgba[dst + x * 4 + 1] = pixels[src + x * 3 + 1];
        rgba[dst + x * 4 + 2] = pixels[src + x * 3 + 2];
        rgba[dst + x * 4 + 3] = 255;
      }
    }
    return rgba;
  }

  if (colorType === 0) {
    for (let y = 0; y < height; y++) {
      const src = y * rowBytes;
      const dst = y * width * 4;
      for (let x = 0; x < width; x++) {
        const value = pixels[src + x];
        rgba[dst + x * 4] = value;
        rgba[dst + x * 4 + 1] = value;
        rgba[dst + x * 4 + 2] = value;
        rgba[dst + x * 4 + 3] = 255;
      }
    }
    return rgba;
  }

  if (!paletteChunk) throw new Error('indexed PNG is missing PLTE');
  const palette = paletteChunk.data;
  const trns = trnsChunk?.data;
  const maxIndex = 1 << bitDepth;

  for (let y = 0; y < height; y++) {
    const src = y * rowBytes;
    const dst = y * width * 4;
    for (let x = 0; x < width; x++) {
      let index;
      if (bitDepth === 8) {
        index = pixels[src + x];
      } else {
        const bitOffset = x * bitDepth;
        const byte = pixels[src + (bitOffset >> 3)];
        const shift = 8 - bitDepth - (bitOffset & 7);
        index = (byte >> shift) & (maxIndex - 1);
      }
      const p = index * 3;
      if (p + 2 >= palette.length) throw new Error('PNG palette index out of range');
      rgba[dst + x * 4] = palette[p];
      rgba[dst + x * 4 + 1] = palette[p + 1];
      rgba[dst + x * 4 + 2] = palette[p + 2];
      rgba[dst + x * 4 + 3] = trns && index < trns.length ? trns[index] : 255;
    }
  }
  return rgba;
}
