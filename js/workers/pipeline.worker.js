// @ts-check
/// <reference lib="webworker" />

import { runPreview, exportStrip, exportReduced } from '../core/pipeline.js';

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
