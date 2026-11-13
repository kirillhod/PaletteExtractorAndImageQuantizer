// @ts-check
/**
 * Shared JSDoc typedefs. This file has no runtime behavior.
 */

/** @typedef {{ r: number, g: number, b: number, a: number }} RGBA8 */ // 0..255
/** @typedef {{ r: number, g: number, b: number }} RGB8 */
/** @typedef {{ L: number, a: number, b: number }} Oklab */
/** @typedef {{ data: Uint8ClampedArray, width: number, height: number }} ImageDataLite */

/**
 * @typedef {Object} Histogram
 * @property {number} bits
 * @property {number} width
 * @property {number} height
 * @property {Float64Array} weight
 * @property {Float64Array} sumR
 * @property {Float64Array} sumG
 * @property {Float64Array} sumB
 * @property {number[]} occupied
 * @property {number} opaquePixels
 * @property {number} pixelCount
 */

/**
 * @typedef {Object} HistogramBin
 * @property {number} bin
 * @property {number} r
 * @property {number} g
 * @property {number} b
 * @property {number} weight
 * @property {Oklab} oklab
 */

/**
 * @typedef {Object} ExtractParams
 * @property {'popularity'|'median-cut'|'wu'|'octree'|'kmeans'} method
 * @property {number} colors
 * @property {'oklab'|'srgb'} space
 * @property {number=} seed
 * @property {number=} maxIters
 * @property {boolean=} refine
 */

/**
 * @typedef {Object} PaletteEntry
 * @property {number} id
 * @property {number} index
 * @property {RGBA8} color
 * @property {string} hex
 * @property {string|null} name
 * @property {string|null} role
 * @property {boolean} locked
 */

/** @typedef {PaletteEntry[]} Palette */

/**
 * @typedef {Object} PreviewResult
 * @property {Palette} palette
 * @property {ImageDataLite} preview
 * @property {{ histogramMs:number, extractMs:number, mapMs:number }} timings
 */

/**
 * @typedef {Object} ExportFile
 * @property {string} name
 * @property {string} mime
 * @property {ArrayBuffer} data
 * @property {{ ok:boolean, detail:string }} validation
 */

export {};
