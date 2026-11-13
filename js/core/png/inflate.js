// @ts-check
/**
 * Small, dependency-free zlib/DEFLATE decoder. Supports stored, fixed-Huffman and
 * dynamic-Huffman blocks, which covers normal PNG IDAT streams and palette strips.
 */

import { adler32 } from './crc.js';

const LENGTH_BASE = [
  3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99,
  115, 131, 163, 195, 227, 258,
];
const LENGTH_EXTRA = [
  0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5,
  0,
];
const DIST_BASE = [
  1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025,
  1537, 2049, 3073, 4097, 6145, 8193, 12289, 16385, 24577,
];
const DIST_EXTRA = [
  0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12,
  12, 13, 13,
];
const CL_ORDER = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15];

/**
 * @param {Uint8Array} bytes
 * @returns {Uint8Array}
 */
export function inflateZlibSync(bytes) {
  if (bytes.length < 6) throw new Error('truncated zlib stream');
  const cmf = bytes[0];
  const flg = bytes[1];
  if ((cmf & 0x0f) !== 8) throw new Error('unsupported zlib compression method');
  if ((cmf >> 4) > 7) throw new Error('unsupported zlib window size');
  if (((cmf << 8) | flg) % 31 !== 0) throw new Error('invalid zlib header checksum');
  if (flg & 0x20) throw new Error('zlib preset dictionaries are not supported');

  const expected = ((bytes[bytes.length - 4] << 24) |
    (bytes[bytes.length - 3] << 16) |
    (bytes[bytes.length - 2] << 8) |
    bytes[bytes.length - 1]) >>> 0;

  const data = inflateRaw(bytes.subarray(2, bytes.length - 4));
  if (adler32(data) !== expected) throw new Error('zlib Adler-32 mismatch');
  return data;
}

/**
 * @param {Uint8Array} data
 * @returns {Uint8Array}
 */
function inflateRaw(data) {
  const reader = createBitReader(data);
  const out = createOutput();
  let final = 0;

  while (!final) {
    final = reader.readBit();
    const type = reader.readBits(2);

    if (type === 0) {
      reader.align();
      const length = reader.readBits(16);
      const inverse = reader.readBits(16);
      if ((length ^ 0xffff) !== inverse) throw new Error('invalid stored-block length');
      for (let i = 0; i < length; i++) out.push(reader.readBits(8));
      continue;
    }

    if (type === 1) {
      inflateHuffman(reader, out, fixedLiteralTable(), fixedDistanceTable());
      continue;
    }

    if (type === 2) {
      const tables = dynamicTables(reader);
      inflateHuffman(reader, out, tables.literal, tables.distance);
      continue;
    }

    throw new Error(`invalid DEFLATE block type ${type}`);
  }

  return out.finish();
}

/**
 * @param {ReturnType<typeof createBitReader>} reader
 * @param {ReturnType<typeof createOutput>} out
 * @param {Map<number, Map<number, number>>} literal
 * @param {Map<number, Map<number, number>>} distance
 */
function inflateHuffman(reader, out, literal, distance) {
  while (true) {
    const symbol = decodeSymbol(reader, literal);
    if (symbol < 256) {
      out.push(symbol);
      continue;
    }
    if (symbol === 256) return;

    const lengthIndex = symbol - 257;
    if (lengthIndex < 0 || lengthIndex >= LENGTH_BASE.length) {
      throw new Error('invalid DEFLATE length symbol');
    }
    const length = LENGTH_BASE[lengthIndex] + reader.readBits(LENGTH_EXTRA[lengthIndex]);
    const distanceSymbol = decodeSymbol(reader, distance);
    if (distanceSymbol < 0 || distanceSymbol >= DIST_BASE.length) {
      throw new Error('invalid DEFLATE distance symbol');
    }
    const dist = DIST_BASE[distanceSymbol] + reader.readBits(DIST_EXTRA[distanceSymbol]);
    if (dist > out.length) throw new Error('DEFLATE distance exceeds output');
    out.copy(dist, length);
  }
}

/**
 * @param {ReturnType<typeof createBitReader>} reader
 */
function dynamicTables(reader) {
  const hlit = reader.readBits(5) + 257;
  const hdist = reader.readBits(5) + 1;
  const hclen = reader.readBits(4) + 4;

  const codeLengths = new Array(19).fill(0);
  for (let i = 0; i < hclen; i++) codeLengths[CL_ORDER[i]] = reader.readBits(3);
  const codeLengthTable = buildHuffmanTable(codeLengths);

  const lengths = [];
  const total = hlit + hdist;
  while (lengths.length < total) {
    const symbol = decodeSymbol(reader, codeLengthTable);
    if (symbol <= 15) {
      lengths.push(symbol);
      continue;
    }
    if (symbol === 16) {
      if (lengths.length === 0) throw new Error('DEFLATE repeat with no previous length');
      const repeat = reader.readBits(2) + 3;
      const value = lengths[lengths.length - 1];
      for (let i = 0; i < repeat; i++) lengths.push(value);
      continue;
    }
    if (symbol === 17) {
      const repeat = reader.readBits(3) + 3;
      for (let i = 0; i < repeat; i++) lengths.push(0);
      continue;
    }
    if (symbol === 18) {
      const repeat = reader.readBits(7) + 11;
      for (let i = 0; i < repeat; i++) lengths.push(0);
      continue;
    }
    throw new Error('invalid DEFLATE code-length symbol');
  }

  const literalLengths = lengths.slice(0, hlit);
  const distanceLengths = lengths.slice(hlit);
  return {
    literal: buildHuffmanTable(literalLengths),
    distance: buildHuffmanTable(distanceLengths),
  };
}

/**
 * @param {number[]} lengths
 * @returns {Map<number, Map<number, number>>}
 */
function buildHuffmanTable(lengths) {
  const MAX_BITS = 15;
  const counts = new Array(MAX_BITS + 1).fill(0);
  for (const length of lengths) {
    if (length > MAX_BITS) throw new Error('invalid Huffman code length');
    if (length > 0) counts[length]++;
  }

  const nextCode = new Array(MAX_BITS + 1).fill(0);
  let code = 0;
  for (let bits = 1; bits <= MAX_BITS; bits++) {
    code = (code + counts[bits - 1]) << 1;
    nextCode[bits] = code;
  }

  /** @type {Map<number, Map<number, number>>} */
  const tables = new Map();
  for (let length = 1; length <= MAX_BITS; length++) tables.set(length, new Map());

  for (let symbol = 0; symbol < lengths.length; symbol++) {
    const length = lengths[symbol];
    if (!length) continue;
    const table = tables.get(length);
    if (!table) continue;
    table.set(nextCode[length]++, symbol);
  }
  return tables;
}

/**
 * @param {ReturnType<typeof createBitReader>} reader
 * @param {Map<number, Map<number, number>>} tables
 * @returns {number}
 */
function decodeSymbol(reader, tables) {
  let code = 0;
  for (let length = 1; length <= 15; length++) {
    code = (code << 1) | reader.readBit();
    const table = tables.get(length);
    if (!table) continue;
    const symbol = table.get(code);
    if (symbol !== undefined) return symbol;
  }
  throw new Error('invalid Huffman code');
}

/** @type {Map<number, Map<number, number>>|null} */
let fixedLiteral = null;
/** @type {Map<number, Map<number, number>>|null} */
let fixedDistance = null;

function fixedLiteralTable() {
  if (fixedLiteral) return fixedLiteral;
  const lengths = new Array(288);
  for (let i = 0; i <= 143; i++) lengths[i] = 8;
  for (let i = 144; i <= 255; i++) lengths[i] = 9;
  for (let i = 256; i <= 279; i++) lengths[i] = 7;
  for (let i = 280; i <= 287; i++) lengths[i] = 8;
  fixedLiteral = buildHuffmanTable(lengths);
  return fixedLiteral;
}

function fixedDistanceTable() {
  if (fixedDistance) return fixedDistance;
  fixedDistance = buildHuffmanTable(new Array(32).fill(5));
  return fixedDistance;
}

/**
 * @param {Uint8Array} data
 */
function createBitReader(data) {
  let byte = 0;
  let bit = 0;
  let position = 0;

  function readBit() {
    if (position >= data.length) throw new Error('unexpected end of DEFLATE data');
    const value = (data[position] >> bit) & 1;
    bit++;
    if (bit === 8) {
      bit = 0;
      position++;
    }
    return value;
  }

  function readBits(count) {
    let value = 0;
    for (let i = 0; i < count; i++) value |= readBit() << i;
    return value;
  }

  function align() {
    if (bit !== 0) {
      bit = 0;
      position++;
    }
  }

  return { readBit, readBits, align };
}

function createOutput() {
  let buffer = new Uint8Array(1 << 16);
  let length = 0;

  function ensure(extra) {
    if (length + extra <= buffer.length) return;
    let size = buffer.length * 2;
    while (size < length + extra) size *= 2;
    const next = new Uint8Array(size);
    next.set(buffer.subarray(0, length));
    buffer = next;
  }

  return {
    get length() {
      return length;
    },
    push(value) {
      ensure(1);
      buffer[length++] = value & 0xff;
    },
    copy(distance, count) {
      if (distance < 1 || distance > length) throw new Error('invalid DEFLATE distance');
      ensure(count);
      for (let i = 0; i < count; i++) {
        buffer[length] = buffer[length - distance];
        length++;
      }
    },
    finish() {
      return buffer.subarray(0, length);
    },
  };
}
