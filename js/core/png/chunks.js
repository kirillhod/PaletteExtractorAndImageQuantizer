// @ts-check
import { adler32, crc32 } from './crc.js';
import { inflateZlibSync } from './inflate.js';

export const PNG_SIGNATURE = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);

/**
 * @param {Uint8Array} bytes
 * @returns {number}
 */
export function u32be(bytes) {
  return (
    ((bytes[0] << 24) | (bytes[1] << 16) | (bytes[2] << 8) | bytes[3]) >>> 0
  );
}

/**
 * @param {Uint8Array[]} parts
 * @returns {Uint8Array}
 */
export function concatBytes(parts) {
  let length = 0;
  for (const part of parts) length += part.length;
  const out = new Uint8Array(length);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

/**
 * @param {string} type four ASCII characters
 * @param {Uint8Array} data
 * @returns {Uint8Array}
 */
export function makeChunk(type, data) {
  if (type.length !== 4) throw new Error('PNG chunk type must be 4 ASCII characters');
  const typeBytes = new TextEncoder().encode(type);
  const out = new Uint8Array(12 + data.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, data.length);
  out.set(typeBytes, 4);
  out.set(data, 8);
  view.setUint32(8 + data.length, crc32(out, 4, 8 + data.length));
  return out;
}

/**
 * @param {Uint8Array} bytes
 * @returns {{ type: string, data: Uint8Array }[]}
 */
export function readChunks(bytes) {
  if (bytes.length < PNG_SIGNATURE.length) throw new Error('not a PNG: too short');
  for (let i = 0; i < PNG_SIGNATURE.length; i++) {
    if (bytes[i] !== PNG_SIGNATURE[i]) throw new Error('not a PNG: bad signature');
  }

  const chunks = [];
  let offset = PNG_SIGNATURE.length;
  while (offset + 12 <= bytes.length) {
    const view = new DataView(bytes.buffer, bytes.byteOffset + offset, 8);
    const length = view.getUint32(0);
    if (offset + 12 + length > bytes.length) throw new Error('truncated PNG chunk');
    const type = ascii(bytes, offset + 4, 4);
    const data = bytes.subarray(offset + 8, offset + 8 + length);
    const expected = crc32(bytes, offset + 4, offset + 8 + length);
    const stored = new DataView(
      bytes.buffer,
      bytes.byteOffset + offset + 8 + length,
      4,
    ).getUint32(0);
    if (stored !== expected) throw new Error(`PNG CRC mismatch in ${type}`);
    chunks.push({ type, data });
    offset += 12 + length;
    if (type === 'IEND') break;
  }
  return chunks;
}

/**
 * @param {Uint8Array} bytes
 * @param {number} start
 * @param {number} length
 */
function ascii(bytes, start, length) {
  let out = '';
  for (let i = 0; i < length; i++) out += String.fromCharCode(bytes[start + i]);
  return out;
}

/**
 * M1 zlib writer. Uses valid stored blocks (no compression): CompressionStream
 * stalled in headless Chrome during verification, so the portable fallback is the
 * default until the native path is verified in real browsers. The output is a valid
 * PNG; it is simply larger than a compressed stream.
 * @param {Uint8Array} bytes
 * @returns {Promise<Uint8Array>}
 */
export async function deflateZlib(bytes) {
  return storedZlib(bytes);
}

/**
 * Decode a zlib stream (stored, fixed Huffman, or dynamic Huffman).
 * @param {Uint8Array} bytes
 * @returns {Promise<Uint8Array>}
 */
export async function inflateZlib(bytes) {
  return inflateZlibSync(bytes);
}

/**
 * @param {Uint8Array} bytes
 * @returns {Uint8Array}
 */
export function storedZlib(bytes) {
  const blockSize = 65535;
  const blockCount = Math.max(1, Math.ceil(bytes.length / blockSize));
  const out = new Uint8Array(2 + blockCount * 5 + bytes.length + 4);
  out[0] = 0x78;
  out[1] = 0x01;
  let offset = 2;

  for (let block = 0; block < blockCount; block++) {
    const start = block * blockSize;
    const length = Math.min(blockSize, bytes.length - start);
    const final = block === blockCount - 1;
    out[offset++] = final ? 1 : 0;
    out[offset++] = length & 0xff;
    out[offset++] = (length >>> 8) & 0xff;
    out[offset++] = ~length & 0xff;
    out[offset++] = (~length >>> 8) & 0xff;
    out.set(bytes.subarray(start, start + length), offset);
    offset += length;
  }

  const checksum = adler32(bytes);
  out[offset++] = (checksum >>> 24) & 0xff;
  out[offset++] = (checksum >>> 16) & 0xff;
  out[offset++] = (checksum >>> 8) & 0xff;
  out[offset++] = checksum & 0xff;
  return out.subarray(0, offset);
}
