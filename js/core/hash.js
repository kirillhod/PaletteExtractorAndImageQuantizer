// @ts-check
/**
 * Stable serialization and hashing. SHA-256 uses Web Crypto when available;
 * FNV-1a 64-bit is the deterministic fallback.
 */

/**
 * JSON.stringify with recursively sorted object keys. Arrays keep their order.
 * @param {unknown} value
 * @returns {string}
 */
export function stableStringify(value) {
  return JSON.stringify(sortValue(value));
}

/**
 * @param {unknown} value
 * @returns {unknown}
 */
function sortValue(value) {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value && typeof value === 'object') {
    /** @type {Record<string, unknown>} */
    const out = {};
    for (const key of Object.keys(value).sort()) {
      // @ts-ignore index signature on unknown object
      out[key] = sortValue(value[key]);
    }
    return out;
  }
  return value;
}

/**
 * @param {string|Uint8Array} input
 * @returns {Promise<string>} lowercase hex
 */
export async function sha256Hex(input) {
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : input;
  if (globalThis.crypto?.subtle) {
    const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
    return toHex(new Uint8Array(digest));
  }
  return fnv1a64Hex(bytes);
}

/**
 * @param {Uint8Array|string} input
 * @returns {string} 16 lowercase hex chars
 */
export function fnv1a64Hex(input) {
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : input;
  let hash = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  const mask = (1n << 64n) - 1n;
  for (const byte of bytes) {
    hash = ((hash ^ BigInt(byte)) * prime) & mask;
  }
  return hash.toString(16).padStart(16, '0');
}

/**
 * @param {Uint8Array} bytes
 */
function toHex(bytes) {
  let out = '';
  for (const byte of bytes) out += byte.toString(16).padStart(2, '0');
  return out;
}
