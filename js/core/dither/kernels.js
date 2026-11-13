// @ts-check
/**
 * Error-diffusion kernels and Bayer matrix generation. Weights are fractions of the
 * quantization error; the denominator is included so tests can verify the sums.
 */

/**
 * @typedef {{ dx:number, dy:number, weight:number }} KernelTap
 * @typedef {{ denominator:number, taps:KernelTap[] }} ErrorKernel
 */

/** @type {Record<string, ErrorKernel>} */
export const ERROR_DIFFUSION_KERNELS = {
  'floyd-steinberg': {
    denominator: 16,
    taps: [
      { dx: 1, dy: 0, weight: 7 },
      { dx: -1, dy: 1, weight: 3 },
      { dx: 0, dy: 1, weight: 5 },
      { dx: 1, dy: 1, weight: 1 },
    ],
  },
  atkinson: {
    denominator: 8,
    taps: [
      { dx: 1, dy: 0, weight: 1 },
      { dx: 2, dy: 0, weight: 1 },
      { dx: -1, dy: 1, weight: 1 },
      { dx: 0, dy: 1, weight: 1 },
      { dx: 1, dy: 1, weight: 1 },
      { dx: 0, dy: 2, weight: 1 },
    ],
  },
  stucki: {
    denominator: 42,
    taps: [
      { dx: 1, dy: 0, weight: 8 },
      { dx: 2, dy: 0, weight: 4 },
      { dx: -2, dy: 1, weight: 2 },
      { dx: -1, dy: 1, weight: 4 },
      { dx: 0, dy: 1, weight: 8 },
      { dx: 1, dy: 1, weight: 4 },
      { dx: 2, dy: 1, weight: 2 },
      { dx: -2, dy: 2, weight: 1 },
      { dx: -1, dy: 2, weight: 2 },
      { dx: 0, dy: 2, weight: 4 },
      { dx: 1, dy: 2, weight: 2 },
      { dx: 2, dy: 2, weight: 1 },
    ],
  },
  jarvis: {
    denominator: 48,
    taps: [
      { dx: 1, dy: 0, weight: 7 },
      { dx: 2, dy: 0, weight: 5 },
      { dx: -2, dy: 1, weight: 3 },
      { dx: -1, dy: 1, weight: 5 },
      { dx: 0, dy: 1, weight: 7 },
      { dx: 1, dy: 1, weight: 5 },
      { dx: 2, dy: 1, weight: 3 },
      { dx: -2, dy: 2, weight: 1 },
      { dx: -1, dy: 2, weight: 3 },
      { dx: 0, dy: 2, weight: 5 },
      { dx: 1, dy: 2, weight: 3 },
      { dx: 2, dy: 2, weight: 1 },
    ],
  },
  burkes: {
    denominator: 32,
    taps: [
      { dx: 1, dy: 0, weight: 8 },
      { dx: 2, dy: 0, weight: 4 },
      { dx: -2, dy: 1, weight: 2 },
      { dx: -1, dy: 1, weight: 4 },
      { dx: 0, dy: 1, weight: 8 },
      { dx: 1, dy: 1, weight: 4 },
      { dx: 2, dy: 1, weight: 2 },
    ],
  },
  sierra: {
    denominator: 32,
    taps: [
      { dx: 1, dy: 0, weight: 5 },
      { dx: 2, dy: 0, weight: 3 },
      { dx: -2, dy: 1, weight: 2 },
      { dx: -1, dy: 1, weight: 4 },
      { dx: 0, dy: 1, weight: 5 },
      { dx: 1, dy: 1, weight: 4 },
      { dx: 2, dy: 1, weight: 2 },
      { dx: -1, dy: 2, weight: 2 },
      { dx: 0, dy: 2, weight: 3 },
      { dx: 1, dy: 2, weight: 2 },
    ],
  },
};

/**
 * @param {string} method
 * @returns {ErrorKernel|undefined}
 */
export function getErrorDiffusionKernel(method) {
  return ERROR_DIFFUSION_KERNELS[method];
}

/**
 * Recursive Bayer matrix. B1 = [[0]]; B2n = [[4B+0, 4B+2], [4B+3, 4B+1]].
 * @param {2|4|8} size
 * @returns {number[][]}
 */
export function bayerMatrix(size) {
  if (size !== 2 && size !== 4 && size !== 8) {
    throw new RangeError('Bayer size must be 2, 4 or 8');
  }
  /** @type {number[][]} */
  let matrix = [[0]];
  while (matrix.length < size) {
    const n = matrix.length;
    /** @type {number[][]} */
    const next = Array.from({ length: n * 2 }, () => new Array(n * 2).fill(0));
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        const v = matrix[y][x] * 4;
        next[y][x] = v;
        next[y][x + n] = v + 2;
        next[y + n][x] = v + 3;
        next[y + n][x + n] = v + 1;
      }
    }
    matrix = next;
  }
  return matrix;
}

export const BAYER_2 = bayerMatrix(2);
export const BAYER_4 = bayerMatrix(4);
export const BAYER_8 = bayerMatrix(8);
