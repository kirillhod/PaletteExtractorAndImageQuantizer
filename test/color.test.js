// @ts-check
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  contrastRatio,
  deltaE00,
  deltaE76,
  formatHex,
  formatHexAlpha,
  oklabToRgb8,
  parseHex,
  rgb8ToOklab,
  relativeLuminance,
} from '../js/core/color.js';

/**
 * @param {number} actual
 * @param {number} expected
 * @param {number} tolerance
 * @param {string} [label]
 */
function close(actual, expected, tolerance, label = '') {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${label}: expected ${expected} ± ${tolerance}, got ${actual}`,
  );
}

test('hex parsing accepts shorthand, long form and alpha', () => {
  assert.deepEqual(parseHex('#fff'), { r: 255, g: 255, b: 255, a: 255 });
  assert.deepEqual(parseHex('#0b0d10'), { r: 11, g: 13, b: 16, a: 255 });
  assert.deepEqual(parseHex('0B0D10FF'), { r: 11, g: 13, b: 16, a: 255 });
  assert.deepEqual(parseHex('#0b0d1080'), { r: 11, g: 13, b: 16, a: 128 });
  assert.deepEqual(parseHex(' #abc '), { r: 170, g: 187, b: 204, a: 255 });
});

test('hex parsing rejects invalid input', () => {
  assert.throws(() => parseHex('#12'), /invalid hex/);
  assert.throws(() => parseHex('#gggggg'), /invalid hex/);
  assert.throws(() => parseHex(/** @type {any} */ (null)), /must be a string/);
});

test('hex formatting is lowercase and zero-padded', () => {
  assert.equal(formatHex({ r: 11, g: 13, b: 16 }), '#0b0d10');
  assert.equal(formatHex({ r: 0, g: 0, b: 0 }), '#000000');
  assert.equal(formatHexAlpha({ r: 11, g: 13, b: 16, a: 8 }), '#0b0d1008');
  assert.equal(formatHexAlpha(parseHex('#ABCDEF')), '#abcdefff');
});

test('Oklab matches published reference values', () => {
  const red = rgb8ToOklab(255, 0, 0);
  close(red.L, 0.62796, 5e-4, 'red L');
  close(red.a, 0.22486, 5e-4, 'red a');
  close(red.b, 0.12585, 5e-4, 'red b');

  const green = rgb8ToOklab(0, 255, 0);
  close(green.L, 0.86644, 5e-4, 'green L');
  close(green.a, -0.23389, 5e-4, 'green a');
  close(green.b, 0.1795, 5e-4, 'green b');

  const blue = rgb8ToOklab(0, 0, 255);
  close(blue.L, 0.45201, 5e-4, 'blue L');
  close(blue.a, -0.03246, 5e-4, 'blue a');
  close(blue.b, -0.31153, 5e-4, 'blue b');

  const white = rgb8ToOklab(255, 255, 255);
  close(white.L, 1, 5e-4, 'white L');
  close(white.a, 0, 5e-4, 'white a');
  close(white.b, 0, 5e-4, 'white b');

  const black = rgb8ToOklab(0, 0, 0);
  assert.deepEqual(black, { L: 0, a: 0, b: 0 });
});

test('sRGB → Oklab → sRGB round-trips within one 8-bit step', () => {
  for (let r = 0; r <= 255; r += 17) {
    for (let g = 0; g <= 255; g += 17) {
      for (let b = 0; b <= 255; b += 17) {
        const oklab = rgb8ToOklab(r, g, b);
        const back = oklabToRgb8(oklab.L, oklab.a, oklab.b);
        assert.ok(
          Math.abs(back.r - r) <= 1 && Math.abs(back.g - g) <= 1 && Math.abs(back.b - b) <= 1,
          `round-trip ${r},${g},${b} -> ${back.r},${back.g},${back.b}`,
        );
      }
    }
  }
});

// Sharma, Wu & Dalal (2005), CIEDE2000 test data. Columns:
// [L1, a1, b1, L2, a2, b2, expected dE00]
const SHARMA_PAIRS = [
  [50, 2.6772, -79.7751, 50, 0, -82.7485, 2.0425],
  [50, 3.1571, -77.2803, 50, 0, -82.7485, 2.8615],
  [50, 2.8361, -74.02, 50, 0, -82.7485, 3.4412],
  [50, -1.3802, -84.2814, 50, 0, -82.7485, 1.0],
  [50, -1.1848, -84.8006, 50, 0, -82.7485, 1.0],
  [50, -0.9009, -85.5211, 50, 0, -82.7485, 1.0],
  [50, 0, 0, 50, -1, 2, 2.3669],
  [50, -1, 2, 50, 0, 0, 2.3669],
  [50, 2.49, -0.001, 50, -2.49, 0.0009, 7.1792],
  [50, 2.49, -0.001, 50, -2.49, 0.001, 7.1792],
  [50, 2.49, -0.001, 50, -2.49, 0.0011, 7.2195],
  [50, 2.49, -0.001, 50, -2.49, 0.0012, 7.2195],
  [50, -0.001, 2.49, 50, 0.0009, -2.49, 4.8045],
  [50, -0.001, 2.49, 50, 0.001, -2.49, 4.8045],
  [50, -0.001, 2.49, 50, 0.0011, -2.49, 4.7461],
  [50, 2.5, 0, 50, 0, -2.5, 4.3065],
  [50, 2.5, 0, 73, 25, -18, 27.1492],
  [50, 2.5, 0, 61, -5, 29, 22.8977],
  [50, 2.5, 0, 56, -27, -3, 31.903],
  [50, 2.5, 0, 58, 24, 15, 19.4535],
  [50, 2.5, 0, 50, 3.1736, 0.5854, 1.0],
  [50, 2.5, 0, 50, 3.2972, 0, 1.0],
  [50, 2.5, 0, 50, 1.8634, 0.5757, 1.0],
  [50, 2.5, 0, 50, 3.2592, 0.335, 1.0],
  [60.2574, -34.0099, 36.2677, 60.4626, -34.1751, 39.4387, 1.2644],
  [63.0109, -31.0961, -5.8663, 62.8187, -29.7946, -4.0864, 1.263],
  [61.2901, 3.7196, -5.3901, 61.4292, 2.248, -4.962, 1.8731],
  [35.0831, -44.1164, 3.7933, 35.0232, -40.0716, 1.5901, 1.8645],
  [22.7233, 20.0904, -46.694, 23.0331, 14.973, -42.5619, 2.0373],
  [36.4612, 47.858, 18.3852, 36.2715, 50.5065, 21.2231, 1.4146],
  [90.8027, -2.0831, 1.441, 91.1528, -1.6435, 0.0447, 1.4441],
  [90.9257, -0.5406, -0.9208, 88.6381, -0.8985, -0.7239, 1.5381],
  [6.7747, -0.2908, -2.4247, 5.8714, -0.0985, -2.2286, 0.6377],
  [2.0776, 0.0795, -1.135, 0.9033, -0.0636, -0.5514, 0.9082],
];

test('CIEDE2000 matches the Sharma reference data', () => {
  for (const [L1, a1, b1, L2, a2, b2, expected] of SHARMA_PAIRS) {
    const got = deltaE00({ L: L1, a: a1, b: b1 }, { L: L2, a: a2, b: b2 });
    close(got, expected, 1e-4, `dE00(${L1},${a1},${b1} | ${L2},${a2},${b2})`);
  }
});

test('CIEDE2000 is symmetric and zero for identical colors', () => {
  const a = { L: 61.29, a: 3.72, b: -5.39 };
  const b = { L: 35.08, a: -44.12, b: 3.79 };
  const forward = deltaE00(a, b);
  const backward = deltaE00(b, a);
  close(forward, backward, 1e-12, 'symmetry');
  close(deltaE00(a, a), 0, 1e-12, 'identity');
});

test('CIE76 is Euclidean in Lab', () => {
  close(deltaE76({ L: 0, a: 0, b: 0 }, { L: 3, a: 4, b: 0 }), 5, 1e-12);
});

test('WCAG contrast ratio of black and white is 21', () => {
  close(relativeLuminance(255, 255, 255), 1, 1e-12);
  close(relativeLuminance(0, 0, 0), 0, 1e-12);
  close(
    contrastRatio({ r: 0, g: 0, b: 0 }, { r: 255, g: 255, b: 255 }),
    21,
    1e-9,
  );
  close(contrastRatio({ r: 0, g: 0, b: 0 }, { r: 0, g: 0, b: 0 }), 1, 1e-12);
});
