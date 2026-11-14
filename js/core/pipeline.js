// @ts-check
import { buildHistogram } from './histogram.js';
import { extractPalette } from './quantize/index.js';
import { createPalette } from './palette.js';
import { buildMapper, indicesToRgba, mapPixels } from './map.js';
import { ditherPixels } from './dither/index.js';
import { encodeIndexedPng, encodeRgbaPng, encodeStripPng } from './png/encode.js';
import { decodePng } from './png/decode.js';

/** @typedef {import('./types.js').ImageDataLite} ImageDataLite */
/** @typedef {import('./types.js').ExtractParams} ExtractParams */
/** @typedef {import('./types.js').Palette} Palette */
/** @typedef {import('./types.js').ExportFile} ExportFile */
/** @typedef {import('./dither/index.js').DitherParams} DitherParams */

/**
 * @typedef {ExtractParams & {
 *   mode?: 'extract'|'map',
 *   palette?: { r:number,g:number,b:number,a?:number }[],
 *   dither?: Partial<DitherParams>,
 *   alphaThreshold?: number,
 *   transparentIndex?: number,
 * }} PipelineParams
 */

/**
 * @param {{ image: ImageDataLite, params: PipelineParams }} job
 */
export async function runPreview(job) {
  const { image, params } = job;
  const t0 = now();
  const hist = buildHistogram(image);
  const t1 = now();

  const colors = params.mode === 'map'
    ? (params.palette ?? [])
    : extractPalette(hist, params);
  if (colors.length === 0) {
    return {
      palette: [],
      preview: { data: new Uint8ClampedArray(image.data.length), width: image.width, height: image.height },
      uniqueColors: hist.occupied.length,
      timings: { histogramMs: Math.round(t1 - t0), extractMs: 0, mapMs: 0 },
    };
  }

  const palette = createPalette(colors, { space: params.space });
  const t2 = now();
  const mapper = buildMapper(palette, { space: params.space });
  const dither = params.dither ?? {};
  const alphaThreshold = params.alphaThreshold ?? 128;
  const transparentIndex = params.transparentIndex ?? -1;

  let preview;
  if ((dither.method ?? 'none') === 'none') {
    const mapped = mapPixels(image, palette, {
      space: params.space,
      alphaThreshold,
      transparentIndex,
      mapper,
    });
    preview = { data: mapped.data, width: image.width, height: image.height };
  } else {
    const dithered = ditherPixels(image, palette, {
      ...dither,
      space: params.space,
      alphaThreshold,
      transparentIndex,
      mapper,
    });
    preview = indicesToRgba(dithered.indices, image.width, image.height, palette, {
      transparentIndex,
    });
  }
  const t3 = now();

  return {
    palette,
    preview,
    uniqueColors: hist.occupied.length,
    timings: {
      histogramMs: Math.round(t1 - t0),
      extractMs: Math.round(t2 - t1),
      mapMs: Math.round(t3 - t2),
    },
  };
}

/**
 * @param {{ palette: Palette, name: string, orientation: 'Nx1'|'1xN', transparentIndex?: number }} job
 * @returns {Promise<{ files: ExportFile[] }>}
 */
export async function exportStrip(job) {
  const { palette, name, orientation } = job;
  if (palette.length === 0) throw new Error('palette must not be empty');
  const transparentIndex = job.transparentIndex ?? -1;
  const colors = palette.map((entry, index) => ({
    ...entry.color,
    a: index === transparentIndex ? 0 : entry.color.a,
  }));
  const strip = await encodeStripPng(colors, { orientation });
  const decoded = await decodePng(strip);
  const validation = validateStrip(decoded, palette, orientation, transparentIndex);
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
 * @param {{ image: ImageDataLite, params: PipelineParams, name: string }} job
 * @returns {Promise<{ files: ExportFile[], palette: Palette, timings: object }>}
 */
export async function exportReduced(job) {
  const { image, params, name } = job;
  // RGBA output preserves the source alpha exactly. Do not let the indexed
  // transparent-index rule flatten semi-transparent pixels in this export.
  const result = await runPreview({
    image,
    params: { ...params, transparentIndex: -1 },
  });
  for (let i = 3; i < result.preview.data.length; i += 4) {
    result.preview.data[i] = image.data[i];
  }
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
 * @param {{ image: ImageDataLite, palette: Palette, params: PipelineParams, name: string }} job
 * @returns {Promise<{ files: ExportFile[] }>}
 */
export async function exportIndexed(job) {
  const { image, palette, params, name } = job;
  if (palette.length === 0) throw new Error('palette must not be empty');
  const alphaThreshold = params.alphaThreshold ?? 128;
  const transparentIndex = params.transparentIndex ?? -1;

  if (transparentIndex < 0 && hasTransparency(image, alphaThreshold)) {
    throw new Error('Set a transparent index before exporting this image as indexed PNG.');
  }

  const mapper = buildMapper(palette, { space: params.space });
  const dithered = ditherPixels(image, palette, {
    ...(params.dither ?? {}),
    space: params.space,
    alphaThreshold,
    transparentIndex,
    mapper,
  });
  const png = await encodeIndexedPng({
    width: image.width,
    height: image.height,
    indices: dithered.indices,
    palette,
    transparentIndex,
  });
  const decoded = await decodePng(png);
  const expected = indicesToRgba(dithered.indices, image.width, image.height, palette, {
    transparentIndex,
  });
  const validation = validateIndexed(decoded, expected, palette.length);
  const base = baseName(name);

  return {
    files: [
      {
        name: `${base}-${palette.length}c-indexed.png`,
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
 * @param {number} transparentIndex
 * @returns {{ ok:boolean, detail:string }}
 */
function validateStrip(decoded, palette, orientation, transparentIndex) {
  const expectedWidth = orientation === 'Nx1' ? palette.length : 1;
  const expectedHeight = orientation === 'Nx1' ? 1 : palette.length;
  if (decoded.width !== expectedWidth || decoded.height !== expectedHeight) {
    return { ok: false, detail: `decoded ${decoded.width}×${decoded.height}, expected ${expectedWidth}×${expectedHeight}` };
  }

  for (let i = 0; i < palette.length; i++) {
    const expected = palette[i].color;
    const expectedAlpha = i === transparentIndex ? 0 : expected.a;
    const offset = i * 4;
    if (
      decoded.data[offset] !== expected.r ||
      decoded.data[offset + 1] !== expected.g ||
      decoded.data[offset + 2] !== expected.b ||
      decoded.data[offset + 3] !== expectedAlpha
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
 * @param {{ width:number, height:number, data:Uint8ClampedArray }} decoded
 * @param {{ width:number, height:number, data:Uint8ClampedArray }} expected
 * @param {number} paletteSize
 * @returns {{ ok:boolean, detail:string }}
 */
function validateIndexed(decoded, expected, paletteSize) {
  if (decoded.width !== expected.width || decoded.height !== expected.height) {
    return { ok: false, detail: 'indexed PNG dimensions do not match' };
  }
  for (let i = 0; i < decoded.data.length; i += 4) {
    if (
      decoded.data[i] !== expected.data[i] ||
      decoded.data[i + 1] !== expected.data[i + 1] ||
      decoded.data[i + 2] !== expected.data[i + 2] ||
      decoded.data[i + 3] !== expected.data[i + 3]
    ) {
      return { ok: false, detail: `pixel ${i / 4} does not match the index map` };
    }
  }
  const bitDepth = paletteSize <= 2 ? 1 : paletteSize <= 4 ? 2 : paletteSize <= 16 ? 4 : 8;
  return { ok: true, detail: `${paletteSize} colors · ${bitDepth}-bit indexed · exact` };
}

/**
 * @param {ImageDataLite} image
 * @param {number} alphaThreshold
 */
function hasTransparency(image, alphaThreshold) {
  for (let i = 3; i < image.data.length; i += 4) {
    if (image.data[i] < alphaThreshold) return true;
  }
  return false;
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
