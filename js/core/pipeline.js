// @ts-check
import { buildHistogram } from './histogram.js';
import { extractPalette } from './quantize/index.js';
import { createPalette } from './palette.js';
import { mapPixels } from './map.js';
import { encodeRgbaPng, encodeStripPng } from './png/encode.js';
import { decodePng } from './png/decode.js';

/** @typedef {import('./types.js').ImageDataLite} ImageDataLite */
/** @typedef {import('./types.js').ExtractParams} ExtractParams */
/** @typedef {import('./types.js').Palette} Palette */
/** @typedef {import('./types.js').ExportFile} ExportFile */

/**
 * @param {{ image: ImageDataLite, params: ExtractParams }} job
 */
export async function runPreview(job) {
  const { image, params } = job;
  const t0 = now();
  const hist = buildHistogram(image);
  const t1 = now();
  const colors = extractPalette(hist, params);
  const palette = createPalette(colors, { space: params.space });
  const t2 = now();
  const mapped =
    palette.length === 0
      ? { data: new Uint8ClampedArray(image.data.length), width: image.width, height: image.height }
      : mapPixels(image, palette, { space: params.space });
  const t3 = now();

  return {
    palette,
    preview: { data: mapped.data, width: image.width, height: image.height },
    uniqueColors: hist.occupied.length,
    timings: {
      histogramMs: Math.round(t1 - t0),
      extractMs: Math.round(t2 - t1),
      mapMs: Math.round(t3 - t2),
    },
  };
}

/**
 * @param {{ palette: Palette, name: string, orientation: 'Nx1'|'1xN' }} job
 * @returns {Promise<{ files: ExportFile[] }>}
 */
export async function exportStrip(job) {
  const { palette, name, orientation } = job;
  if (palette.length === 0) throw new Error('palette must not be empty');
  const strip = await encodeStripPng(
    palette.map((entry) => entry.color),
    { orientation },
  );
  const decoded = await decodePng(strip);
  const validation = validateStrip(decoded, palette, orientation);
  const base = baseName(name);
  const suffix = orientation === 'Nx1'
    ? `${palette.length}x1`
    : `1x${palette.length}`;

  return {
    files: [
      {
        name: `${base}-palette-${suffix}.png`,
        mime: 'image/png',
        data: toArrayBuffer(strip),
        validation,
      },
    ],
  };
}

/**
 * @param {{ image: ImageDataLite, params: ExtractParams, name: string }} job
 * @returns {Promise<{ files: ExportFile[], palette: Palette, timings: object }>}
 */
export async function exportReduced(job) {
  const { image, params, name } = job;
  const result = await runPreview({ image, params });
  const png = await encodeRgbaPng(image.width, image.height, result.preview.data);
  const decoded = await decodePng(png);
  const validation = validateReduced(decoded, result.palette);
  const base = baseName(name);

  return {
    palette: result.palette,
    timings: result.timings,
    files: [
      {
        name: `${base}-${result.palette.length}c.png`,
        mime: 'image/png',
        data: toArrayBuffer(png),
        validation,
      },
    ],
  };
}

/**
 * @param {{ width:number, height:number, data:Uint8ClampedArray }} decoded
 * @param {Palette} palette
 * @param {'Nx1'|'1xN'} orientation
 * @returns {{ ok:boolean, detail:string }}
 */
function validateStrip(decoded, palette, orientation) {
  const expectedWidth = orientation === 'Nx1' ? palette.length : 1;
  const expectedHeight = orientation === 'Nx1' ? 1 : palette.length;
  if (decoded.width !== expectedWidth || decoded.height !== expectedHeight) {
    return { ok: false, detail: `decoded ${decoded.width}×${decoded.height}, expected ${expectedWidth}×${expectedHeight}` };
  }

  for (let i = 0; i < palette.length; i++) {
    const expected = palette[i].color;
    const offset = i * 4;
    if (
      decoded.data[offset] !== expected.r ||
      decoded.data[offset + 1] !== expected.g ||
      decoded.data[offset + 2] !== expected.b ||
      decoded.data[offset + 3] !== 255
    ) {
      return { ok: false, detail: `pixel ${i} does not match palette` };
    }
  }
  return { ok: true, detail: `${palette.length} colors · ${expectedWidth}×${expectedHeight} · exact` };
}

/**
 * @param {{ width:number, height:number, data:Uint8ClampedArray }} decoded
 * @param {Palette} palette
 * @returns {{ ok:boolean, detail:string }}
 */
function validateReduced(decoded, palette) {
  if (decoded.width < 1 || decoded.height < 1) {
    return { ok: false, detail: 'decoded image is empty' };
  }
  const allowed = new Set(
    palette.map((entry) => (entry.color.r << 16) | (entry.color.g << 8) | entry.color.b),
  );
  for (let i = 0; i < decoded.data.length; i += 4) {
    if (decoded.data[i + 3] === 0) continue;
    const key = (decoded.data[i] << 16) | (decoded.data[i + 1] << 8) | decoded.data[i + 2];
    if (!allowed.has(key)) {
      return { ok: false, detail: `pixel ${i / 4} is outside the palette` };
    }
  }
  return { ok: true, detail: `${decoded.width}×${decoded.height} · palette compliant` };
}

/**
 * @param {string} name
 */
function baseName(name) {
  const base = String(name ?? '')
    .toLowerCase()
    .replace(/\.[a-z0-9]+$/i, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return base || 'image';
}

/**
 * @param {Uint8Array} bytes
 */
function toArrayBuffer(bytes) {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}

function now() {
  return globalThis.performance?.now?.() ?? Date.now();
}
