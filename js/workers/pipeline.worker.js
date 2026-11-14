// @ts-check
/// <reference lib="webworker" />

import { runPreview, exportStrip, exportReduced, exportIndexed } from '../core/pipeline.js';
import { computeQuality } from '../core/metrics/index.js';

/** @type {Set<number>} */
const cancelled = new Set();

self.onmessage = async (event) => {
  const message = /** @type {any} */ (event.data);
  if (!message || typeof message.type !== 'string') return;

  if (message.type === 'cancel') {
    cancelled.add(message.requestId);
    return;
  }

  const { requestId } = message;
  try {
    if (message.type === 'process') {
      if (cancelled.has(requestId)) return;
      self.postMessage({ type: 'progress', requestId, stage: 'extract', value: 0.15 });

      const image = {
        data: new Uint8ClampedArray(message.image.data),
        width: message.image.width,
        height: message.image.height,
      };
      const result = await runPreview({ image, params: message.params });
      if (cancelled.has(requestId)) {
        cancelled.delete(requestId);
        return;
      }

      self.postMessage(
        {
          type: 'result',
          requestId,
          palette: result.palette,
          uniqueColors: result.uniqueColors,
          preview: {
            data: result.preview.data.buffer,
            width: result.preview.width,
            height: result.preview.height,
          },
          timings: result.timings,
        },
        [result.preview.data.buffer],
      );
      return;
    }

    if (message.type === 'export-strip') {
      self.postMessage({ type: 'progress', requestId, stage: 'strip', value: 0.3 });
      const result = await exportStrip({
        palette: message.palette,
        name: message.name,
        orientation: message.orientation,
        transparentIndex: message.transparentIndex,
      });
      if (cancelled.has(requestId)) return;
      self.postMessage(
        {
          type: 'exported',
          requestId,
          files: result.files,
        },
        result.files.map((file) => file.data),
      );
      return;
    }

    if (message.type === 'export-indexed') {
      self.postMessage({ type: 'progress', requestId, stage: 'index', value: 0.25 });
      const image = {
        data: new Uint8ClampedArray(message.image.data),
        width: message.image.width,
        height: message.image.height,
      };
      const result = await exportIndexed({
        image,
        palette: message.palette,
        params: message.params,
        name: message.name,
      });
      if (cancelled.has(requestId)) return;
      self.postMessage(
        {
          type: 'exported',
          requestId,
          files: result.files,
        },
        result.files.map((file) => file.data),
      );
      return;
    }

    if (message.type === 'export-reduced') {
      self.postMessage({ type: 'progress', requestId, stage: 'encode', value: 0.2 });
      const image = {
        data: new Uint8ClampedArray(message.image.data),
        width: message.image.width,
        height: message.image.height,
      };
      const result = await exportReduced({
        image,
        params: message.params,
        name: message.name,
      });
      if (cancelled.has(requestId)) return;
      self.postMessage(
        {
          type: 'exported',
          requestId,
          palette: result.palette,
          timings: result.timings,
          files: result.files,
        },
        result.files.map((file) => file.data),
      );
      return;
    }

    if (message.type === 'qa') {
      const original = {
        data: new Uint8ClampedArray(message.original.data),
        width: message.width,
        height: message.height,
      };
      const mapped = {
        data: new Uint8ClampedArray(message.mapped.data),
        width: message.width,
        height: message.height,
      };
      const result = computeQuality({
        original,
        mapped,
        width: message.width,
        height: message.height,
      });
      if (cancelled.has(requestId)) {
        cancelled.delete(requestId);
        return;
      }
      self.postMessage(
        {
          type: 'quality',
          requestId,
          result: {
            deltaE00Mean: result.deltaE00Mean,
            deltaE00P95: result.deltaE00P95,
            deltaE00Max: result.deltaE00Max,
            pixels: result.pixels,
            worstPixels: result.worstPixels,
            errorMap: {
              data: result.errorMap.data.buffer,
              width: result.errorMap.width,
              height: result.errorMap.height,
            },
          },
        },
        [result.errorMap.data.buffer],
      );
      return;
    }

    throw new Error(`unknown worker message: ${message.type}`);
  } catch (error) {
    const err = /** @type {Error} */ (error);
    self.postMessage({
      type: 'error',
      requestId,
      code: 'INTERNAL',
      message: err?.message || String(error),
    });
  }
};
