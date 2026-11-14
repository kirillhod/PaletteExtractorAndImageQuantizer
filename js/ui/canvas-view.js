// @ts-check
/**
 * @typedef {{ data: Uint8ClampedArray, width:number, height:number }} ImageLike
 */

/**
 * @param {{ canvas: HTMLCanvasElement, frame: HTMLElement, divider: HTMLElement }} options
 */
export function createCanvasView(options) {
  const { canvas, frame, divider } = options;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas 2D is unavailable');

  const handle = /** @type {HTMLElement|null} */ (divider.querySelector('.peiq-divider__handle'));

  /** @type {ImageLike|null} */
  let original = null;
  /** @type {ImageLike|null} */
  let reduced = null;
  /** @type {HTMLCanvasElement|null} */
  let originalBuffer = null;
  /** @type {HTMLCanvasElement|null} */
  let reducedBuffer = null;

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
    if (!original || !originalBuffer) return;

    context.save();
    context.translate(offsetX, offsetY);
    context.scale(scale, scale);
    context.imageSmoothingEnabled = scale < 1;
    context.drawImage(originalBuffer, 0, 0);
    context.restore();

    if (reduced && reducedBuffer && !showOriginal) {
      const split = width * dividerFraction;
      context.save();
      context.beginPath();
      context.rect(split, 0, width - split, height);
      context.clip();
      context.translate(offsetX, offsetY);
      context.scale(scale, scale);
      context.imageSmoothingEnabled = scale < 1;
      context.drawImage(reducedBuffer, 0, 0);
      context.restore();
    }
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

  const resizeObserver = new ResizeObserver(() => {
    if (autoFit) fit();
    else scheduleRender();
  });
  resizeObserver.observe(frame);

  return {
    /** @param {ImageLike|null} image */
    setOriginal(image) {
      original = image;
      originalBuffer = toCanvas(image);
      reduced = null;
      reducedBuffer = null;
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
  };
}
