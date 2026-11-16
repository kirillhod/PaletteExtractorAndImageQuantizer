// @ts-check
import { recenterOffsets } from '../core/view-offsets.js';

/**
 * Pixel buffer used for sampling.
 * @typedef {{ data: Uint8ClampedArray, width:number, height:number }} ImageLike
 */

/**
 * Original image input. `bitmap` keeps the full-resolution decode for drawing and
 * sampling; without it the ImageData is copied into a canvas.
 * @typedef {Object} OriginalInput
 * @property {number} width
 * @property {number} height
 * @property {Uint8ClampedArray} [data]
 * @property {ImageBitmap|null} [bitmap]
 */

/**
 * A rectangular read of one side, in that side's pixel coordinates.
 * @typedef {Object} SamplePatch
 * @property {Uint8ClampedArray} data
 * @property {number} width
 * @property {number} height
 * @property {number} originX
 * @property {number} originY
 */

/** @typedef {{ x:number, y:number, deltaE00?:number }} WorstPixel */

/**
 * @param {{ canvas: HTMLCanvasElement, frame: HTMLElement, divider: HTMLElement, onRender?: () => void }} options
 */
export function createCanvasView(options) {
  const { canvas, frame, divider, onRender } = options;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas 2D is unavailable');
  // Reading a few pixels out of an ImageBitmap needs a canvas: drawImage copies the exact
  // source pixels, so picking and the loupe stay full-resolution.
  const readCanvas = document.createElement('canvas');
  const readContext = readCanvas.getContext('2d', { willReadFrequently: true });
  if (!readContext) throw new Error('Canvas 2D is unavailable');

  const handle = /** @type {HTMLElement|null} */ (divider.querySelector('.peiq-divider__handle'));

  /** @type {{ width:number, height:number, data:Uint8ClampedArray|null }|null} */
  let original = null;
  /** @type {ImageLike|null} */
  let reduced = null;
  /** @type {CanvasImageSource|null} */
  let originalBuffer = null;
  /** @type {HTMLCanvasElement|null} */
  let reducedBuffer = null;
  /** @type {ImageLike|null} */
  let errorMap = null;
  /** @type {HTMLCanvasElement|null} */
  let errorBuffer = null;
  /** @type {WorstPixel[]|null} */
  let worstPixels = null;

  let scale = 1;
  let offsetX = 0;
  let offsetY = 0;
  let dividerFraction = 0.5;
  let showOriginal = false;
  let autoFit = true;
  let raf = 0;
  let drag = /** @type {'pan'|'divider'|'pinch'|null} */ (null);
  let lastX = 0;
  let lastY = 0;
  /** @type {Map<number, { x:number, y:number }>} */
  const pointers = new Map();
  let pinchDistance = 0;
  let pinchMidX = 0;
  let pinchMidY = 0;

  /**
   * @param {ImageLike|null} image
   * @returns {HTMLCanvasElement|null}
   */
  function toCanvas(image) {
    if (!image) return null;
    const buffer = document.createElement('canvas');
    buffer.width = image.width;
    buffer.height = image.height;
    const ctx = buffer.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D is unavailable');
    ctx.putImageData(new ImageData(image.data, image.width, image.height), 0, 0);
    return buffer;
  }

  function scheduleRender() {
    if (raf) return;
    raf = window.requestAnimationFrame(() => {
      raf = 0;
      render();
    });
  }

  /**
   * ResizeObserver callbacks run after the frame callbacks but before paint. Drawing
   * here keeps the bitmap and its CSS box in sync for the frame that shows the new
   * layout; deferring to requestAnimationFrame leaves one frame with a stretched
   * bitmap, which reads as a flicker when a panel opens or closes.
   */
  function renderNow() {
    if (raf) {
      window.cancelAnimationFrame(raf);
      raf = 0;
    }
    render();
  }

  function fit() {
    if (!original) return;
    const width = frame.clientWidth;
    const height = frame.clientHeight;
    if (width < 2 || height < 2) return;

    const padding = 16;
    const nextScale = Math.min(
      (width - padding * 2) / original.width,
      (height - padding * 2) / original.height,
    );
    scale = Number.isFinite(nextScale) && nextScale > 0 ? Math.min(16, Math.max(0.02, nextScale)) : 1;
    offsetX = (width - original.width * scale) / 2;
    offsetY = (height - original.height * scale) / 2;
    autoFit = true;
    scheduleRender();
  }

  function zoom100() {
    if (!original) return;
    const width = frame.clientWidth;
    const height = frame.clientHeight;
    scale = 1;
    offsetX = (width - original.width) / 2;
    offsetY = (height - original.height) / 2;
    autoFit = false;
    scheduleRender();
  }

  /**
   * @param {number} factor
   * @param {number} [clientX]
   * @param {number} [clientY]
   */
  function zoomBy(factor, clientX, clientY) {
    if (!original) return;
    const rect = frame.getBoundingClientRect();
    const x = clientX ?? rect.left + rect.width / 2;
    const y = clientY ?? rect.top + rect.height / 2;
    const localX = x - rect.left;
    const localY = y - rect.top;
    const imageX = (localX - offsetX) / scale;
    const imageY = (localY - offsetY) / scale;
    scale = Math.min(16, Math.max(0.02, scale * factor));
    offsetX = localX - imageX * scale;
    offsetY = localY - imageY * scale;
    autoFit = false;
    scheduleRender();
  }

  /**
   * @param {number} dx
   * @param {number} dy
   */
  function pan(dx, dy) {
    offsetX += dx;
    offsetY += dy;
    autoFit = false;
    scheduleRender();
  }

  /**
   * Draw the ranked worst-pixel markers over the error map. Numbers match the list in
   * the Quality panel. Markers that land on top of each other step outward on a
   * deterministic ring, with a leader back to the exact pixel, so adjacent maxima stay
   * readable instead of merging into one dot.
   */
  function drawWorstMarkers() {
    if (!original || !errorMap || !worstPixels || worstPixels.length === 0) return;
    const styles = window.getComputedStyle(frame);
    const accent = styles.getPropertyValue('--peiq-accent').trim();
    const background = styles.getPropertyValue('--peiq-bg').trim();
    const radius = 9;
    const spacing = radius * 2.4;
    const boxWidth = original.width * scale;
    const boxHeight = original.height * scale;
    /** @type {{ x:number, y:number }[]} */
    const placed = [];

    const markers = worstPixels.map((pixel, order) => {
      const anchorX = offsetX + ((pixel.x + 0.5) / errorMap.width) * boxWidth;
      const anchorY = offsetY + ((pixel.y + 0.5) / errorMap.height) * boxHeight;
      let x = anchorX;
      let y = anchorY;
      for (let attempt = 1; attempt <= 48; attempt++) {
        if (!placed.some((point) => Math.hypot(point.x - x, point.y - y) < spacing)) break;
        const ring = Math.ceil(attempt / 8);
        const angle = ((attempt - 1) % 8) * (Math.PI / 4) - Math.PI / 2;
        x = anchorX + Math.cos(angle) * spacing * ring;
        y = anchorY + Math.sin(angle) * spacing * ring;
      }
      placed.push({ x, y });
      return { anchorX, anchorY, x, y, rank: order + 1 };
    });

    context.save();
    context.font = `600 10px ${styles.fontFamily || 'sans-serif'}`;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    for (const marker of markers) {
      if (marker.x !== marker.anchorX || marker.y !== marker.anchorY) {
        context.strokeStyle = accent;
        context.lineWidth = 1;
        context.beginPath();
        context.moveTo(marker.anchorX, marker.anchorY);
        context.lineTo(marker.x, marker.y);
        context.stroke();
      }
      context.fillStyle = accent;
      context.beginPath();
      context.arc(marker.anchorX, marker.anchorY, 1.5, 0, Math.PI * 2);
      context.fill();

      context.beginPath();
      context.arc(marker.x, marker.y, radius, 0, Math.PI * 2);
      context.fillStyle = background;
      context.fill();
      context.lineWidth = 2;
      context.strokeStyle = accent;
      context.stroke();
      context.fillStyle = accent;
      context.fillText(String(marker.rank), marker.x, marker.y + 0.5);
    }
    context.restore();
  }

  function render() {
    const width = Math.max(1, frame.clientWidth);
    const height = Math.max(1, frame.clientHeight);
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const targetWidth = Math.max(1, Math.round(width * dpr));
    const targetHeight = Math.max(1, Math.round(height * dpr));
    if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
      canvas.width = targetWidth;
      canvas.height = targetHeight;
    }

    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.clearRect(0, 0, width, height);
    if (!original || !originalBuffer) {
      onRender?.();
      return;
    }

    context.save();
    context.translate(offsetX, offsetY);
    context.scale(scale, scale);
    context.imageSmoothingEnabled = scale < 1;
    context.drawImage(originalBuffer, 0, 0, original.width, original.height);
    context.restore();

    const rightImage = errorBuffer ? errorMap : reduced;
    const rightBuffer = errorBuffer ?? reducedBuffer;
    if (rightImage && rightBuffer && !showOriginal) {
      const split = width * dividerFraction;
      context.save();
      context.beginPath();
      context.rect(split, 0, width - split, height);
      context.clip();
      // Transparent reduced pixels must reveal the checkerboard, not the original
      // image underneath. Clear the clipped reduced side before drawing it.
      context.clearRect(split, 0, width - split, height);
      context.translate(offsetX, offsetY);
      context.scale(scale, scale);
      context.imageSmoothingEnabled = scale < 1;
      // The right buffer is the mapping preview or the error map, which may be smaller
      // than the original. Stretch it over the same logical box so the divider compares
      // the same frame.
      context.drawImage(
        rightBuffer,
        0,
        0,
        rightImage.width,
        rightImage.height,
        0,
        0,
        original.width,
        original.height,
      );
      context.restore();
    }
    if (errorBuffer && worstPixels && !showOriginal) drawWorstMarkers();
    onRender?.();
  }

  /**
   * @param {number} value
   */
  function setDivider(value) {
    dividerFraction = Math.min(0.98, Math.max(0.02, value));
    divider.style.left = `${dividerFraction * 100}%`;
    divider.setAttribute('aria-valuenow', String(Math.round(dividerFraction * 100)));
    scheduleRender();
  }

  function setPanFromPointer() {
    const point = pointers.values().next().value;
    if (!point) return;
    drag = 'pan';
    lastX = point.x;
    lastY = point.y;
  }

  function updatePinch() {
    if (pointers.size < 2) return;
    const [a, b] = [...pointers.values()];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const distance = Math.hypot(dx, dy);
    if (distance < 1) return;

    const midX = (a.x + b.x) / 2;
    const midY = (a.y + b.y) / 2;
    if (pinchDistance > 0) {
      const factor = distance / pinchDistance;
      if (Math.abs(factor - 1) > 0.001) zoomBy(factor, midX, midY);
      const moveX = midX - pinchMidX;
      const moveY = midY - pinchMidY;
      if (moveX !== 0 || moveY !== 0) pan(moveX, moveY);
    }
    pinchDistance = distance;
    pinchMidX = midX;
    pinchMidY = midY;
  }

  function onPointerMove(event) {
    if (drag === 'divider') {
      const rect = frame.getBoundingClientRect();
      setDivider((event.clientX - rect.left) / rect.width);
      return;
    }

    if (!pointers.has(event.pointerId)) return;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (drag === 'pinch') {
      updatePinch();
      return;
    }

    if (drag === 'pan') {
      pan(event.clientX - lastX, event.clientY - lastY);
      lastX = event.clientX;
      lastY = event.clientY;
    }
  }

  function stopDrag() {
    drag = null;
  }

  function endCanvasPointer(event) {
    pointers.delete(event.pointerId);
    if (pointers.size === 1) {
      pinchDistance = 0;
      setPanFromPointer();
    } else if (pointers.size === 0) {
      pinchDistance = 0;
      drag = null;
    } else {
      pinchDistance = 0;
      updatePinch();
    }
  }

  handle?.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    event.stopPropagation();
    drag = 'divider';
    handle.setPointerCapture(event.pointerId);
  });
  handle?.addEventListener('pointermove', onPointerMove);
  handle?.addEventListener('pointerup', stopDrag);
  handle?.addEventListener('pointercancel', stopDrag);

  canvas.addEventListener('pointerdown', (event) => {
    if (event.pointerType === 'mouse' && event.button !== 0 && event.button !== 1) return;
    event.preventDefault();
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    canvas.setPointerCapture(event.pointerId);
    if (pointers.size === 1) {
      setPanFromPointer();
    } else if (pointers.size === 2) {
      drag = 'pinch';
      pinchDistance = 0;
      updatePinch();
    }
  });
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', endCanvasPointer);
  canvas.addEventListener('pointercancel', endCanvasPointer);

  frame.addEventListener(
    'wheel',
    (event) => {
      event.preventDefault();
      zoomBy(event.deltaY < 0 ? 1.1 : 1 / 1.1, event.clientX, event.clientY);
    },
    { passive: false },
  );

  divider.addEventListener('keydown', (event) => {
    const step = event.shiftKey ? 0.1 : 0.02;
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      setDivider(dividerFraction - step);
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      setDivider(dividerFraction + step);
    } else if (event.key === 'Home') {
      event.preventDefault();
      setDivider(0.02);
    } else if (event.key === 'End') {
      event.preventDefault();
      setDivider(0.98);
    }
  });

  /**
   * Copy a rectangle out of an ImageData-like buffer, clamped to its bounds.
   *
   * @param {ImageLike} image
   * @param {number} x
   * @param {number} y
   * @param {number} width
   * @param {number} height
   * @returns {SamplePatch}
   */
  function patchFrom(image, x, y, width, height) {
    const originX = Math.max(0, Math.min(image.width - 1, Math.floor(x)));
    const originY = Math.max(0, Math.min(image.height - 1, Math.floor(y)));
    const patchWidth = Math.max(1, Math.min(width, image.width - originX));
    const patchHeight = Math.max(1, Math.min(height, image.height - originY));
    const data = new Uint8ClampedArray(patchWidth * patchHeight * 4);
    for (let row = 0; row < patchHeight; row++) {
      const from = ((originY + row) * image.width + originX) * 4;
      data.set(image.data.subarray(from, from + patchWidth * 4), row * patchWidth * 4);
    }
    return { data, width: patchWidth, height: patchHeight, originX, originY };
  }

  /**
   * Read a rectangle from the original image. A retained ImageBitmap has no JS pixels, so
   * the exact source rectangle is copied through a scratch canvas first.
   *
   * @param {number} x
   * @param {number} y
   * @param {number} width
   * @param {number} height
   * @returns {SamplePatch|null}
   */
  function originalPatch(x, y, width, height) {
    if (!original) return null;
    if (original.data) {
      return patchFrom(
        { data: original.data, width: original.width, height: original.height },
        x,
        y,
        width,
        height,
      );
    }
    if (!originalBuffer) return null;
    const originX = Math.max(0, Math.min(original.width - 1, Math.floor(x)));
    const originY = Math.max(0, Math.min(original.height - 1, Math.floor(y)));
    const patchWidth = Math.max(1, Math.min(width, original.width - originX));
    const patchHeight = Math.max(1, Math.min(height, original.height - originY));
    readCanvas.width = patchWidth;
    readCanvas.height = patchHeight;
    readContext.clearRect(0, 0, patchWidth, patchHeight);
    readContext.drawImage(
      originalBuffer,
      originX,
      originY,
      patchWidth,
      patchHeight,
      0,
      0,
      patchWidth,
      patchHeight,
    );
    const image = readContext.getImageData(0, 0, patchWidth, patchHeight);
    return { data: image.data, width: patchWidth, height: patchHeight, originX, originY };
  }

  /**
   * @param {'original'|'reduced'} side
   * @param {number} x
   * @param {number} y
   * @param {number} radius
   * @returns {SamplePatch|null}
   */
  function samplePatch(side, x, y, radius) {
    const size = radius * 2 + 1;
    if (side === 'reduced') {
      if (!reduced) return null;
      return patchFrom(reduced, x - radius, y - radius, size, size);
    }
    return originalPatch(x - radius, y - radius, size, size);
  }

  /**
   * Sample the preview under a client point. The reduced side is sampled when the
   * point is right of the divider, so the eyedropper can also pick mapped colors.
   * Returns null outside the image.
   *
   * @param {number} clientX
   * @param {number} clientY
   * @returns {{ color: { r:number, g:number, b:number, a:number }, source: { width:number, height:number }, side: 'original'|'reduced', x:number, y:number }|null}
   */
  function pickSample(clientX, clientY) {
    if (!original) return null;
    const rect = frame.getBoundingClientRect();
    const localX = clientX - rect.left;
    const localY = clientY - rect.top;
    const imageX = Math.floor((localX - offsetX) / scale);
    const imageY = Math.floor((localY - offsetY) / scale);
    if (
      imageX < 0 ||
      imageY < 0 ||
      imageX >= original.width ||
      imageY >= original.height
    ) {
      return null;
    }
    const useReduced =
      !showOriginal && reduced !== null && localX >= rect.width * dividerFraction;
    if (useReduced && reduced) {
      // The reduced half is stretched over the original box, so the pointer has to be
      // mapped into preview pixels before the color is read.
      const x = Math.min(
        reduced.width - 1,
        Math.floor((imageX * reduced.width) / original.width),
      );
      const y = Math.min(
        reduced.height - 1,
        Math.floor((imageY * reduced.height) / original.height),
      );
      const offset = (y * reduced.width + x) * 4;
      return {
        color: {
          r: reduced.data[offset],
          g: reduced.data[offset + 1],
          b: reduced.data[offset + 2],
          a: reduced.data[offset + 3],
        },
        source: { width: reduced.width, height: reduced.height },
        side: 'reduced',
        x,
        y,
      };
    }
    const patch = originalPatch(imageX, imageY, 1, 1);
    if (!patch) return null;
    return {
      color: {
        r: patch.data[0],
        g: patch.data[1],
        b: patch.data[2],
        a: patch.data[3],
      },
      source: { width: original.width, height: original.height },
      side: 'original',
      x: patch.originX,
      y: patch.originY,
    };
  }

  /**
   * @param {number} clientX
   * @param {number} clientY
   * @returns {{ r:number, g:number, b:number, a:number }|null}
   */
  function pickColor(clientX, clientY) {
    return pickSample(clientX, clientY)?.color ?? null;
  }

  /**
   * Map a normalized source point to frame-local CSS coordinates. Markers use this
   * so they track pan, zoom, and window resizing without duplicating the transform.
   *
   * @param {number} u 0..1
   * @param {number} v 0..1
   * @returns {{ x:number, y:number }|null}
   */
  function imagePointToFrame(u, v) {
    if (!original) return null;
    return {
      x: offsetX + u * original.width * scale,
      y: offsetY + v * original.height * scale,
    };
  }

  /**
   * Sample the original image at a normalized point. Marker nudging uses this path
   * because the anchor belongs to the source image, not to the reduced preview.
   *
   * @param {number} u 0..1
   * @param {number} v 0..1
   * @returns {{ r:number, g:number, b:number, a:number }|null}
   */
  function pickColorAtImagePoint(u, v) {
    if (!original) return null;
    const x = Math.min(original.width - 1, Math.max(0, Math.floor(u * original.width)));
    const y = Math.min(original.height - 1, Math.max(0, Math.floor(v * original.height)));
    const patch = originalPatch(x, y, 1, 1);
    if (!patch) return null;
    return {
      r: patch.data[0],
      g: patch.data[1],
      b: patch.data[2],
      a: patch.data[3],
    };
  }

  const narrowViewport = window.matchMedia('(max-width: 979px)');
  let lastFrameWidth = frame.clientWidth;
  let lastFrameHeight = frame.clientHeight;
  const resizeObserver = new ResizeObserver(() => {
    const width = frame.clientWidth;
    if (width < 2) return;
    const height = frame.clientHeight;
    // Mobile browser chrome changes the visual viewport height while scrolling. Do not
    // re-fit the image for height-only changes there; keep the scale stable and redraw.
    const widthChanged = Math.abs(width - lastFrameWidth) > 1;
    const heightChanged = Math.abs(height - lastFrameHeight) > 1;
    if (autoFit) {
      if (!narrowViewport.matches || widthChanged) fit();
    } else if (widthChanged || (!narrowViewport.matches && heightChanged)) {
      // The rail or palette editor changed the frame size without a refit. Keep the
      // image under the frame center instead of anchoring it to the old top-left.
      const next = recenterOffsets(
        { offsetX, offsetY },
        { width, height },
        { width: lastFrameWidth, height: lastFrameHeight },
      );
      offsetX = next.offsetX;
      offsetY = next.offsetY;
    }
    renderNow();
    lastFrameWidth = width;
    lastFrameHeight = height;
  });
  resizeObserver.observe(frame);

  return {
    /**
     * @param {OriginalInput|null} image
     */
    setOriginal(image) {
      original = image
        ? { width: image.width, height: image.height, data: image.data ?? null }
        : null;
      originalBuffer = image
        ? (image.bitmap ??
          (image.data
            ? toCanvas({ data: image.data, width: image.width, height: image.height })
            : null))
        : null;
      reduced = null;
      reducedBuffer = null;
      errorMap = null;
      errorBuffer = null;
      worstPixels = null;
      autoFit = true;
      fit();
      scheduleRender();
    },
    /** @param {ImageLike|null} image */
    setReduced(image) {
      reduced = image;
      reducedBuffer = toCanvas(image);
      if (autoFit) fit();
      scheduleRender();
    },
    /**
     * Draw the CIEDE2000 heatmap on the right half instead of the mapped preview.
     * @param {ImageLike|null} image
     */
    setErrorMap(image) {
      errorMap = image;
      errorBuffer = toCanvas(image);
      if (!image) worstPixels = null;
      scheduleRender();
    },
    /**
     * Ranked worst pixels in error-map coordinates; drawn as numbered markers.
     * @param {WorstPixel[]|null} pixels
     */
    setWorstPixels(pixels) {
      worstPixels = pixels
        ? pixels.map((pixel) => ({ x: pixel.x, y: pixel.y, deltaE00: pixel.deltaE00 }))
        : null;
      scheduleRender();
    },
    /** @param {boolean} value */
    setShowOriginal(value) {
      showOriginal = value;
      scheduleRender();
    },
    fit,
    zoom100,
    zoomIn: () => zoomBy(1.25),
    zoomOut: () => zoomBy(1 / 1.25),
    setDivider,
    pickColor,
    pickSample,
    samplePatch,
    pickColorAtImagePoint,
    imagePointToFrame,
  };
}
