// @ts-check
/**
 * Color-science primitives for PaletteExtractorAndImageQuantizer.
 *
 * Pure, DOM-free, dependency-free. Everything here is covered by
 * known-answer tests in test/color.test.js.
 *
 * Conventions:
 *   - 8-bit sRGB values are integers in 0..255.
 *   - Alpha in RGBA8 is 0..255 (255 = opaque).
 *   - Oklab / CIELAB use L in 0..1 (Oklab) or 0..100 (Lab), a/b unbounded.
 */

/** @typedef {{ r: number, g: number, b: number, a: number }} RGBA8 */
/** @typedef {{ L: number, a: number, b: number }} Oklab */
/** @typedef {{ L: number, a: number, b: number }} Lab */
/** @typedef {{ r: number, g: number, b: number }} LinearRgb */

const D65 = { X: 0.95047, Y: 1.0, Z: 1.08883 };

const LAB_EPS = 216 / 24389; // (6/29)^3
const LAB_KAPPA = 24389 / 27;

const POW_25_7 = 25 ** 7;

/** @param {number} v */
export function clamp01(v) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/**
 * Decode a gamma-encoded sRGB channel (0..1) to linear light.
 * @param {number} c
 * @returns {number}
 */
export function srgbToLinear(c) {
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/**
 * Encode a linear-light channel to gamma-encoded sRGB (may fall outside 0..1).
 * @param {number} c
 * @returns {number}
 */
export function linearToSrgb(c) {
  return c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055;
}

/**
 * @param {number} v 0..255
 * @returns {number} 0..1 linear
 */
export function srgb8ToLinear(v) {
  return srgbToLinear(v / 255);
}

/**
 * @param {number} v linear (may be out of gamut)
 * @returns {number} 0..255
 */
export function linearToSrgb8(v) {
  const s = linearToSrgb(v);
  const clamped = s <= 0 ? 0 : s >= 1 ? 1 : s;
  return Math.round(clamped * 255);
}

/**
 * Linear sRGB → Oklab.
 * @param {number} r
 * @param {number} g
 * @param {number} b
 * @returns {Oklab}
 */
export function linearRgbToOklab(r, g, b) {
  const l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b;
  const m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b;
  const s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b;

  const l_ = Math.cbrt(l);
  const m_ = Math.cbrt(m);
  const s_ = Math.cbrt(s);

  return {
    L: 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_,
    a: 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_,
    b: 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_,
  };
}

/**
 * Oklab → linear sRGB (values may be outside 0..1 = out of gamut).
 * @param {number} L
 * @param {number} a
 * @param {number} b
 * @returns {LinearRgb}
 */
export function oklabToLinearRgb(L, a, b) {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;

  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;

  return {
    r: 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    g: -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    b: -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  };
}

/**
 * 8-bit sRGB → Oklab.
 * @param {number} r
 * @param {number} g
 * @param {number} b
 * @returns {Oklab}
 */
export function rgb8ToOklab(r, g, b) {
  return linearRgbToOklab(srgb8ToLinear(r), srgb8ToLinear(g), srgb8ToLinear(b));
}

/**
 * Oklab → 8-bit sRGB (clamped, rounded).
 * @param {number} L
 * @param {number} a
 * @param {number} b
 * @returns {{ r: number, g: number, b: number }}
 */
export function oklabToRgb8(L, a, b) {
  const lin = oklabToLinearRgb(L, a, b);
  return {
    r: linearToSrgb8(lin.r),
    g: linearToSrgb8(lin.g),
    b: linearToSrgb8(lin.b),
  };
}

/**
 * Squared Euclidean distance in Oklab. Good for nearest-color decisions.
 * @param {Oklab} x
 * @param {Oklab} y
 * @returns {number}
 */
export function oklabDistanceSq(x, y) {
  const dL = x.L - y.L;
  const da = x.a - y.a;
  const db = x.b - y.b;
  return dL * dL + da * da + db * db;
}

/**
 * @param {Oklab} x
 * @param {Oklab} y
 * @returns {number}
 */
export function oklabDistance(x, y) {
  return Math.sqrt(oklabDistanceSq(x, y));
}

/**
 * @param {number} t
 * @returns {number}
 */
function labF(t) {
  return t > LAB_EPS ? Math.cbrt(t) : (LAB_KAPPA * t + 16) / 116;
}

/**
 * 8-bit sRGB → CIELAB (D65).
 * @param {number} r
 * @param {number} g
 * @param {number} b
 * @returns {Lab}
 */
export function rgb8ToLab(r, g, b) {
  const lr = srgb8ToLinear(r);
  const lg = srgb8ToLinear(g);
  const lb = srgb8ToLinear(b);

  const X = 0.4124564 * lr + 0.3575761 * lg + 0.1804375 * lb;
  const Y = 0.2126729 * lr + 0.7151522 * lg + 0.072175 * lb;
  const Z = 0.0193339 * lr + 0.119192 * lg + 0.9503041 * lb;

  const fx = labF(X / D65.X);
  const fy = labF(Y / D65.Y);
  const fz = labF(Z / D65.Z);

  return {
    L: 116 * fy - 16,
    a: 500 * (fx - fy),
    b: 200 * (fy - fz),
  };
}

/**
 * CIE76 color difference (plain Euclidean in CIELAB).
 * @param {Lab} x
 * @param {Lab} y
 * @returns {number}
 */
export function deltaE76(x, y) {
  const dL = x.L - y.L;
  const da = x.a - y.a;
  const db = x.b - y.b;
  return Math.sqrt(dL * dL + da * da + db * db);
}

const RAD = Math.PI / 180;
const DEG = 180 / Math.PI;

/**
 * CIEDE2000 color difference.
 * Reference: Sharma, Wu & Dalal (2005), implementation notes + test data.
 *
 * @param {Lab} lab1
 * @param {Lab} lab2
 * @param {number} [kL=1]
 * @param {number} [kC=1]
 * @param {number} [kH=1]
 * @returns {number}
 */
export function deltaE00(lab1, lab2, kL = 1, kC = 1, kH = 1) {
  const { L: L1, a: a1, b: b1 } = lab1;
  const { L: L2, a: a2, b: b2 } = lab2;

  const C1 = Math.hypot(a1, b1);
  const C2 = Math.hypot(a2, b2);
  const Cbar = (C1 + C2) / 2;
  const Cbar7 = Cbar ** 7;

  const G = 0.5 * (1 - Math.sqrt(Cbar7 / (Cbar7 + POW_25_7)));

  const a1p = (1 + G) * a1;
  const a2p = (1 + G) * a2;

  const C1p = Math.hypot(a1p, b1);
  const C2p = Math.hypot(a2p, b2);

  let h1p = 0;
  if (C1p !== 0) {
    h1p = Math.atan2(b1, a1p) * DEG;
    if (h1p < 0) h1p += 360;
  }
  let h2p = 0;
  if (C2p !== 0) {
    h2p = Math.atan2(b2, a2p) * DEG;
    if (h2p < 0) h2p += 360;
  }

  const dLp = L2 - L1;
  const dCp = C2p - C1p;

  let dhp = 0;
  if (C1p * C2p !== 0) {
    const diff = h2p - h1p;
    if (Math.abs(diff) <= 180) dhp = diff;
    else if (diff > 180) dhp = diff - 360;
    else dhp = diff + 360;
  }
  const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin((dhp / 2) * RAD);

  const Lbarp = (L1 + L2) / 2;
  const Cbarp = (C1p + C2p) / 2;

  let hbarp = 0;
  if (C1p * C2p !== 0) {
    const sum = h1p + h2p;
    if (Math.abs(h1p - h2p) <= 180) hbarp = sum / 2;
    else if (sum < 360) hbarp = (sum + 360) / 2;
    else hbarp = (sum - 360) / 2;
  } else {
    hbarp = h1p + h2p;
  }

  const T =
    1 -
    0.17 * Math.cos((hbarp - 30) * RAD) +
    0.24 * Math.cos(2 * hbarp * RAD) +
    0.32 * Math.cos((3 * hbarp + 6) * RAD) -
    0.2 * Math.cos((4 * hbarp - 63) * RAD);

  const dTheta = 30 * Math.exp(-(((hbarp - 275) / 25) ** 2));
  const Cbarp7 = Cbarp ** 7;
  const RC = 2 * Math.sqrt(Cbarp7 / (Cbarp7 + POW_25_7));

  const Lm50sq = (Lbarp - 50) ** 2;
  const SL = 1 + (0.015 * Lm50sq) / Math.sqrt(20 + Lm50sq);
  const SC = 1 + 0.045 * Cbarp;
  const SH = 1 + 0.015 * Cbarp * T;
  const RT = -Math.sin(2 * dTheta * RAD) * RC;

  const dl = dLp / (kL * SL);
  const dc = dCp / (kC * SC);
  const dh = dHp / (kH * SH);

  return Math.sqrt(dl * dl + dc * dc + dh * dh + RT * dc * dh);
}

/**
 * Parse #rgb, #rgba, #rrggbb, #rrggbbaa.
 * @param {string} hex
 * @returns {RGBA8}
 */
export function parseHex(hex) {
  if (typeof hex !== 'string') throw new TypeError('hex must be a string');
  let s = hex.trim().replace(/^#/, '');

  if (s.length === 3 || s.length === 4) {
    s = s
      .split('')
      .map((ch) => ch + ch)
      .join('');
  }

  if (!/^[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/.test(s)) {
    throw new Error(`invalid hex color: ${hex}`);
  }

  return {
    r: parseInt(s.slice(0, 2), 16),
    g: parseInt(s.slice(2, 4), 16),
    b: parseInt(s.slice(4, 6), 16),
    a: s.length === 8 ? parseInt(s.slice(6, 8), 16) : 255,
  };
}

/** @param {number} v */
function hex2(v) {
  return Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
}

/**
 * Format as lowercase #rrggbb. Alpha is dropped.
 * @param {{ r: number, g: number, b: number }} color
 * @returns {string}
 */
export function formatHex(color) {
  return `#${hex2(color.r)}${hex2(color.g)}${hex2(color.b)}`;
}

/**
 * Format as #rrggbbaa.
 * @param {RGBA8} color
 * @returns {string}
 */
export function formatHexAlpha(color) {
  return `#${hex2(color.r)}${hex2(color.g)}${hex2(color.b)}${hex2(color.a)}`;
}

/**
 * WCAG 2.x relative luminance (0..1).
 * @param {number} r
 * @param {number} g
 * @param {number} b
 * @returns {number}
 */
export function relativeLuminance(r, g, b) {
  return (
    0.2126 * srgb8ToLinear(r) +
    0.7152 * srgb8ToLinear(g) +
    0.0722 * srgb8ToLinear(b)
  );
}

/**
 * WCAG 2.x contrast ratio (1..21).
 * @param {{ r: number, g: number, b: number }} a
 * @param {{ r: number, g: number, b: number }} b
 * @returns {number}
 */
export function contrastRatio(a, b) {
  const la = relativeLuminance(a.r, a.g, a.b);
  const lb = relativeLuminance(b.r, b.g, b.b);
  const hi = Math.max(la, lb);
  const lo = Math.min(la, lb);
  return (hi + 0.05) / (lo + 0.05);
}
