# PaletteExtractorAndImageQuantizer — Implementation Plan

**Plan version:** 1.0.0
**Product version at completion:** 1.0.0
**Status:** Approved for implementation
**Date:** 2026-11-13
**License:** GPL-3.0-only (owner decision, 2026-11-13)
**Source research:** [RESEARCH_REPORT.md](RESEARCH_REPORT.md)
**Public name:** `PaletteExtractorAndImageQuantizer` (the repository name).
**Short mark:** `PEIQ`.
**Identifiers:** frozen from this revision (`peiq-` CSS prefix, `peiq/*` JSON namespace,
`peiq.*` storage keys).

Normative keywords: **MUST**, **MUST NOT**, **SHOULD**, **SHOULD NOT**, **MAY**
(RFC 2119 semantics). A deviation from a MUST requires updating this document first.

---

## 0. How to use this document

This is the single source of truth for product scope, architecture, algorithms, output
contracts, testing, and release criteria. `AGENTS.md` contains the operating rules for
agents; it defers to this plan for *what* to build.

- Read §1–§3 before touching code.
- Read §4–§7 for any algorithm, color, dithering, or export work.
- Read §8 before UI work.
- Read §10–§12 for tests and contracts.
- Keep the §18 decision log current; never silently diverge from a frozen contract.

### Current state (2026-11-13)

| Item | State |
|---|---|
| Research report | Complete |
| Plan | This document, v1.0.0 |
| Scaffold | `index.html`, CSS, `package.json`, `.gitignore`, dev server, CI |
| Core | Color, histogram, five extractors, refinement, exact/LUT mapping, dithering, PNG index/encode/decode, palettes |
| UI | Stage + compact collapsible rail, themes, extract/map modes, fixed palettes, dithering, indexed PNG, Help with references and credits |
| Tests | 85 passing (`node --test`), including golden hashes, dithering, palettes, indexed PNG, references |
| Version | `js/core/version.js`; `v0.3.0` tagged; M2 complete |
| Next | M3: ΔE00 QA, palette editor/locks, presets, all palette formats, remaining theory topics |

---

## 1. Product definition

### 1.1 One sentence

A browser-local **palette compiler** that turns images into palette-compliant,
engine-ready assets — indexed PNG, palette strip, palette sidecar, QA report — with
deterministic output and no uploads.

### 1.2 Target users

| User | Job to be done |
|---|---|
| Indie pixel artist | Constrain a sprite or tileset to a locked palette, preview dithering, export an indexed PNG that imports cleanly. |
| Technical artist / TA | Batch-check that assets use only allowed colors, produce engine lookup textures, and keep indices stable across frames. |
| UI / brand designer | Extract a small semantic palette, check contrast, export CSS variables and design tokens. |
| Hobbyist | Reduce a photo to N colors and export a usable palette, without an account or upload. |

### 1.3 What v1.0.0 is

- A single-page, static, local-only web tool.
- An extractor **and** a fixed-palette mapper.
- A producer of validated artifacts: indexed PNG, palette strip, palette JSON, QA report.
- An **in-product learning layer**: contextual hints and a Help drawer that explain the
  theory and link to canonical sources without blocking the workflow.
- Deterministic for a fixed browser version + parameters + seed.
- Two complete themes, dark and light, with automatic system detection, a 3-state header
  toggle (auto / light / dark), persisted preference, and no mixed tokens.

### 1.4 What v1.0.0 is not

Batch/ZIP, CLI, server API, accounts, print/CMYK, neural quantization, animated-frame
decoding, per-tile palette banks, palette cycling, cloud sync. See §19.

It is also **not** a separate documentation site, a first-run tour, or a wall of permanent
explanatory text. Learning is opt-in, contextual, and dismissible.

### 1.5 Success criteria

| Criterion | Target |
|---|---|
| Time to first compliant asset | < 60 s from drop to indexed PNG + strip |
| Strip round-trip | 100% pixel-exact on the release corpus |
| Indexed PNG round-trip | Decoded indices equal the generated index map |
| Palette compliance | 100% of opaque output pixels use an exported palette entry |
| Determinism | Same browser/version + params + seed → identical palette, index map, decoded pixels |
| Privacy | Zero network requests after page load (verified in DevTools) |
| Dependency count | Zero runtime dependencies, zero build step |
| Theme parity | Every theme-sensitive token defined in both themes; auto + 3-state toggle; no FOUC; instant switch |
| Learning layer | ≥12 guide topics; every non-obvious control has a hint; nothing auto-opens |

---

## 2. Feature matrix (v1.0.0)

`MUST` items are release-blocking. `SHOULD` items ship in v1.0.0 if green, otherwise move
to v1.0.x without changing the contracts.

| ID | Feature | Priority | Milestone | Acceptance criterion |
|---|---|---|---|---|
| F-01 | Load PNG/JPEG/WebP/GIF/BMP/AVIF; drag-drop, picker, paste | MUST | M1 | Image appears with dimensions and color count; unsupported input shows a clear error |
| F-02 | Preview with before/after slider, zoom, pan | MUST | M1 | Divider draggable; fit/100% work; no main-thread freeze |
| F-03 | Extraction: popularity, median cut, Wu, octree, K-means++ | MUST | M1–M2 | Each method returns a valid palette; deterministic with same seed |
| F-04 | Working space Oklab (default) and sRGB | MUST | M1 | Space recorded in manifest; conversions match §5 |
| F-05 | Fixed-palette import (.hex/.gpl/.pal/.json/PNG strip) | MUST | M2 | 1–256 entries; invalid files rejected with a specific error |
| F-06 | Built-in palettes (PICO-8, Game Boy, C64, ZX Spectrum, EGA) | MUST | M2 | Counts and values match Appendix C; selectable in one click |
| F-07 | Map image → palette, documented tie-break | MUST | M2 | 100% of opaque pixels use a palette entry; lowest index wins ties |
| F-08 | Dithering: none, FS, Atkinson, Stucki, Jarvis, Burkes, Sierra, Bayer 2/4/8, blue noise | MUST | M2 | Palette compliance preserved; strength/serpentine/edge-stop behave per §6.5 |
| F-09 | Palette editor: add, remove, lock, reorder, rename, role | MUST | M3 | Locked entries survive sort/removal; IDs stable |
| F-10 | Palette ordering: source, hue ↑/↓, lightness ↑/↓ | MUST | M1/M3 | Strip and swatches follow the order; custom order and locks land in M3 |
| F-11 | Indexed PNG export with reserved transparent index | MUST | M2 | Bit depth rule, `PLTE`/`tRNS`, round-trip equality |
| F-12 | 1×N / N×1 palette strip export + validation | MUST | M1 | Exact dimensions, no profile, every pixel validated |
| F-13 | Exports: .hex, .gpl, .pal, .json, .css, .ase | MUST | M3 | Parse back to the same palette (where the format is lossless) |
| F-14 | QA: ΔE00 mean/p95/max, worst pixels, error map, compliance | MUST | M3 | Report values match independent recomputation on fixtures |
| F-15 | Manifest with params, hashes, checks | MUST | M3 | Canonical JSON; hash stable across reruns |
| F-16 | Presets: Photo, Pixel Art, Retro 16, Game Sprite, UI/Brand | MUST | M3 | Applying a preset sets documented parameters; user can override |
| F-17 | Palette swap / recolor preview | MUST | M3 | Same-length palette swaps indices exactly; mismatch is rejected |
| F-18 | WCAG contrast report | MUST | M3 | Black/white = 21; matrix values match `color.js` |
| F-19 | Responsive layout + keyboard + ARIA | MUST | M4 | Usable at 360 px; all controls reachable by keyboard |
| F-20 | Static deploy on GitHub Pages | MUST | M4 | HTTPS page loads; worker and all assets resolve under the repo subpath |
| F-21 | Yliluoma ordered dithering | SHOULD | v1.1 | Deferred; not release-blocking |
| F-22 | DTCG design-token export | SHOULD | M3 | Valid DTCG JSON for ≤64 entries |
| F-23 | URL-hash state (params only) | SHOULD | M4 | Reload restores params; no image data in URL |
| F-24 | Two complete themes: dark + light, auto by system + 3-state toggle, persisted | MUST | M4 | No mixed tokens; no FOUC; instant switch; light/dark parity test |
| F-25 | In-product learning layer: contextual hints + Help drawer | MUST | M3–M4 | Every non-obvious control has a hint; ≥12 guide topics with canonical links; never auto-opens; keyboard accessible |
| F-26 | Deep links to Help topics | SHOULD | M4 | `#help=<topic>` opens the matching topic; params hash still works |

---

## 3. Environment and constraints

### 3.1 Hard constraints

| Constraint | Rule |
|---|---|
| Runtime dependencies | **Zero.** `package.json` MUST have no `dependencies` or `devDependencies`. |
| Build step | **None.** Native ES modules served as-is; no bundler, transpiler, minifier, CSS preprocessor. |
| Hosting | GitHub Pages, static, HTTPS. All paths relative (`./js/...`) so project pages work under `/<repo>/`. |
| Processing | 100% client-side. No uploads, no telemetry, no CDN, no external/CDN fonts, no network calls after load. Self-hosted Inter (OFL) is the declared font; see `DESIGN.md` §3. |
| Tooling | Node 22 built-ins only: `node --test`, `node:http`. |
| Types | JSDoc + `// @ts-check`; no TypeScript compilation. |
| License | GPL-3.0-only. Original code only; no copied GPL-incompatible snippets. |

### 3.2 Browser baseline

Chrome/Edge 111+, Firefox 113+, Safari 16.4+.

Required APIs: ES modules, Web Workers, `createImageBitmap`, canvas 2D,
`CompressionStream('deflate')`, `DecompressionStream('deflate')`, `crypto.subtle`,
`structuredClone` only if feature-detected. Theme APIs: `matchMedia('(prefers-color-scheme: dark)')`,
`localStorage` (optional; invalid/unavailable falls back to `auto`), CSS `color-scheme`.

Feature fallbacks:

| API missing | Behavior |
|---|---|
| `CompressionStream` | Use zlib stored-block writer (§12.3). |
| `DecompressionStream` | Strict strip import/validation unavailable; use canvas decode and mark the report `strictValidation: false`. |
| `crypto.subtle` | Use FNV-1a 64-bit; set `hashAlgorithm: "fnv1a64"` in the report. |

### 3.3 Input policy

- Static images only. Animated GIF/APNG: first frame, with a UI note.
- Input is treated as sRGB. Embedded ICC profiles may be applied by the browser's decoder;
  this is documented, not “fixed” in v1.
- 16-bit and HDR inputs are downconverted by canvas to 8-bit sRGB; documented.
- Maximum decoded dimensions: **16,777,216 pixels** (e.g. 4096×4096).
- Maximum file size: **64 MiB**.
- Images above the pixel cap are rejected with an explicit message; optional downscaled
  preview is allowed only when labeled. Final export MUST NOT silently downscale.

### 3.4 Security and privacy

- No `fetch`, `XMLHttpRequest`, WebSocket, beacon, or third-party script at runtime.
- Downloads use `Blob` + object URLs, revoked after use.
- No service worker in v1.
- Strip EXIF/ICC/comments from outputs by construction (own PNG encoder writes only the
  required chunks).
- A meta CSP SHOULD be added: `default-src 'self'; img-src 'self' blob: data:;
  style-src 'self'; script-src 'self'; worker-src 'self' blob:; connect-src 'none'`.
- External references open only on an explicit user click, with `target="_blank"` and
  `rel="noopener noreferrer"`. No prefetch, preconnect, embed, iframe, or automatic
  navigation. The tool itself remains local-only.
- Cap dimensions before allocation; reject decompression bombs.

### 3.5 Repository and deploy

```
/                     index.html, .nojekyll, package.json, LICENSE, README.md,
                      IMPLEMENTATION_PLAN.md, AGENTS.md, DESIGN.md
/css/                 tokens, base, layout, components, canvas, learn, responsive
/js/                  main.js, theme-init.js, ui/, content/, workers/, core/
/assets/              blue-noise mask, icons, optional palette data, self-hosted Inter (OFL) + license
/test/                node --test suites and fixtures helpers
/tools/               dev-server.mjs, gen-blue-noise.mjs
/.github/workflows/   ci.yml, pages.yml
```

GitHub Pages serves the repository root. CI runs `node --test`; deploy uses the official
Pages actions. `.nojekyll` MUST exist. `js/content/` holds static, trusted learning data;
it is never fetched at runtime. `npm run dev` binds to all interfaces so a phone on the
same network can open the tool; `--host=localhost` keeps it loopback-only.

### 3.6 Licensing and attribution

- Application code is original and GPL-3.0-only; no third-party source is copied.
- Published algorithms are implemented from their descriptions. Ideas and formulas are
  not copyrightable, but the papers are credited. Canonical references live in
  `js/content/references.js` and render in the Help drawer; print-only papers are cited
  without a redistributed PDF.
- Inter is self-hosted under the SIL Open Font License 1.1; `assets/fonts/OFL.txt` ships
  with it and the provenance is recorded in `assets/README.md`.
- Built-in palettes are factual hardware/community values. Product names and trademarks
  belong to their owners; the project is not affiliated with them.
- The visual system is original CSS/SVG inspired by Blender’s public design language. No
  Blender code, logo, wordmark, theme file, screenshot, or artwork is included.
- The blue-noise mask is generated in-repo by `tools/gen-blue-noise.mjs`; no third-party
  mask or image is redistributed.
- New assets MUST have a recorded source and license before they land. Do not add a
  dependency, font, icon pack, image, or code snippet with unclear terms.

---

## 4. Architecture

### 4.1 Layers

```
┌───────────────────────────── UI (DOM, canvas) ─────────────────────────────┐
│ main.js · ui/state.js · ui/controls · canvas-view · palette-view · qa-view │
└───────────────────────────────────┬────────────────────────────────────────┘
                                    │ postMessage (transferables)
┌───────────────────────────────────▼────────────────────────────────────────┐
│ pipeline.worker.js                                                          │
└───────────────────────────────────┬────────────────────────────────────────┘
┌───────────────────────────────────▼────────────────────────────────────────┐
│ core/ (DOM-free, pure ES modules, Node-testable)                            │
│ decode* → histogram → extract → order → map → dither → index → encode      │
│            metrics · formats · palettes · hash · rng                        │
└─────────────────────────────────────────────────────────────────────────────┘
```

\* Decoding of the **source image** happens on the main thread via `createImageBitmap`
and canvas; core receives an `ImageDataLite`. The **own PNG decoder** lives in core.

### 4.2 Import rules

- `core/**` MUST NOT import from `ui/**`, `workers/**`, `content/**`, or `main.js`.
- `core/**` MUST NOT touch `window`, `document`, `Image`, `canvas`, `localStorage`,
  `navigator`, or `fetch`.
- `ui/**` MUST NOT implement color math, quantization, dithering, or file formats.
- The worker MAY import `core/**` and nothing from `ui/**` or `content/**`.
- `content/**` is static data only: no fetch, no DOM access, no side effects, no imports
  from `core/**` or `ui/**`. UI modules render it.
- Theme resolution/persistence lives in `js/theme-init.js` and `js/ui/theme.js`; core has
  no theme knowledge.
- All color conversions and distance computations go through `core/color.js`.
- All randomness goes through `core/rng.js`; `Math.random` is forbidden.
- All sorting with ties uses explicit comparators; no reliance on hash-map order.

### 4.3 Data model (JSDoc, `js/core/types.js`)

```js
/** @typedef {{ r:number, g:number, b:number, a:number }} RGBA8 */   // 0..255
/** @typedef {{ L:number, a:number, b:number }} Oklab */
/** @typedef {{ L:number, a:number, b:number }} Lab */
/** @typedef {{ data:Uint8ClampedArray, width:number, height:number }} ImageDataLite */

/**
 * @typedef {Object} PaletteEntry
 * @property {number} id          Stable identity, monotonic within a session
 * @property {number} index       Export position 0..255
 * @property {RGBA8} color
 * @property {string=} name
 * @property {string=} role
 * @property {number[]=} aliases  Duplicate indices folded into this entry
 * @property {boolean=} locked
 */

/**
 * @typedef {Object} Palette
 * @property {PaletteEntry[]} entries
 * @property {'source'|'hue'|'lightness'|'custom'} order
 * @property {'oklab'|'srgb'} space
 * @property {string} hash
 */

/**
 * @typedef {Object} IndexMap
 * @property {number} width
 * @property {number} height
 * @property {Uint8Array} indices        Row-major, one byte per pixel
 * @property {number} transparentIndex   -1 when none
 */

/**
 * @typedef {Object} ExtractParams
 * @property {'popularity'|'median-cut'|'wu'|'octree'|'kmeans'} method
 * @property {number} colors             2..256
 * @property {'oklab'|'srgb'} space
 * @property {number} seed
 * @property {number} maxIters           1..64
 * @property {boolean} refine
 */

/**
 * @typedef {Object} MapParams
 * @property {'oklab'|'srgb'} space
 * @property {number} alphaThreshold     0..255
 * @property {number} transparentIndex   -1..255
 */

/**
 * @typedef {Object} DitherParams
 * @property {'none'|'floyd-steinberg'|'atkinson'|'stucki'|'jarvis'|'burkes'|'sierra'|'bayer2'|'bayer4'|'bayer8'|'blue-noise'} method
 * @property {number} strength           0..1
 * @property {boolean} serpentine
 * @property {number} edgeStop           0..1
 */

/**
 * @typedef {Object} Report
 * @property {number} deltaE00Mean
 * @property {number} deltaE00P95
 * @property {number} deltaE00Max
 * @property {{x:number,y:number,deltaE00:number}[]} worstPixels
 * @property {boolean} paletteCompliant
 * @property {boolean} transparentIndexValid
 * @property {number} colorCount
 * @property {string[]} warnings
 * @property {{stage:string, ms:number}[]} timings
 */
```

### 4.4 Worker protocol

All messages are plain objects; pixel buffers are transferred, never cloned.

**Request → worker**

```js
// Preview/process. The worker is stateless between requests.
// `data` is RGBA8, row-major, length = width * height * 4.
{ type: 'process', requestId: 7, image: { data: ArrayBuffer, width, height },
  params: { extract, map, dither }, export: null }

// Full-resolution export. `export` mirrors the UI export selection.
{ type: 'process', requestId: 8, image: { ... }, params: { ... },
  export: { indexedPng: true, strip: '1xN', formats: ['json','gpl'] } }

{ type: 'cancel', requestId: 8 }
```

**Worker → main**

```js
{ type: 'progress', requestId: 8, stage: 'dither', value: 0.42 }
{ type: 'result', requestId: 8, image: { data: ArrayBuffer, width, height },
  palette, indexMap: { data: ArrayBuffer, width, height, transparentIndex },
  report, files: [{ name, mime, data: ArrayBuffer }], timings }
{ type: 'error', requestId: 8, code: 'IMAGE_TOO_LARGE', message, details }
```

Rules:

- `requestId` is monotonic. Results for an older id are ignored and their buffers dropped.
- The UI keeps at most one in-flight request; changing params cancels the previous one.
- The worker checks `cancelled` at stage boundaries and every 64 rows inside loops.
- Long loops yield with `await new Promise(r => setTimeout(r, 0))` (or
  `scheduler.yield()` when available); this keeps `cancel` messages deliverable.
- On `onerror`/`onmessageerror`, the UI replaces the worker and shows a recoverable error.
- The worker MUST NOT post DOM objects.

### 4.5 Request lifecycle

`empty → decoding → processing → ready | error`

- `decoding` runs on the main thread; the worker is idle.
- `processing` sends a preview-sized image (≤1024 px long edge, unless the source is
  smaller); the full-resolution image is decoded again only for export.
- `ready` means the preview and palette are consistent.
- A parameter change triggers `processing` after a 150 ms debounce.
- Export while processing is disabled.

### 4.6 Error codes

`DECODE_FAILED`, `UNSUPPORTED_FORMAT`, `IMAGE_TOO_LARGE`, `FILE_TOO_LARGE`,
`INVALID_PARAMS`, `PALETTE_EMPTY`, `PALETTE_TOO_LARGE`, `EXPORT_FAILED`, `CANCELLED`,
`INTERNAL`.

Errors carry a human-readable `message` and optional `details`. No silent catch.

---

## 5. Color science (normative)

`js/core/color.js` is the only implementation. Constants below are frozen.

### 5.1 Transfer function

sRGB → linear:
`c ≤ 0.04045 ? c/12.92 : ((c+0.055)/1.055)^2.4`

linear → sRGB:
`c ≤ 0.0031308 ? 12.92c : 1.055c^(1/2.4) − 0.055`

### 5.2 Oklab matrices

Linear sRGB → LMS:

```
l = 0.4122214708 r + 0.5363325363 g + 0.0514459929 b
m = 0.2119034982 r + 0.6806995451 g + 0.1073969566 b
s = 0.0883024619 r + 0.2817188376 g + 0.6299787005 b
```

LMS′ → Oklab:

```
L = 0.2104542553 l′ + 0.7936177850 m′ − 0.0040720468 s′
a = 1.9779984951 l′ − 2.4285922050 m′ + 0.4505937099 s′
b = 0.0259040371 l′ + 0.7827717662 m′ − 0.8086757660 s′
```

Inverse:

```
l′ = L + 0.3963377774 a + 0.2158037573 b
m′ = L − 0.1055613458 a − 0.0638541728 b
s′ = L − 0.0894841775 a − 1.2914855480 b
l,m,s = l′³,m′³,s′³

r =  4.0767416621 l − 3.3077115913 m + 0.2309699292 s
g = −1.2684380046 l + 2.6097574011 m − 0.3413193965 s
b = −0.0041960863 l − 0.7034186147 m + 1.7076147010 s
```

### 5.3 CIELAB (D65) and ΔE

sRGB → XYZ (D65):

```
X = 0.4124564 r + 0.3575761 g + 0.1804375 b
Y = 0.2126729 r + 0.7151522 g + 0.0721750 b
Z = 0.0193339 r + 0.1191920 g + 0.9503041 b
```

`f(t) = t > (6/29)³ ? ∛t : (κt + 16)/116`, `κ = 24389/27`.
`L = 116 f(Y/Yn) − 16`, `a = 500(f(X/Xn) − f(Y/Yn))`,
`b = 200(f(Y/Yn) − f(Z/Zn))`, white D65 `(0.95047, 1, 1.08883)`.

- Decisions use **Oklab Euclidean** by default.
- Reporting uses **CIEDE2000** (`deltaE00`), validated against all 34 Sharma pairs.
- `deltaE76` exists for legacy/QA comparison only.

### 5.4 Alpha policy

- Palette extraction weights pixels by `alpha/255`; fully transparent pixels contribute
  nothing.
- Palette colors are stored as RGB with alpha 255. Alpha is **not** part of a palette
  entry except when importing a palette that explicitly has alpha.
- Mapping uses the pixel's RGB as-is (no compositing over a background).
- Pixels with `alpha < alphaThreshold` become transparent in indexed output.
- Semi-transparent pixels in `(0, 255)` are reported as a warning; indexed PNG has only
  binary transparency (`tRNS`). RGBA PNG export preserves alpha exactly.
- A reserved transparent index removes one usable opaque slot: `colors` includes it.

### 5.5 Distances and precision

- Clustering/mapping distances in Oklab with `f64`.
- sRGB→linear LUT of 256 entries is allowed.
- Oklab is computed per histogram bin / unique color, never per pixel.
- Nearest ties: **lowest palette index wins**.
- Out-of-gamut Oklab results are clamped to 0..255 only at 8-bit materialization.

### 5.6 Reporting thresholds (defaults, user-overridable)

| Metric | Pass | Warn |
|---|---:|---:|
| ΔE00 mean | ≤ 2 | > 2 |
| ΔE00 p95 | ≤ 5 | > 5 |
| ΔE00 max | ≤ 10 | > 10 |
| Palette compliance | 100% | any violation = fail |

Thresholds are displayed, never used to hide raw values.

---

## 6. Pipeline and algorithms

### 6.1 Stage contract

| Stage | Input | Output | Invariants |
|---|---|---|---|
| Decode | File/Blob | `ImageDataLite` | sRGB 8-bit, orientation applied, dimensions capped |
| Histogram | pixels | `Histogram` | 5-bit bins, alpha-weighted |
| Extract | histogram, params | `Palette` | 1..min(K, unique) entries; deterministic |
| Order | palette, order | reindexed palette | ID stable; index is a permutation |
| Map | pixels, palette | `IndexMap` | every opaque pixel index < entries.length |
| Dither | pixels, palette, map | `IndexMap` | palette compliance preserved |
| Index | map, palette | indexed image model | bit depth rule, transparent index valid |
| Encode | indexed model | PNG bytes | required chunks only |
| Report | inputs/outputs | `Report` | metrics recomputable from artifacts |

### 6.2 Histogram (`core/histogram.js`)

- 5 bits/channel → `32×32×32 = 32768` bins. Bin id: `(r5 << 10) | (g5 << 5) | b5`,
  `r5 = r >> 3`.
- Per bin store: `weight` (sum of alpha/255), `sumR`, `sumG`, `sumB` (alpha-weighted).
- Bin representative: weighted mean of sRGB, rounded; then converted to the working space.
- Occupied bins = unique 5-bit colors. Report this count as “unique colors (5-bit)”.
- Iterate pixels once; skip `alpha === 0`.
- Memory: `Float64Array` per accumulator (6 × 32768 × 8 B ≈ 1.5 MB).
- Alpha weighting is normative; unweighted histograms are a bug.

API:

```js
buildHistogram(pixels, { bits: 5 }) -> { bits, weight, sumR, sumG, sumB, occupied }
```

### 6.3 Extraction common contract

```js
extract(hist, params) -> { colors: RGBA8[], weights: number[], stats }
```

- Return at most `params.colors` entries.
- If occupied bins < requested, return the occupied colors (no padding); UI warns.
- Deduplicate exact RGB results; if dedupe reduces below K, continue splitting the next
  best box/cluster until K unique colors or no candidate remains.
- Then run `refine` passes (Voronoi/Lloyd) when `params.refine` is true: 2 passes for
  median cut/Wu, 0 for popularity/octree (their modes are explicitly “fast”).
- Weights are the sum of bin weights assigned to each entry (for ordering/QA).

### 6.4 Extraction algorithms

#### 6.4.1 Popularity (`popularity`)

- Sort occupied bins by `weight` descending, then bin id ascending.
- Take top K, dedupe exact colors, representatives = bin means.
- O(M log M). Quality: poor on photos, good on flat/pixel art. Label in UI:
  “Fast — keeps dominant colors”.

#### 6.4.2 Median cut (`median-cut`)

- Box = list of occupied bin ids.
- Box score = weighted SSE = `Σ w·||c − mean||²` in the working space.
- Pick the splittable box with the largest score; tie → lowest box id.
- Axis = largest weighted variance; tie → L, then a, then b.
- Split at the weighted median (first cumulative weight ≥ half); if either side is empty,
  split at the median index; if the box has one bin, mark unsplittable.
- Representative = weighted mean in the working space.
- Continue until K boxes or no splittable box.
- Complexity ~O(K·M log M). Deterministic.

#### 6.4.3 Wu (`wu`)

- Build a 33³ cumulative moment grid over the 5-bit histogram:
  `w, sL, sa, sb, sLL, saa, sbb, sLa, sLb, sab` (10 × `Float64Array(33³)`).
- Populate from bin representatives, then 3D prefix sums in `x→y→z` order.
- Box moments via inclusion–exclusion over 8 corners.
- Box variance = `Σsq − Σ²/w`; weight 0 boxes are skipped.
- Choose the box with the largest weighted variance.
- For each axis, try every cut 1..31; choose the cut minimizing `var(left)+var(right)`
  (maximizing reduction). Tie → lowest axis, then lowest cut.
- Repeat until K boxes or no cut reduces variance.
- Representative = weighted mean.
- This is the default “Balanced” method for photos.
- A brute-force MSE comparison on small fixtures is a required test.

#### 6.4.4 Octree (`octree`)

- Depth 5 (the histogram is already 5-bit).
- Insert occupied bins into an 8-ary tree; leaves accumulate weight and weighted sums.
- Reduce by merging the least-weight leaf into its parent until ≤K leaves.
- Merge order: lowest weight, then lowest node id. Internal nodes keep accumulated sums.
- Representative = weighted mean.
- Label: “Fast — streaming-style, lower quality”.
- Complexity O(M·depth + merges). Deterministic.

#### 6.4.5 K-means++ (`kmeans`)

- Input: occupied bins with weights (M ≤ 32768).
- First centroid: highest weight, tie lowest bin id (deterministic, no RNG).
- Remaining seeds: k-means++ sampling with probability proportional to
  `weight · D²`, using `splitmix64(seed)`. Zero-total-weight edge case → pick the
  highest-weight unseeded bin.
- Lloyd iterations:
  - assign each bin to the nearest centroid in the working space;
  - recompute weighted means; empty cluster → reassign the centroid to the bin with the
    largest `weight · D²`, then continue;
  - stop when max centroid movement < `1e-4` or `maxIters` reached (default 10 preview,
    30 final).
- Representative = centroid converted to 8-bit sRGB; dedupe exact duplicates.
- Complexity O(M·K·iters). For K=256 and M=32768, cap iterations by a work budget
  (`M·K·iters ≤ 60,000,000`), but never stop based on wall-clock time.
- Label: “Max quality”.

### 6.5 Mapping (`core/map.js`)

#### 6.5.1 Mapper build

```js
buildMapper(palette, { space, bits: 6 }) -> {
  nearest: (r,g,b) -> number,
  candidates: (r,g,b) -> { first, second, probSecond },
  mode: 'exact' | 'lut',
  stats
}
```

- Exact mode: collect exact unique RGB colors while iterating pixels, up to 65,536
  unique colors. If within the cap, map each unique color once by brute force over the
  palette; per-pixel lookup via `Map<packedRgb, index>`. This is the path for pixel art.
- LUT mode: 6 bits/channel → `64³ = 262,144` entries.
  - `nearest: Uint8Array` (palette index).
  - `second: Uint8Array` (second-nearest index, for ordered dithering).
  - `probSecond: Uint8Array` (0..255, `d1/(d1+d2)` scaled).
  - Cell representative = `(v << 2) | 2` (cell center); compute Oklab once per cell.
  - Build in chunks with progress; memory ≈ 0.75 MB.
- Distance in the selected space; tie-break lowest index.
- The mapper stores Oklab for every palette entry once.

#### 6.5.2 Per-pixel mapping

- `alpha < alphaThreshold` → `transparentIndex` (if configured) and skip color mapping.
- Otherwise `index = nearest(r,g,b)`.
- If no transparent index is configured and transparency exists, indexed export MUST be
  blocked until the user chooses one (or the default `0` is accepted explicitly).
- Mapping stats: `mode`, per-index counts, build ms.
- QA measures the actual error of the mapped result, including LUT approximation.

### 6.6 Dithering (`core/dither/`)

#### 6.6.1 Shared rules

- Palette compliance is absolute: only palette indices may be emitted.
- Fully transparent pixels are not processed and do not receive error.
- All error math is in the working space (Oklab by default).
- `strength` scales the deviation from the nearest color: 0 = nearest only, 1 = full.
- Strength defaults: Photo 0.8; Pixel Art 0 (none); Retro 16 1.0 (ordered); UI 0.
- Serpentine reverses the x direction on odd rows; mirror kernel x offsets.
- Edge stop reduces diffusion where the local lightness gradient is high:
  `g = max(|L(x+1)−L(x)|, |L(x,y+1)−L(x,y)|)`;
  `factor = 1 − edgeStop · clamp01(g / 0.10)`. Default `edgeStop = 0.5` for photos,
  0 otherwise.
- Error clamp: if `|error| > 0.5` in Oklab, scale the vector to 0.5. This prevents
  runaway artifacts at hard edges.

#### 6.6.2 Error diffusion (`floyd-steinberg`, `atkinson`, `stucki`, `jarvis`, `burkes`, `sierra`)

Kernels (denominator, offsets `(dx,dy): weight`), current pixel at `(0,0)`:

| Kernel | Denominator | Taps |
|---|---:|---|
| Floyd–Steinberg | 16 | (1,0):7, (-1,1):3, (0,1):5, (1,1):1 |
| Atkinson | 8 | (1,0):1, (2,0):1, (-1,1):1, (0,1):1, (1,1):1, (0,2):1 |
| Stucki | 42 | (1,0):8, (2,0):4, (-2,1):2, (-1,1):4, (0,1):8, (1,1):4, (2,1):2, (-2,2):1, (-1,2):2, (0,2):4, (1,2):2, (2,2):1 |
| Jarvis | 48 | (1,0):7, (2,0):5, (-2,1):3, (-1,1):5, (0,1):7, (1,1):5, (2,1):3, (-2,2):1, (-1,2):3, (0,2):5, (1,2):3, (2,2):1 |
| Burkes | 32 | (1,0):8, (2,0):4, (-2,1):2, (-1,1):4, (0,1):8, (1,1):4, (2,1):2 |
| Sierra | 32 | (1,0):5, (2,0):3, (-2,1):2, (-1,1):4, (0,1):5, (1,1):4, (2,1):2, (-1,2):2, (0,2):3, (1,2):2 |

Algorithm:

```
source = Oklab(pixel)
corrected = source + accumulatedError
index = mapper.nearestOklab(corrected)
paletteColor = Oklab(palette[index])
error = (corrected − paletteColor) · strength · edgeFactor
clamp error
for each tap: accumulatedError[next] += error · weight / denominator
```

- Atkinson intentionally diffuses only 6/8 of the error (higher contrast).
- Two error rows are kept (`Float32Array(width·3)` each); rotate per row.
- Default: serpentine on, strength 0.8, edgeStop 0.5 for photos.

#### 6.6.3 Ordered (Bayer 2/4/8)

- Bayer matrices are generated recursively:
  `B₁ = [[0]]`;
  `B₂ₙ = [[4Bₙ+0, 4Bₙ+2], [4Bₙ+3, 4Bₙ+1]]`.
- For each pixel, the mapper returns `first`, `second`, `probSecond`.
- Threshold `t = (M[y mod n][x mod n] + 0.5) / n²`.
- Emit `second` when `t < probSecond · strength`, else `first`.
- This is palette-aware and preserves compliance. It is not Yliluoma (deferred).
- Default matrix: 4×4. Pixel-art preset uses Bayer 4×4 at strength 1.

#### 6.6.4 Blue noise

- Mask: `assets/blue-noise-64.bin`, 64×64 bytes, values 0..255, generated by
  `tools/gen-blue-noise.mjs` (void-and-cluster) and committed with a checksum.
- Tile the mask with offset `(x mod 64, y mod 64)`.
- Use the same two-candidate logic as ordered: threshold `mask/255`.
- Mask generation is not a runtime operation.

#### 6.6.5 Presets and defaults

| Preset | Method | K | Space | Dither | Strength | Order | Transparent index |
|---|---|---:|---|---|---:|---|---:|
| Photo | Wu | 64 | Oklab | Floyd–Steinberg | 0.8 | lightness | none |
| Pixel Art | Popularity | 16 | sRGB | none | 0 | source | 0 |
| Retro 16 | fixed PICO-8 | 16 | sRGB | Bayer 4×4 | 1.0 | source | 0 |
| Game Sprite | fixed imported | 16 | Oklab | none | 0 | source | 0 |
| UI / Brand | Median cut | 10 | Oklab | none | 0 | lightness | none |

Presets set controls; they do not lock them.

### 6.7 Palette model (`core/palette.js`)

- `createPalette(colors)` assigns stable IDs 1..N and indices 0..N-1 in extraction order.
- `sortPalette(palette, order)` returns a new palette; IDs survive, indices are reassigned.
  The strip export and HEX list use this order.
- Sort keys:
  - `source`: ID ascending, restoring extraction order after any other sort.
  - `lightness-asc` / `lightness-desc`: Oklab L, then hue, then C descending, then ID.
  - `hue-asc` / `hue-desc`: achromatic (`C < 0.02`) first by L in the requested
    direction; chromatic entries in a **circular hue order** (the largest hue gap becomes
    the boundary, so reds near 0°/360° stay adjacent), then L in the requested direction,
    C descending, ID.
  - `custom`: M3, with lock-aware reordering.
- `dedupePalette` folds exact RGB duplicates into the first entry and records aliases;
  a “keep duplicates” option is out of scope for v1.
- `paletteHash` covers canonical `{order, space, entries:[{index,rgb,alpha}]}`.
- Locked entries cannot be removed; removing an entry renumbers indices deterministically.

### 6.8 Indexing (`core/index-image.js`)

- Bit depth: `K ≤ 2 → 1`, `K ≤ 4 → 2`, `K ≤ 16 → 4`, `K ≤ 256 → 8`.
- Indices are packed MSB-first within each byte, per the PNG specification.
- `transparentIndex` is validated against `0..K-1`; `-1` means none.
- `tRNS` contains one alpha byte per palette entry: 0 at the transparent index, 255
  elsewhere. No other alpha.
- Index map length MUST equal `width * height`.
- Every index MUST be `< K`.

### 6.9 QA (`core/metrics/`)

- Compute ΔE00 per pixel between the source color and the mapped palette color, skipping
  transparent pixels. For preview, compute per occupied bin (weighted); for final export,
  per pixel (or per exact unique color with weights, which is equivalent).
- Store per-pixel ΔE in a `Float32Array` when the image is ≤ 2M px; otherwise accumulate
  statistics and a downsampled map.
- Mean, p95, max:
  - p95 via a fixed histogram of ΔE in 0.1-wide buckets from 0 to 200 (2000 buckets);
    values above 200 fall into the last bucket.
  - Worst pixels: min-heap of the top 20 by ΔE, tie-break `(y, x)` ascending.
- Error map: RGBA heatmap using a fixed 256-entry ramp; transparent pixels stay
  transparent.
- Compliance: count distinct emitted indices; verify all `< K`; verify transparent pixels
  use only the declared index.
- WCAG contrast: for ≤64 entries, compute the full matrix; for >64, compute pairs vs the
  selected entry. No automatic pass/fail claim beyond the numeric ratios.

### 6.10 Palette swap preview

- Requires a second palette with the same entry count; otherwise the UI disables the
  preview with an explanatory message.
- Render `newColor = swapPalette[oldIndex].color`; transparent index stays transparent.
- No file export in v1; preview only.

---

## 7. Determinism and reproducibility

### 7.1 Rules

- Seeds: every stochastic step takes `seed` (default `0`), recorded.
- PRNG: `splitmix64` in `core/rng.js`; `Math.random` is forbidden.
- Time: `Date.now()` is forbidden in decisions; timestamps only in metadata, and excluded
  from hashes.
- Sorts: total order with the documented tie-breaks in §6.7 and §6.4.
- Nearest ties: lowest palette index.
- K-means: fixed iteration cap and epsilon; no wall-clock stop.
- Float comparisons use `f64`; stored palette values are exact 8-bit.
- Canonical JSON: object keys sorted recursively; no insignificant whitespace.
- Hash: SHA-256 via `crypto.subtle`; fallback FNV-1a 64-bit with a flag.
- `ALGORITHM_VERSION = 1`; bump it when a decision-affecting rule changes.

### 7.2 Guarantee levels

| Scope | Guarantee |
|---|---|
| Same engine, same version, same params/seed | Identical palette, index map, decoded pixels; PNG bytes identical |
| Different engines/versions | Pixel-identical where IEEE-754 math agrees; rare tie flips may occur -> perceptual-equal |
| PNG bytes across browsers | **Not** guaranteed (`CompressionStream` settings are implementation-defined) |

The manifest states the guarantee level. CI golden tests run on one Node version; golden
hashes are reviewed when intentional changes occur.

---

## 8. UI / UX specification

### 8.1 Layout (desktop ≥ 1220 px)

Empty state: full-width hero with the drop zone; no rail.
Loaded state: two columns — stage + right rail, following the PaletteForge workflow
without its header clutter.

```text
┌──────────────────────────────────────────────────────────────┐
│ [PEIQ]                                      [theme] [help]   │ 64 px
├──────────────────────────────────────────┬───────────────────┤
│ Stage                                    │ Rail (380/340 px) │
│  toolbar: change · fit · 100% · original │  Palette          │
│  canvas / before-after                   │   mode, algorithm │
│  palette strip + usage bar               │  Dither           │
│  status line                             │  Export           │
│                                          │  Quality          │
└──────────────────────────────────────────┴───────────────────┘
```

- **Header:** brand on the left; theme toggle and Help on the right. No mode tabs, nav
  links, download buttons, account controls, or secondary subbar.
- **Empty state:** full-width hero; no rail. After an image loads, the hero collapses into
  the stage and the rail appears.
- **≥ 1220 px:** stage `1fr` + rail **380 px**. **980–1219 px:** rail **340 px**.
  **< 980 px:** stacked; stage first, rail becomes an accordion below; canvas sticky at
  the top. **< 600 px:** single column, 44 px touch targets.
- **Stage:** canvas, toolbar, palette strip, usage bar, and a compact status line.
  "Change image" lives in the stage toolbar, not the header.
- **Rail:** a stack of collapsible sections — Palette (with the Extract/Map switch),
  Dither, Export, Quality. No tab bar; no separate mode screen.
- **Palette strip:** directly under the canvas; swatches wrap and scroll. A compact bar
  above it shows the palette count and a sort select: source, hue dark→light, hue
  light→dark, lightness dark→light, lightness light→dark. The selected order controls
  the swatches, HEX copy, and strip export.
- **QA:** summary in the status line; full ΔE/worst-pixel/contrast table in the Quality
  section.
- The header shows the full public name at ≥980 px; below that, the short mark `PEIQ`
  with an `aria-label`/`title` carrying the full name. The document title uses the full
  name.
- The `Help` and theme buttons are always visible, including the empty state.
- Visual language, tokens, component styles, motion, and breakpoints: see
  [`DESIGN.md`](DESIGN.md).

### 8.2 Controls

The loaded UI has two control surfaces: the stage toolbar and the right rail. Rail
sections are independently collapsible; **Palette** starts open and users may open
**Dither** and **Export** together. Desktop spacing is compact but keeps an 8 px gap
between labels and controls; the rail scrolls only when open bodies exceed the viewport.
Touch layouts keep 44 px targets.

**Stage toolbar** (inside the stage, above the canvas)

- "Change image" button (file picker, drag, paste).
- Fit, 100%, zoom out/in.
- Original/result toggle.
- Error-map toggle.
- Palette-swap preview toggle.
- Image info: filename, dimensions, unique colors (5-bit bins).

**Palette rail section**

- Mode tabs `Extract` and `Map` (inside the section, not the header).
- Extract: five algorithms (popularity, median cut, Wu, octree, K-means++), colors
  2–256 via a range plus a numeric field (kept in sync; commits clamp and empty falls back
  to 16), working space, with refinement defaulting on for median cut and Wu.
- Map: built-in target palette (PICO-8, Game Boy, C64, ZX Spectrum, EGA), "Load palette
  file…" for `.hex`, `.gpl`, `.pal`, `.json`, and 1×N/N×1 PNG strips, transparent index,
  alpha threshold.
- Palette order bar: source / hue dark→light / hue light→dark / lightness dark→light /
  lightness light→dark; swatches, HEX list, and strip export follow it.
- Palette rows, per-entry locks, add/remove/rename, and custom order land in M3.

**Dither rail section**

- Methods: none, Floyd–Steinberg, Atkinson, Stucki, Jarvis, Burkes, Sierra, Bayer
  2×2/4×4/8×8, blue noise.
- Strength 0–100%; serpentine and edge-stop for error diffusion only.
- The controls disable themselves when the selected method does not use them.

**Export rail section**

- Primary: "Download indexed PNG".
- Secondary: "Download palette strip", "Download reduced PNG", "Copy HEX list".
- Indexed export uses the sorted palette and declared transparent index; it is decoded
  and compared to the index map.
- Strip orientation toggle `N×1` / `1×N` with a filename preview.
- Contract summary before download: `K`, bit depth, transparent index, dimensions.
- Additional palette-format exports land in M3.
- After validation, show a `Save <file>` link. The actual file write is a real user
  gesture; browsers may block an async automatic download after a worker response. No
  silent auto-download.

**Quality rail section** (collapsed by default)

- ΔE00 mean/p95/max with pass/warn badges.
- Compliance and transparent-index status.
- Worst-pixels list; clicking an item centers the canvas on it.
- Error-map preview (the toggle itself is in the stage toolbar).
- Contrast matrix (collapsible).

**Help**

- Header `?` button opens the Help drawer with `Guide` and `Shortcuts` tabs.
- Header theme toggle cycles `auto → light → dark`; the preference persists in
  `localStorage` under `peiq.theme`; the current mode is announced.
- A small info icon next to every non-obvious control opens a contextual popover with a
  "Read more" link into the matching guide topic.
- Nothing auto-opens; `Esc` and outside-click close; focus returns to the trigger.

### 8.3 Canvas interactions

- Before/after divider at 50%, draggable; keyboard: `role="slider"`, arrow keys ±1%.
- Zoom: wheel at cursor, buttons, `F` fit, `1` 100%, `[`/`]` step.
- Pan: drag (left or middle), space+drag.
- `O` toggles original; `E` toggles error map; palette-swap preview toggle.
- Pixelated rendering at ≥100%; smooth below (toggle under Advanced).
- Checkerboard behind alpha.
- Largest canvas backing store: `min(devicePixelRatio, 2)`.
- No layout shift while processing; keep the last result visible with a progress overlay.

### 8.4 Visual system

All colors, typography, component styles, depth, motion, and breakpoints are defined in
[`DESIGN.md`](DESIGN.md). The plan fixes behavior and contracts only.

- Components MUST use the `--peiq-*` variables from `DESIGN.md` ?2; no hard-coded hex.
- Dynamic palette swatch colors are the only inline-style exception: set `--swatch` on the
  element, never a hex in JS.
- If a visual value and this plan disagree, `DESIGN.md` wins; if behavior disagrees, this
  plan wins.

### 8.5 Keyboard shortcuts

| Key | Action |
|---|---|
| `F` | Fit canvas |
| `1` | 100% zoom |
| `[` / `]` | Zoom out/in |
| `O` | Toggle original |
| `E` | Toggle error map |
| `T` | Cycle theme: auto → light → dark |
| `Ctrl/Cmd+S` | Download indexed PNG |
| `?` | Toggle Help drawer (Guide / Shortcuts) |
| `Esc` | Close popover/drawer / cancel drag |

Shortcuts are disabled while an input/textarea/select has focus.

### 8.6 Accessibility

- Every input has a `<label>`; swatches are `<button>` with `aria-label="Index 3, #ff004d"`.
- Status uses `aria-live="polite"`.
- The before/after divider is keyboard-operable with `role="slider"`.
- The theme toggle is a 32 px button with a dynamic `aria-label` naming the current mode
  and the next action; theme changes are announced via a polite live region.
- Both themes meet the same contrast requirements; no state is communicated by color alone.
- Theme switching does not move focus or trigger layout shift.
- Target: WCAG 2.2 AA for the UI itself (4.5:1 text, 3:1 components).
- No keyboard traps; visible focus; dialogs close on `Esc`.

### 8.7 Copy and errors

- Direct, short, no marketing inside the tool.
- Errors name the problem and the next action, e.g.
  “This PNG is 8,192×8,192 (67 MP). The limit is 16.7 MP. Resize it or use a smaller export.”
- Warnings are specific: “Semi-transparent pixels will become fully transparent or
  opaque in indexed PNG.”

### 8.8 Learning layer

Goal: explain the theory **in place**, without turning the tool into a tutorial or a docs
site. Learning is opt-in, contextual, and dismissible.

**Contextual hints**

- A small outlined `?` icon sits next to non-obvious controls: algorithm, colors, space,
  refine, seed, dither method, strength, serpentine, edge stop, order, transparent index,
  alpha threshold, ΔE00 stats, and export options.
- Hover/focus (desktop) or tap (touch) opens a popover: 2–4 short sentences plus a
  “Read more” link. Maximum width 320 px; positioned next to the trigger.
- `Esc`, outside-click, or a second click closes it; focus returns to the trigger.
- Hints never cover the canvas, never block a control, and never auto-open.

**Help drawer**

- The header `?` button opens a non-modal right-side drawer with two tabs:
  - **Guide** — topics, each with a summary, 2–4 short paragraphs, and canonical links.
  - **Shortcuts** — the table from §8.5.
- Closed by default. Remembers the last tab for the session only.
- Desktop: 360 px overlay above the right rail; the canvas does not relayout.
  < 960 px: full-height sheet; `Esc` closes.
- Topic list (minimum 12):
  1. `quantization-basics` — what quantization is and what it trades away.
  2. `popularity` — dominant-color selection.
  3. `median-cut` — Heckbert’s box splitting.
  4. `wu` — moment-based splitting.
  5. `octree` — tree reduction.
  6. `kmeans` — Lloyd/LBG and k-means++.
  7. `oklab-vs-srgb` — perceptual spaces and the content-dependent caveat.
  8. `delta-e` — CIEDE2000 and practical thresholds.
  9. `error-diffusion` — FS/Atkinson/Stucki/Jarvis/Burkes/Sierra.
  10. `ordered-dithering` — Bayer and two-candidate ordered dithering.
  11. `blue-noise` — void-and-cluster masks.
  12. `indexed-png` — `PLTE`, `tRNS`, and engine import.
  13. `palette-strips` — the 1×N contract and Aseprite/Godot/Unity.
  14. `alpha` — transparency in indexed output.
  15. `determinism` — seeds, hashes, and reproducibility.
  16. `contrast` — WCAG/APCA and why one number is not “accessible”.

**Content and safety**

- Content lives in `js/content/learn.js` as structured data:
  `{ id, title, summary, paragraphs: string[], links: string[] }`.
- `js/content/references.js` holds canonical references:
  `{ id, title, authors, year, url }`.
- Rendered with `createElement`/`textContent`; no Markdown parser, no `innerHTML`, no
  iframe, no embedded video, no third-party widget.
- Links are canonical sources (papers, specs, engine docs), `target="_blank"`,
  `rel="noopener noreferrer"`. No prefetch/preconnect. The page remains local-only; only
  an explicit click navigates away.
- Content is static and bundled; zero runtime fetches.
- Deep links (SHOULD): `#help=<topic>` opens the drawer at a topic. Params use
  `#p=<encoded>`; combined as `#p=<encoded>&help=<topic>`.
- Drawer semantics: `role="dialog"`, `aria-modal="false"`, labelled by its heading;
  focus moves in on open and returns on close; tabs are keyboard-operable.
- Non-goals: first-run tour, modal onboarding, permanent explanatory paragraphs,
  documentation site, comments/community.

---

## 9. Performance

### 9.1 Budgets (desktop, worker, 1024² unless stated)

| Workload | Target |
|---|---:|
| Decode + preview downscale | 50–100 ms |
| Histogram | 20–40 ms |
| Median cut K=16 | 20–60 ms |
| Wu K=16 | 15–40 ms |
| K-means K=16, 10 iters | 60–150 ms |
| Mapper LUT 6-bit, K=16 | 30–80 ms |
| Mapper LUT 6-bit, K=256 | 300–700 ms |
| Map 1024² | 20–50 ms |
| FS 1024² | 100–300 ms |
| Indexed PNG encode 1024² | 60–150 ms |
| Full preview pass | < 700 ms |
| 4096² K=64, no dither | < 8 s |

### 9.2 Strategies

- Web Worker for all core work; decode on main thread.
- Preview cap: 1024 px long edge; final pass explicit.
- 5-bit histogram; Oklab per bin/unique color; 6-bit mapper LUT.
- Exact mapper for ≤65,536 unique colors.
- ED error rows as `Float32Array`; avoid per-pixel object allocation.
- Yield every 64 rows; check cancellation.
- Debounce 150 ms; abort stale jobs.
- Transfer `ArrayBuffer`s; never clone pixel data unnecessarily.
- Display timings per stage in the status bar and manifest.
- Learning content is static in the bundle: no fetch, no runtime parsing beyond module
  load. Hints/drawer must not trigger canvas relayout or a re-render of the result.
- Theme switching only swaps CSS variables: no component re-render, no layout shift, no
  color transition. `theme-init.js` resolves the theme before first paint.
- Page weight target: < 500 KB uncompressed HTML/CSS/JS, plus a self-hosted Inter subset
  ≤ 200 KB. No video backgrounds or large hero images; the Blender look is CSS/SVG/canvas.
- Cap work, not wall-clock: if a job exceeds its budget, reduce iterations or resolution
  only with an explicit UI note — never silently.

### 9.3 Memory

- Preview buffers ≤ 4 MB.
- Full-res RGBA 4096² = 64 MB; histogram ~1.5 MB; LUTs ~1 MB; index map 16 MB.
- Release canvases and buffers after export; revoke object URLs.
- Reject > 16.7 MP before allocation.

---

## 10. Testing

### 10.1 Framework

- `node --test` only. No test dependencies.
- Tests import `core/**` directly; no DOM.
- Canvas-dependent behavior is covered by manual browser checks and by testing the
  pure PNG encoder/decoder in Node.
- Test helpers in `test/helpers.js` generate images programmatically (no binary fixtures).

### 10.2 Test map

| File | Covers |
|---|---|
| `color.test.js` ✅ | sRGB/Oklab/Lab, ΔE00 Sharma pairs, hex, contrast |
| `version.test.js` | `APP_VERSION` matches `package.json`; `ALGORITHM_VERSION` positive |
| `rng.test.js` | splitmix64 sequence, seed determinism |
| `hash.test.js` | SHA-256/FNV fallback, canonical JSON |
| `histogram.test.js` | binning, alpha weights, representatives |
| `median-cut.test.js` | K colors, determinism, K > unique, degenerate images |
| `wu.test.js` | K colors, MSE ≤ median cut on fixtures, determinism |
| `octree.test.js` | K colors, merge order, determinism |
| `kmeans.test.js` | seeding, empty clusters, iteration cap, determinism |
| `palette.test.js` | IDs, ordering, locks, dedupe, hash |
| `map.test.js` | exact/LUT modes, tie-break, alpha, compliance |
| `dither-error-diffusion.test.js` | kernel sums, serpentine, strength, edge stop, compliance |
| `dither-ordered.test.js` | Bayer generation, two-candidate probabilities, compliance |
| `dither-blue-noise.test.js` | mask tiling, determinism, compliance |
| `png-crc.test.js` | CRC32 known answer, chunk layout |
| `png-encode.test.js` | RGBA/indexed, bit depths, tRNS, decode round-trip |
| `png-decode.test.js` | filters 0–4, indexed/RGB/RGBA, rejects 16-bit/interlaced |
| `index-image.test.js` | packing, bit depth rule, transparent index |
| `formats.test.js` | .hex/.gpl/.pal/.json/.css/.tokens round-trips |
| `ase.test.js` | writer layout, reader round-trip |
| `palettes.test.js` | built-in counts/values, import parsers |
| `metrics.test.js` | ΔE stats, p95, worst pixels, compliance |
| `pipeline.test.js` | stage composition, preview vs final params |
| `determinism.test.js` | two runs → identical palette/index-map hashes |
| `golden.test.js` | synthetic fixture → reviewed hashes |
| `learn.test.js` | unique topic/reference IDs, required fields, https links, every referenced ID exists |
| `theme.test.js` | dark/light token parity, auto resolution, 3-state cycle, invalid storage |

### 10.3 Required known-answer tests

- CIEDE2000: all 34 Sharma pairs (already implemented).
- Oklab reference values for red/green/blue/white/black.
- sRGB ↔ Oklab round-trip within ±1 8-bit step.
- CRC32 of `"123456789"` = `0xCBF43926`.
- Bayer 2×2 = `[[0,2],[3,1]]`; 4×4 matches the published matrix.
- Error-diffusion kernel sums: FS 16/16, Atkinson 6/8, Stucki 42/42, Jarvis 48/48,
  Burkes 32/32, Sierra 32/32.
- Contrast black/white = 21.

### 10.4 Property tests (deterministic loops)

- Palette length ≤ requested; every color is 8-bit; no uncollapsed duplicates.
- Ordering is a permutation of IDs; locked entries keep indices.
- Every opaque output pixel index < K; every index maps to a palette color.
- Strip decode equals the source palette.
- Indexed PNG decode equals the index map.
- Re-running with the same seed produces identical hashes.
- Alpha threshold behavior: `< T` transparent, `≥ T` opaque.

### 10.5 Golden fixtures

- Generate once: 128×128 gradient + flat regions + alpha corner + a 16-color sprite-like
  block.
- Params: Wu, K=16, Oklab, no dither; and median cut, K=8, sRGB, Bayer 4.
- Store SHA-256 of canonical palette JSON and index map in `test/golden.json`.
- Intentional algorithm changes update the goldens with a decision-log entry.

### 10.6 Manual browser checklist (release)

1. Chrome, Firefox, Safari: drop, picker, paste.
2. Portrait/landscape; zoom/pan; before/after divider by keyboard.
3. Extract with each algorithm; change K; cancel during processing.
4. Import each palette format; import a strip PNG; reject malformed files.
5. Dither each method; compare visually; verify palette compliance.
6. Export indexed PNG and strip; re-import both; compare.
7. Aseprite: load `.gpl`, `.ase`, and the strip; verify colors.
8. Godot: import the strip with filter off/mipmaps off; sample by index.
9. Mobile viewport 360×800; all panels reachable.
10. DevTools: no network requests; no console errors.
11. Large image rejection; 1×1; fully transparent; single color.
12. `prefers-reduced-motion`; keyboard-only pass.
13. Open every info popover with mouse and keyboard; `Esc` closes; focus returns;
    “Read more” opens the matching guide topic.
14. Help drawer at 1280 px and 360 px: tabs work, canvas does not relayout, no network
    requests, external links open only on click.
15. Visual review: dark shell + Guide, blue accent contrast, orange brand, focus rings,
    reduced motion, no layout shift, no copied Blender assets; check against `DESIGN.md`.
16. Both themes: auto follows the OS, toggle cycles auto/light/dark, preference persists
    after reload, no flash of the wrong theme.
17. Theme switch: no layout shift, no half-light frame, both themes meet contrast, and no
    component keeps a color from the other theme.

---

## 11. Error handling and edge cases

| Condition | Behavior |
|---|---|
| Unsupported/undecodable file | `UNSUPPORTED_FORMAT` with the file type and supported list |
| File > 64 MiB | `FILE_TOO_LARGE`; nothing allocated |
| Dimensions > 16.7 MP | `IMAGE_TOO_LARGE`; show dimensions and limit |
| 1×1 image | Allowed; palette count = 1; no dithering |
| Single-color image | Allowed; K effectively 1; UI warns |
| `colors > occupied bins` | Palette = occupied bins; UI warns |
| Palette > 256 entries | `PALETTE_TOO_LARGE`; import rejected |
| Empty palette | `PALETTE_EMPTY`; export blocked |
| Duplicate palette colors | Folded into the first entry; aliases recorded; warning |
| Fully transparent image | Palette empty; mapping yields all transparent; export allowed with a warning |
| Semi-transparent pixels + indexed export | Binarized by threshold; warning; RGBA export preserves alpha |
| Transparency + no transparent index | Indexed export blocked until one is chosen |
| Transparent index ≥ K | `INVALID_PARAMS`; selector constrains to valid values |
| K=256 + transparent index | 255 opaque slots + 1 transparent; UI states this |
| Invalid `.gpl`/`.pal`/`.json`/`.ase` | Format-specific error with line/offset where possible |
| Palette strip not 1×N/N×1 | Rejected as “not a palette strip” |
| Cancelled job | `CANCELLED`; last result stays; no error toast |
| `localStorage` unavailable/invalid | Fall back to `auto`; no error surfaced |
| OS theme changes while `auto` | Update the theme live |
| OS theme changes while manual | Ignore; keep the user’s choice |
| Theme init before paint | No flash of the wrong theme |
| Worker crash | Replace worker; show recoverable error with “Retry” |
| Clipboard permission denied | Show “Paste with Ctrl/Cmd+V instead” |
| Download blocked | Show the generated blob link as a fallback |

No error may be swallowed. Every warning is visible in the status bar and in the manifest.

---

## 12. Export contracts

### 12.1 Native palette JSON

```json
{
  "format": "peiq/palette",
  "version": 1,
  "meta": {
    "name": "sprite",
    "created": "2026-11-13T00:00:00Z",
    "tool": "1.0.0",
    "algorithmVersion": 1
  },
  "order": "source",
  "space": "oklab",
  "entries": [
    { "id": 1, "index": 0, "hex": "#0b0d10", "rgb": [11, 13, 16],
      "alpha": 255, "name": "background", "role": "surface" }
  ],
  "hash": "sha256:…"
}
```

- `hash` covers canonical `{order, space, entries:[{index,rgb,alpha}]}`.
- `created` is excluded from the hash.
- `alpha` is 255 unless the imported palette declares otherwise.

### 12.2 Palette strip

| Property | Requirement |
|---|---|
| Dimensions | Exactly `N×1` (default) or `1×N` |
| Color type | 2 (RGB); 6 (RGBA) only if an entry has alpha < 255 |
| Bit depth | 8 |
| Values | Exact 8-bit sRGB, no interpolation |
| Chunks | `IHDR`, `IDAT`, `IEND` only; no ICC/gAMA/sRGB/pHYs/tEXt |
| Filter | 0 (None) on every row |
| Padding | None |
| Order | As exported (source/hue/lightness/custom) |
| Filename | `{name}-palette-{N}x1.png` / `{name}-palette-1x{N}.png` |
| Validation | Decode the written bytes and compare every pixel to the palette |

### 12.3 Indexed PNG

| Property | Requirement |
|---|---|
| Bit depth | `K≤2→1`, `K≤4→2`, `K≤16→4`, `K≤256→8` |
| Color type | 3 (indexed) |
| Chunks | `IHDR`, `PLTE`, optional `tRNS`, `IDAT`, `IEND` |
| `tRNS` | One byte per palette entry; 0 at `transparentIndex`, 255 elsewhere |
| Filter | 0 on every row |
| Index packing | MSB-first within each byte |
| Profile/metadata | None |
| Filename | `{name}-{K}c-indexed.png` |
| Validation | Decode indices and compare to the generated index map |

Zlib:

- **Encoder (M2): stored blocks** (`0x78 0x01`, 65535-byte blocks, Adler-32). Valid,
  portable, and larger than compressed output. It was chosen after `CompressionStream`
  stalled in headless Chrome during verification.
- **Decoder (M2): full DEFLATE** — stored, fixed-Huffman, and dynamic-Huffman blocks.
  This enables importing ordinary compressed palette-strip PNGs.
- Intended optimization: `CompressionStream('deflate')` once it is verified in real
  browsers; keep stored blocks as the fallback.
- Compression output is implementation-defined; byte equality is guaranteed only within
  the same browser/version.

### 12.4 Other formats

| Format | Rules |
|---|---|
| `.hex` | One `#rrggbb` per line, lowercase, no blank lines except an optional trailing newline |
| `.gpl` | `GIMP Palette`, `Name:`, `Columns:`, `#`, then `R G B\tName` |
| `.pal` | JASC: `JASC-PAL`, `0100`, count, then `R G B` |
| `.css` | `:root { --peiq-color-1: #rrggbb; ... }` (1-based, stable order) |
| `.tokens.json` | DTCG `color` object; names are `color-1` or sanitized entry names |
| `.ase` | Adobe Swatch Exchange; RGB float32 entries; verify in Aseprite/Photoshop |
| Manifest | §12.6 |
| QA JSON | §12.5 |

All text formats use LF and UTF-8. No BOM.

### 12.5 QA report

```json
{
  "format": "peiq/report",
  "version": 1,
  "source": { "name": "sprite.png", "width": 256, "height": 256, "hash": "sha256:…" },
  "params": { "method": "wu", "colors": 16, "space": "oklab",
              "dither": "bayer4", "ditherStrength": 1.0, "seed": 0 },
  "palette": { "hash": "sha256:…", "count": 16, "transparentIndex": 0,
               "order": "source" },
  "quality": { "deltaE00Mean": 1.2, "deltaE00P95": 3.4, "deltaE00Max": 7.1,
               "worstPixels": [{ "x": 12, "y": 40, "deltaE00": 7.1 }] },
  "checks": { "paletteCompliant": true, "transparentIndexValid": true,
              "colorCount": 16, "warnings": [] },
  "timings": [{ "stage": "extract", "ms": 41 }],
  "tool": { "version": "1.0.0", "algorithmVersion": 1,
            "hashAlgorithm": "sha256", "determinism": "same-engine" }
}
```

### 12.6 Manifest

```json
{
  "format": "peiq/manifest",
  "version": 1,
  "tool": { "version": "1.0.0", "algorithmVersion": 1 },
  "source": { "name": "sprite.png", "width": 256, "height": 256,
              "hash": "sha256:…" },
  "params": { "...": "full normalized params" },
  "palette": { "hash": "sha256:…", "count": 16, "transparentIndex": 0 },
  "outputs": [
    { "name": "sprite-16c-indexed.png", "mime": "image/png", "hash": "sha256:…" },
    { "name": "sprite-palette-16x1.png", "mime": "image/png", "hash": "sha256:…" }
  ],
  "qa": { "deltaE00Mean": 1.2, "deltaE00P95": 3.4, "deltaE00Max": 7.1,
          "paletteCompliant": true },
  "checks": { "allOutputsValidated": true, "warnings": [] }
}
```

- Canonical JSON; `created`/`timings` are excluded from hashes.
- Output hashes are SHA-256 of the exact bytes.

### 12.7 Filenames

- Sanitize the source basename: lowercase, non-alphanumeric → `-`, collapse dashes,
  fallback `image`.
- Indexed: `{name}-{K}c-indexed.png`.
- Strip: `{name}-palette-{N}x1.png` or `{name}-palette-1x{N}.png`.
- Palette: `{name}-palette.{json,hex,gpl,pal,ase,css}`; DTCG: `{name}-tokens.json`.
- Reports: `{name}-qa.json`, `{name}-manifest.json`.

---

## 13. Built-in palettes and imports

### 13.1 Built-ins (v1.0.0)

| Name | Count | Source | Status |
|---|---:|---|---|
| PICO-8 | 16 | [PICO-8 palette](https://www.lexaloffle.com/dl/docs/pico-8_manual.html) | Values in Appendix C |
| Game Boy DMG | 4 | Pan Docs / hardware references | Values in Appendix C |
| Commodore 64 (VICE) | 16 | VICE default palette | Values in Appendix C |
| ZX Spectrum | 15 | Hardware palette: 8 normal + 7 bright (black shared) | Values in Appendix C |
| EGA | 16 | IBM EGA standard | Values in Appendix C |
| Grayscale 4/8/16 | generated | 0..255 even steps | Generated |
| 1-bit | 2 | `#000000`, `#ffffff` | Generated |
| RGB332 | 256 | 3/3/2 bit levels | Generated |

NES is deferred to v1.1 together with palette banks: the NES master palette varies by
emulator/PPU revision and the meaningful workflow requires per-region banks.

### 13.2 Import rules

- `.hex`: accept `#rgb`, `#rrggbb`, `#rrggbbaa`, with optional whitespace; ignore blank
  lines and `;`/`//` comments.
- `.gpl`: parse `GIMP Palette`, `Name:`, `Columns:`, skip `#` comments, read `R G B [name]`.
- `.pal`: JASC header only; reject unknown versions.
- `.json`: validate `format === "peiq/palette"`, version 1, entries.
- `.ase`: parse color-entry blocks; flatten groups; RGB only; reject CMYK/LAB entries.
- PNG strip: own decoder; require `width === 1 || height === 1`; 1..256 pixels; dedupe
  exact duplicates by default (record aliases).
- Max 256 entries; every color validated; errors include a line/offset when possible.
- Imported palettes keep source order and IDs 1..N.
- Built-in palettes are plain JS data; no fetch.

### 13.3 Palette data licensing

Palette hex lists are factual data. Sources are cited in Appendix C. No copyrighted
palette files are copied.

---

## 14. File-by-file implementation checklist

Legend: **S** = signatures/notes, **T** = required tests.

### Root

| Path | Responsibility |
|---|---|
| `index.html` | Semantic shell, panels, labels, no inline logic; loads `js/main.js` |
| `.nojekyll` | Disable Jekyll on Pages |
| `README.md` | User-facing usage, privacy, browser support, dev commands, license |
| `IMPLEMENTATION_PLAN.md` | This document |
| `DESIGN.md` | Visual system, components, motion, responsive rules |
| `AGENTS.md` | Agent operating rules |
| `LICENSE` | GPL-3.0 |

### CSS

| Path | Responsibility |
|---|---|
| `css/tokens.css` | Custom properties from `DESIGN.md` §2 |
| `css/base.css` | Reset, typography, focus, scrollbars |
| `css/layout.css` | Header, stage + rail workspace, status line, breakpoints |
| `css/components.css` | Buttons, inputs, tabs, sliders, swatches, tables, toasts |
| `css/canvas.css` | Checkerboard, canvas, divider handle, overlays |
| `css/learn.css` | Info popovers, Help drawer, guide typography, reference list |
| `css/responsive.css` | Mobile tabs/accordion rules |

### JS entry and UI

| Path | Responsibility |
|---|---|
| `js/main.js` | Bootstrap, feature detection, worker creation, wiring |
| `js/theme-init.js` | Classic `<head>` script: resolve `peiq.theme` before paint, set `data-theme` |
| `js/ui/dom.js` | `el()`, `on()`, `raf()`, `debounce()`; no framework |
| `js/ui/state.js` | Store: `getState`, `setState`, `subscribe`; single mutation point |
| `js/ui/theme.js` | 3-state toggle, matchMedia listener, persistence, meta theme-color |
| `js/ui/strings.js` | User-facing strings and error templates |
| `js/ui/dropzone.js` | File picker/drag/paste; decode + downscale preview |
| `js/ui/controls.js` | Extract/Map/Dither/Order controls; presets |
| `js/ui/canvas-view.js` | Render, zoom/pan, divider, original/error/swap views |
| `js/ui/palette-view.js` | Swatches, reorder, lock, add/remove, copy hex, import |
| `js/ui/qa-view.js` | ΔE stats, worst pixels, compliance, contrast, error-map toggle |
| `js/ui/export-view.js` | Export selection, validation, downloads, filenames |
| `js/ui/status.js` | Progress, timings, warnings, toasts |
| `js/ui/learn-view.js` | Contextual popovers, Help drawer, Guide/Shortcuts tabs, references |
| `js/ui/shortcuts.js` | Keyboard map; opens the Help drawer’s Shortcuts tab |
| `js/ui/url-state.js` | Serialize/restore params in `location.hash` (no image data) |

### Content

| Path | Responsibility |
|---|---|
| `js/content/learn.js` | Static guide topics: `{id, title, summary, paragraphs, links}` |
| `js/content/references.js` | Canonical references `{id, title, authors, year, venue, url}`, plus credits; `url` is `null` for print-only papers |

### Worker

| Path | Responsibility |
|---|---|
| `js/workers/pipeline.worker.js` | Message loop, cancellation, progress, stage orchestration, transferables |

### Core

| Path | Responsibility / API | Tests |
|---|---|---|
| `js/core/types.js` | JSDoc typedefs only | — |
| `js/core/version.js` | `APP_VERSION`, `ALGORITHM_VERSION` | sync check |
| `js/core/color.js` ✅ | Color math, ΔE, hex, contrast | `color.test.js` |
| `js/core/rng.js` | `createRng(seed)`, `splitmix64`, `nextFloat` | `rng.test.js` |
| `js/core/hash.js` | `sha256Hex`, `fnv1a64Hex`, `stableStringify` | `hash.test.js` |
| `js/core/histogram.js` | `buildHistogram(pixels, opts)` | `histogram.test.js` |
| `js/core/quantize/index.js` | `extractPalette(hist, params)`, dispatch, refinement | `quantize.test.js`, `quantize-advanced.test.js` |
| `js/core/quantize/popularity.js` | `extractPopularity` | `quantize.test.js` |
| `js/core/quantize/median-cut.js` | `extractMedianCut` | `quantize.test.js` |
| `js/core/quantize/wu.js` | `extractWu` | `quantize-advanced.test.js` |
| `js/core/quantize/octree.js` | `extractOctree` | `quantize-advanced.test.js` |
| `js/core/quantize/kmeans.js` | `extractKMeans` | `quantize-advanced.test.js` |
| `js/core/quantize/refine.js` | `refinePalette` (Lloyd refinement) | `quantize-advanced.test.js` |
| `js/core/palette.js` | `createPalette`, `sortPalette`, `paletteHexList`, `paletteHash` | `palette.test.js` |
| `js/core/map.js` | `buildMapper`, `buildExactMap`, `mapPixels`, `mapIndices`, `indicesToRgba` | `map.test.js` |
| `js/core/dither/index.js` | `ditherPixels(image, palette, dither)` | `dither.test.js` |
| `js/core/dither/kernels.js` | Error-diffusion tables + Bayer generation | `dither.test.js` |
| `js/core/dither/error-diffusion.js` | ED implementation | `dither.test.js` |
| `js/core/dither/ordered.js` | Two-candidate ordered dither | `dither.test.js` |
| `js/core/dither/blue-noise.js` | Mask loading/tiling | `dither.test.js` |
| `js/core/dither/blue-noise-mask.js` | Generated 64×64 mask (base64) | `dither.test.js` |
| `js/core/png/crc.js` | CRC32/Adler-32 | `png.test.js` |
| `js/core/png/chunks.js` | Chunk writer/parser, stored zlib | `png.test.js` |
| `js/core/png/inflate.js` | Full DEFLATE decoder (stored/fixed/dynamic) | `png.test.js` |
| `js/core/png/encode.js` | `encodeIndexedPng`, `encodeRgbaPng`, `encodeStripPng` | `png.test.js` |
| `js/core/png/decode.js` | `decodePng(bytes)` (non-interlaced, 8-bit + indexed) | `png.test.js` |
| `js/core/formats/hex.js` | Read/write `.hex` | `formats.test.js` |
| `js/core/formats/gpl.js` | Read/write `.gpl` | `formats.test.js` |
| `js/core/formats/pal.js` | Read/write JASC `.pal` | `formats.test.js` |
| `js/core/formats/ase.js` | Read/write Adobe `.ase` | `ase.test.js` |
| `js/core/formats/css.js` | CSS variables | `formats.test.js` |
| `js/core/formats/dtcg.js` | DTCG tokens | `formats.test.js` |
| `js/core/formats/json.js` | Native palette JSON read/write | `formats.test.js` |
| `js/core/formats/manifest.js` | QA report + manifest builders | `pipeline.test.js` |
| `js/core/palettes/builtin.js` | Built-in palette data | `palettes.test.js` |
| `js/core/palettes/import.js` | Format detection + dispatch | `palettes.test.js` |
| `js/core/metrics/delta-e.js` | Per-pixel ΔE, stats, p95 | `metrics.test.js` |
| `js/core/metrics/worst.js` | Top-N heap | `metrics.test.js` |
| `js/core/metrics/contrast.js` | WCAG matrix | `metrics.test.js` |
| `js/core/metrics/error-map.js` | RGBA heatmap | `metrics.test.js` |
| `js/core/pipeline.js` | `runPipeline(job)` stage composition | `pipeline.test.js`, `determinism.test.js` |
| `js/core/log.js` | Optional debug logger; disabled in production | — |

### Assets and tools

| Path | Responsibility |
|---|---|
| `assets/blue-noise-64.bin` | 64×64 blue-noise mask (checksum in `assets/README.md`) |
| `assets/fonts/InterVariable-latin.woff2` | Self-hosted Inter variable Latin subset (~48 KB) |
| `assets/fonts/OFL.txt` | Inter SIL Open Font License |
| `assets/favicon.svg` | Local orange-on-charcoal PEIQ mark |
| `assets/README.md` | Provenance, font source/license, regeneration command |
| `tools/dev-server.mjs` ✅ | Zero-dep static server |
| `tools/gen-blue-noise.mjs` | Void-and-cluster generator; deterministic seed |
| `.github/workflows/ci.yml` | `node --test` on push/PR |
| `.github/workflows/pages.yml` | Stage the static site and deploy it to GitHub Pages on `main` |

---

## 15. Milestones

Each milestone ends with a demo and green tests. Version bumps: `0.1.0` at M0,
`0.2.0` M1, `0.3.0` M2, `0.4.0` M3, `1.0.0` M4.

### M0 — Foundation

- [x] Research report
- [x] Plan v1.0.0
- [x] `package.json`, `.gitignore`, dev server
- [x] Color core + tests
- [x] `version.js` + sync test; tagged `v0.1.0`
- [x] `types.js`, `rng.js`, `hash.js`
- [x] Test helpers
- [x] CI skeleton
- **Exit:** `node --test` green; page shell loads; no dependencies.

### M1 — Vertical slice

- [x] Histogram, popularity, median cut
- [x] PNG encoder (RGBA + strip) + decoder
- [x] Worker protocol + cancellation
- [x] Preview UI: drop, K slider, before/after, status
- [x] Strip export + validation
- [x] Palette sorting (source / hue / lightness, both directions)
- [x] Golden palette/preview hashes
- **Exit:** drop → palette → validated strip; golden test; `0.2.0`.

### M2 — Fixed palette and dithering

- [x] Wu, octree, K-means++, refinement
- [x] Palette import (.hex/.gpl/.pal/.json/PNG strip)
- [x] Built-in palettes (PICO-8, Game Boy, C64, ZX Spectrum, EGA)
- [x] Mapping (exact + LUT), tie-break, alpha
- [x] Error diffusion + Bayer + blue noise
- [x] Indexed PNG + transparent index + validation
- **Exit:** sprite mapped to PICO-8; compliance and round-trip green; `0.3.0`.

### M3 — Production handoff (current)

- [ ] QA metrics, error map, worst pixels
- [ ] Palette editor, locks, ordering
- [ ] Built-in palettes, presets
- [ ] All palette formats + manifest
- [ ] Palette swap preview, contrast matrix
- [x] Canonical reference list and credits in the Help drawer
- [ ] Contextual hints + Help drawer shell + ≥12 guide topics
- **Exit:** full feature matrix complete; all exports green; `0.4.0`.

### M4 — Release

- [ ] Responsive + accessibility pass
- [ ] Two themes: auto + 3-state toggle + token parity test
- [ ] Performance tuning against §9
- [ ] Learning layer polish, deep links, link audit
- [ ] README, screenshots, usage
- [ ] GitHub Pages deploy + smoke test
- [ ] Release checklist §17
- **Exit:** v1.0.0 tagged; `1.0.0`.

### M5 — v1.1 (not part of this release)

Batch + ZIP + manifest, NES banks/per-region palettes, animation frames, Yliluoma,
exact mapping mode, SSIM/APCA, palette cycling, min-churn reindex, CLI/WASM, print,
neural stylization.

---

## 16. Definition of Done

A change is done only when:

1. `node --test` passes (full suite, not a subset).
2. New behavior has a test: known-answer, property, golden, or round-trip.
3. Determinism is preserved; no `Math.random`, no wall-clock decisions.
4. No dependency, build step, CDN, or network call was added.
5. Contracts in §12 still hold; validation still runs on export.
6. UI changes are checked in a browser at 1280 px and 360 px, keyboard-only, in both themes.
7. Warnings/errors are surfaced; no silent catch.
8. Non-obvious math cites a plan section or a paper.
9. The plan/decision log is updated if a rule or contract changed.
10. The change is committed locally with a descriptive body (see AGENTS.md §10).

---

## 17. Release checklist (v1.0.0)

- [ ] Zero `dependencies`/`devDependencies`; `npm ls` empty.
- [ ] No build step; page works from a plain static server.
- [ ] `node --test` green on Node 22.
- [ ] Core tests cover every algorithm, format, and contract.
- [ ] Manual browser matrix §10.6 completed.
- [ ] DevTools shows zero network requests after load.
- [ ] Strip round-trip and indexed round-trip validated on the release corpus.
- [ ] Aseprite and Godot import smoke tests pass.
- [ ] Mobile 360 px and keyboard-only pass.
- [ ] Both themes: auto follows OS, toggle cycles, persists, no FOUC; `theme.test.js` parity green.
- [ ] Header shows only brand + theme + Help; no extra buttons.
- [ ] README complete; screenshots current.
- [ ] `APP_VERSION`, `package.json`, manifest = `1.0.0`.
- [ ] `LICENSE` = GPL-3.0; README states it.
- [ ] GitHub Pages deployed and smoke-tested at the project URL.
- [ ] Annotated tag `v1.0.0` on the version-bump commit.

---

## 18. Decision log

| Date | Decision | Rationale |
|---|---|---|
| 2026-11-13 | Keep **GPL-3.0-only** | Owner decision; report’s MIT/Apache recommendation is not adopted |
| 2026-11-13 | Zero runtime dependencies, no build step | Static hosting, maintainability, supply-chain safety |
| 2026-11-13 | This plan is the source of truth; AGENTS.md defers to it | Single contract surface |
| 2026-11-13 | Oklab default, sRGB selectable | Report §1.3; content-dependent results (Maitra 2026) |
| 2026-11-13 | v1.0.0 = fixed palette + strip + indexed PNG + QA + game presets | Report §4.4 P0/P1 gaps |
| 2026-11-13 | Own PNG encoder and decoder | Exact index/color control; removes canvas color-management risk for strips |
| 2026-11-13 | 6-bit mapper LUT + exact path for ≤65,536 unique colors | Fast photos, exact pixel art |
| 2026-11-13 | Error diffusion uses the mapper LUT | O(1) per pixel; quality loss measured by QA |
| 2026-11-13 | Indexed PNG has binary alpha only | PNG `tRNS` limitation; RGBA export preserves alpha |
| 2026-11-13 | NES deferred to v1.1 | Palette variants + banks; would distort v1 scope |
| 2026-11-13 | Yliluoma deferred to v1.1 | Blue noise + Bayer cover v1 needs |
| 2026-11-13 | Batch/CLI deferred to v1.1 | Web single-image first; avoid scope creep |
| 2026-11-13 | PNG byte equality is same-browser only | `CompressionStream` settings are implementation-defined |
| 2026-11-13 | English UI and docs | Public open-source tool; no i18n in v1 |
| 2026-11-13 | Public name = repository name `PaletteExtractorAndImageQuantizer`; short mark `PEIQ`; identifiers `peiq-` / `peiq/*` / `peiq.*` | Owner decision; no separate brand name |
| 2026-11-13 | In-product learning layer (contextual hints + Help drawer), closed by default | Owner requirement: theory accessible without blocking the workflow |
| 2026-11-13 | Visual direction: exact Blender dark + light themes (`#1c1e22` / `#30353b`, light HSL set), blue accent `hsl(204 100% 50%)`, orange brand `#ed8f31`, Inter | Tokens extracted from the saved 5.3 page CSS; see `DESIGN.md` §2 and Appendix A |
| 2026-11-13 | Design system extracted to `DESIGN.md`; plan keeps behavior only | Single design source; easier reuse and audit |
| 2026-11-13 | Self-hosted Inter (OFL), no CDN | Exact site font; fallback stack remains readable |
| 2026-11-13 | Two complete themes, auto by system + 3-state toggle (auto/light/dark), persisted; no mixed tokens | Owner requirement; `theme.test.js` enforces parity |
| 2026-11-13 | Loaded layout = PaletteForge-like stage + right rail; header only brand + theme + Help | Owner requirement; remove clutter |
| 2026-11-13 | `theme-init.js` is an external classic head script, not inline | CSP-safe, no FOUC |
| 2026-11-13 | M1 PNG zlib uses stored blocks; `CompressionStream` deferred | The native stream stalled in headless Chrome; stored blocks are valid and portable, larger files |
| 2026-11-13 | M1 UI uses the stage + right rail; median cut/popularity only | Working vertical slice; fixed palette, dithering, and indexed PNG are M2 |
| 2026-11-13 | Export shows a validated `Save <file>` link instead of auto-downloading | Browsers may block async downloads after a worker response; the save click is a real gesture |
| 2026-11-13 | M1 UX patch: 256-color range, palette sort (source/hue/lightness), footer cleanup | Owner request; keeps the strip order meaningful |
| 2026-11-13 | M2: five extractors + refinement, fixed palettes/import, exact/LUT mapping, ED/Bayer/blue noise, indexed PNG | M2 exit: PICO-8 mapping and round-trip validation green |
| 2026-11-13 | Full DEFLATE decoder; encoder still stored blocks | Palette-strip PNG import works; compression optimization remains |
| 2026-11-13 | Blue-noise mask generated offline and embedded as base64 | No runtime fetch, deterministic asset, checksum recorded |
| 2026-11-13 | Dev server binds to all interfaces and prints LAN URLs | Owner wants to open the tool from a phone on the same network; `--host=localhost` restores loopback |
| 2026-11-13 | Rail sections form an exclusive accordion and use compact desktop spacing | Almost half the controls did not fit; one body at a time removes the inner scroll without hiding section headers |
| 2026-11-13 | Restore independent rail sections and raise label/body spacing; add a numeric color-count field | Owner needs Palette and Dither open together; tight gaps made the first label touch the summary and the colors label touch Method |
| 2026-11-13 | Help renders canonical references and credits; print-only papers are cited without a PDF | Owner wants visible attribution; avoids redistributing copyrighted scans |
| 2026-11-13 | Licensing/attribution rules moved into plan §3.6 | Makes the copyright boundary explicit for future assets and code |
| 2026-11-13 | Add `.nojekyll` and stage only runtime files in the Pages workflow | Pages readiness; keeps tests, tools, docs, and `.git` out of the deployed artifact |

---

## 19. Deferred backlog (v1.x)

| Item | Why deferred |
|---|---|
| Batch + ZIP + manifest per file | Needs queue UI, concurrency, error isolation |
| NES banks / per-region palettes | Bank data model + per-tile optimization |
| Animation frames | Cross-browser frame decoding without deps |
| Yliluoma dithering | Complex; not release-blocking |
| Exact mapping for photos | LUT quality is sufficient; measure first |
| SSIM / banding / APCA | QA already reports ΔE; add after field feedback |
| Palette cycling metadata | Needs index-range model |
| Min-churn reindex (Hungarian) | Useful after palette editing exists in the field |
| CLI / WASM | Requires a second runtime; revisit if batch demand is proven |
| Print/CMYK/spot | Different color science and formats |
| Neural quantization | Model licensing, determinism, palette compliance |
| Accounts/cloud | Contradicts local-first |

---

## Appendix A — Glossary

| Term | Meaning |
|---|---|
| Palette | Ordered set of 1–256 colors with stable IDs |
| Extraction | Choosing a palette from an image histogram |
| Mapping | Assigning each pixel to a fixed palette entry |
| Dithering | Trading per-pixel accuracy for low-frequency accuracy |
| Index map | One palette index per pixel, row-major |
| Indexed PNG | PNG color type 3 with `PLTE` and optional `tRNS` |
| Strip | `N×1` or `1×N` PNG, one pixel per palette entry |
| Oklab | Perceptual color space used for decisions |
| ΔE00 | CIEDE2000 color difference, used for reporting |
| Transparent index | The palette index reserved for fully transparent pixels |
| Compliance | Every opaque output pixel uses an exported palette entry |

## Appendix B — Normative references

- [sRGB specification](https://www.w3.org/Graphics/Color/sRGB)
- [Oklab](https://bottosson.github.io/posts/oklab/)
- [CIEDE2000 test data (Sharma et al.)](https://hajim.rochester.edu/ece/sites/gsharma/ciede2000/)
- [PNG specification, 3rd edition](https://www.w3.org/TR/png-3/)
- [WCAG 2.2](https://www.w3.org/TR/WCAG22/)
- [DTCG format](https://tr.designtokens.org/format/)
- [Aseprite CLI](https://www.aseprite.org/docs/cli/)
- [Godot GradientTexture1D](https://docs.godotengine.org/en/stable/classes/class_gradienttexture1d.html)
- [Unity Texture2D](https://docs.unity3d.com/ScriptReference/Texture2D.html)
- [Godot palette swap shader](https://github.com/KoBeWi/Godot-Palette-Swap-Shader)

Algorithm references are in [RESEARCH_REPORT.md §References](RESEARCH_REPORT.md#references).
The Help drawer renders a curated subset of these links plus the algorithm papers above;
`js/content/references.js` is the single source for URLs shown in the UI. It also carries
the credits for the font, palettes, blue-noise generator, and design. Print-only papers
are cited without a URL rather than linking an unauthorized scan.

## Appendix C — Built-in palette data

All values are lowercase `#rrggbb`, in export order.

**PICO-8 (16)**

```
#000000 #1d2b53 #7e2553 #008751 #ab5236 #5f574f #c2c3c7 #fff1e8
#ff004d #ffa300 #ffec27 #00e436 #29adff #83769c #ff77a8 #ffccaa
```

**Game Boy DMG (4)**

```
#0f380f #306230 #8bac0f #9bbc0f
```

**Commodore 64, VICE default (16)**

```
#000000 #ffffff #880000 #aaffee #cc44cc #00cc55 #0000aa #eeee77
#dd8855 #664400 #ff7777 #333333 #777777 #aaff66 #0088ff #bbbbbb
```

**ZX Spectrum (15; black shared by normal and bright sets)**

```
#000000 #0000d7 #d70000 #d700d7 #00d700 #00d7d7 #d7d700 #d7d7d7
#0000ff #ff0000 #ff00ff #00ff00 #00ffff #ffff00 #ffffff
```

**EGA (16)**

```
#000000 #0000aa #00aa00 #00aaaa #aa0000 #aa00aa #aa5500 #aaaaaa
#555555 #5555ff #55ff55 #55ffff #ff5555 #ff55ff #ffff55 #ffffff
```

**Generated**

- Grayscale 4/8/16: evenly spaced 0..255, rounded.
- 1-bit: `#000000 #ffffff`.
- RGB332 (256): `r = (i >> 5) * 255/7`, `g = ((i >> 2) & 7) * 255/7`,
  `b = (i & 3) * 255/3`, rounded.

## Appendix D — Bayer matrices

```
B2 = [0 2]      B4 = [ 0  8  2 10]
     [3 1]           [12  4 14  6]
                     [ 3 11  1  9]
                     [15  7 13  5]
```

`B8` is generated by the same recursion; no hand-written table.

## Appendix E — Error-diffusion kernels

See §6.6.2. Kernel sums are tested; Atkinson intentionally sums to 6/8.
