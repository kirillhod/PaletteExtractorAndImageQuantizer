// @ts-check
/** @typedef {{ r:number, g:number, b:number, a?:number }} TestColor */

/**
 * @param {number} width
 * @param {number} height
 * @param {(x:number, y:number) => TestColor} pixel
 * @returns {{ data: Uint8ClampedArray, width:number, height:number }}
 */
export function makeImage(width, height, pixel) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const color = pixel(x, y);
      const i = (y * width + x) * 4;
      data[i] = color.r;
      data[i + 1] = color.g;
      data[i + 2] = color.b;
      data[i + 3] = color.a ?? 255;
    }
  }
  return { data, width, height };
}

/**
 * @param {number} width
 * @param {number} height
 * @param {TestColor} color
 */
export function solidImage(width, height, color) {
  return makeImage(width, height, () => color);
}

/**
 * Four equal quadrants: red, green, blue, white.
 * @param {number} [size]
 */
export function quadrantsImage(size = 16) {
  return makeImage(size, size, (x, y) => {
    const left = x < size / 2;
    const top = y < size / 2;
    if (top && left) return { r: 255, g: 0, b: 0 };
    if (top && !left) return { r: 0, g: 255, b: 0 };
    if (!top && left) return { r: 0, g: 0, b: 255 };
    return { r: 255, g: 255, b: 255 };
  });
}
