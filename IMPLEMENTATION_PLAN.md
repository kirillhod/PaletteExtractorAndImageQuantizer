# PaletteExtractorAndImageQuantizer — Implementation Plan

**Plan version:** 1.5.0
**Product version at completion:** 1.5.0
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

- Read §1–§4 before touching code.
- Read §5–§7 for any algorithm, color, dithering, or export work.
- Read §8 before UI work.
- Read §10–§12 for tests and contracts.
- Read one section at a time with `node tools/spec.mjs plan <section>`; appendices and the
  research report are reference only.
- Keep the §18 decision log current; never silently diverge from a frozen contract.

### Current state (2026-11-16)

| Item | State |
|---|---|
| Research report | Complete; landscape refreshed 2026-11-14 |
| Plan | This document, v1.0.0 (scope reset 2026-11-14) |
| Scaffold | `index.html`, CSS, `package.json`, `.gitignore`, dev server, CI |
| Core | Color, histogram, five extractors, refinement, exact/LUT mapping, dithering, PNG index/encode/decode, palettes, perceptual ordering, picked-marker serialization |
| UI | Stage + compact collapsible rail with a header toggle, left export column with validated clipboard copy, contextual tooltips, English/Russian localization, themes, extract/map modes, fixed palettes, dithering, indexed PNG, full-screen palette preview, Help with extraction and mapping guides and collapsed references and credits, footer session clearing with confirmation, picked-color markers |
| Tests | 193 passing (`node --test`), including golden hashes, dithering, palettes, bounded hue bands, hue-perceptual ordering, perceptual ordering, sort-family mapping, preview backgrounds, dithered preview alpha, Wu grid bounds and occupancy, dither tone and gradient spread, preview sizing, Help placement, picked markers, clipboard helpers, formats, indexed PNG, alpha, metrics, URL state, session state, controls, i18n, messages, theme parity, rail state, view offsets, SEO, references |
| Version | `js/core/version.js`; `v1.5.0` tagged; M6.3–M6.6 complete; unreleased bounded hue bands, hue-perceptual modes, compact sort controls, and the full-screen palette preview with `ALGORITHM_VERSION` 3 |
| Next | Ship the hue-band, hue-perceptual, compact sort, palette-preview, and Help/session-clear changes with the next release; otherwise M7 — later / not planned for v1.x |

> **v1.0.0 scope reset (2026-11-14).** The refreshed landscape in
> [RESEARCH_REPORT.md §4.5](RESEARCH_REPORT.md#45-landscape-refresh-14-nov-2026) shows
> that generic extraction, quantization, dithering, batch export, and palette-format
> export are now commodity features. v1.0.0 is deliberately narrowed to **single-image
> extraction + fixed-palette mapping + validated indexed PNG/strip + essential
> dithering**. Palette editing, perceptual QA, presets, manifests, extra formats, batch,
> CLI, and long-form guide content are parked after 1.0. The feature matrix, milestones,
> and backlog below are authoritative for this reduced scope.

---

## 1. Product definition

### 1.1 One sentence

A browser-local **palette compiler** that turns one image into palette-compliant,
engine-ready assets — indexed PNG, palette strip, reduced PNG, and `.hex`/`.gpl`/`.json`
palette files — with deterministic output and no uploads.

### 1.2 Target users

| User | Job to be done |
|---|---|
| Indie pixel artist | Constrain a sprite or tileset to a fixed palette, preview dithering, and export an indexed PNG that imports cleanly. |
| Hobbyist / game jam developer | Match art to PICO-8, Game Boy, C64, ZX Spectrum, or EGA without installing an editor. |
| UI / brand designer | Extract a small palette from an image and save HEX/GPL/JSON for a design system. |

### 1.3 What v1.0.0 is

- A single-page, static, local-only web tool.
- An extractor **and** a fixed-palette mapper for one image at a time.
- A producer of a small, validated handoff set: indexed PNG, palette strip, reduced RGBA
  PNG, HEX copy, and palette files in `.hex`, `.gpl`, and `.json`.
- Deterministic for a fixed browser version + parameters + seed.
- Two complete themes, dark and light, with automatic system detection, a 3-state header
  toggle (auto / light / dark), persisted preference, and no mixed tokens.
- A compact help layer: `?` tooltips, a Help drawer with “How it works”, references, and
  credits. It must not block the workflow.

### 1.4 What v1.0.0 is not

Not a palette editor, QA dashboard, preset library, batch converter, CLI, API, manifest
generator, or design-token platform. It does not include ΔE00/error maps/worst-pixel
reports, contrast matrices, palette locks/roles, palette swap preview, presets, ASE/CSS/
DTCG exports, deep links, URL state, or a 12-topic theory guide. See §19.

It is also **not** a separate documentation site, a first-run tour, or a wall of permanent
explanatory text.

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
| Help | Every non-obvious control has a tooltip; Help references open only on click |
| Export safety | One export at a time; progress visible; every export validated before Save |

---

## 2. Feature matrix (v1.0.0)

Every row below is `MUST` and release-blocking. Anything not listed is post-1.0; do not
add it to the 1.0 release without a scope decision and a plan update.

| ID | Feature | Priority | Milestone | Acceptance criterion |
|---|---|---|---|---|
| F-01 | Load PNG/JPEG/WebP/GIF/BMP/AVIF; drag-drop, picker, paste | MUST | M1 | Image appears with dimensions and color count; unsupported input shows a clear error |
| F-02 | Preview with before/after slider, fit, 100%, original toggle | MUST | M1 | Divider draggable; fit/100% work; no main-thread freeze |
| F-03 | Extraction: popularity, median cut, Wu, octree, K-means++ | MUST | M1–M2 | Each method returns a valid palette; deterministic with same seed |
| F-04 | Working space Oklab (default) and sRGB | MUST | M1 | Conversions match §5; the choice is visible in the UI |
| F-05 | Fixed-palette import (.hex/.gpl/.pal/.json/PNG strip) | MUST | M2 | 1–256 entries; invalid files rejected with a specific error |
| F-06 | Built-in palettes (PICO-8, Game Boy, C64, ZX Spectrum, EGA) | MUST | M2 | Counts and values match Appendix C; selectable in one click |
| F-07 | Map image → palette, documented tie-break | MUST | M2 | 100% of opaque pixels use a palette entry; lowest index wins ties |
| F-08 | Dithering: none, FS, Atkinson, Stucki, Jarvis, Burkes, Sierra, Bayer 2/4/8, blue noise | MUST | M2 | Palette compliance preserved; strength/serpentine/edge-stop behave per §6.6 |
| F-09 | Palette ordering: source, manual, hue, hue perceptual, lightness ↑/↓, perceptual smooth/color path/flow | MUST | M1 | Strip and swatches follow the order; one direction button flips the directional families |
| F-10 | Indexed PNG export with reserved transparent index | MUST | M2 | Bit depth rule, `PLTE`/`tRNS`, round-trip equality |
| F-11 | 1×N / N×1 palette strip export + validation | MUST | M1 | Exact dimensions, no profile, every pixel validated |
| F-12 | Reduced RGBA PNG + HEX copy | MUST | M1 | Download or copy the current palette without changing order |
| F-13 | Palette exports: `.hex`, `.gpl`, `.json` | MUST | M3 | Round-trip to the same colors; no manifest or extra formats in v1.0 |
| F-14 | Export validation, progress, and one-at-a-time lock | MUST | M3 | Decode/compare before Save; all buttons disabled while busy; progress visible |
| F-15 | Responsive layout + keyboard + ARIA | MUST | M4 | Usable at 360 px; all controls reachable by keyboard |
| F-16 | Static deploy on GitHub Pages | MUST | M4 | HTTPS page loads; worker and all assets resolve under the repo subpath |
| F-17 | Two complete themes: dark + light, auto by system + 3-state toggle, persisted | MUST | M4 | No mixed tokens; no FOUC; instant switch; light/dark parity test |
| F-18 | Help: `?` tooltips, How-it-works, references, credits | MUST | M3–M4 | Every non-obvious control has a tooltip; references open only on click; nothing auto-opens |

**v1.1 (complete):** minimal palette editor + locks, ΔE00 summary/error
map/worst pixels, URL state. **Later/not planned for v1.x:** palette roles, contrast
matrix, presets, palette swap, manifest/QA JSON, `.pal`/`.css`/`.ase`/DTCG exports, deep
links, 12+ guide topics, batch/ZIP, CLI/WASM, animation, NES banks, Yliluoma, exact
mapping for photos, SSIM/APCA, palette cycling, min-churn, print/CMYK, neural
quantization, accounts/cloud. See §19.

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
  with it and the provenance is recorded in `assets/PROVENANCE.md`.
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
│ main.js · controls · canvas-view · palette-view · export-view · tooltips    │
│ export-controller · picked-markers · session-store · theme · i18n           │
└───────────────────────────────────┬────────────────────────────────────────┘
                                    │ postMessage (transferables)
┌───────────────────────────────────▼────────────────────────────────────────┐
│ pipeline.worker.js                                                          │
└───────────────────────────────────┬────────────────────────────────────────┘
┌───────────────────────────────────▼────────────────────────────────────────┐
│ core/ (DOM-free, pure ES modules, Node-testable)                            │
│ decode* → histogram → extract → order → map → dither → index → encode      │
│            formats · palettes · hash · rng                                  │
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
- Theme resolution/persistence lives in `js/theme-init.js` and `js/ui/theme.js`; the pure
  mode helpers live in `js/core/theme-mode.js`, which has no DOM knowledge.
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
- `processing` sends the mapping preview: the full image up to a 4,194,304-pixel budget,
  otherwise the same aspect ratio scaled by area to sit just under it. The full-resolution
  decode is kept for the original half of the canvas, and export re-decodes the file for a
  fresh full-resolution copy.
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

- **Oklab is the working space for color-assignment decisions:** extraction
  (histogram cells, Wu moments, median-cut axes, K-means centroids, refinement),
  nearest-color mapping, and dithering. It is a vector space with meaningful
  centroids, error vectors, and fast Euclidean distances.
- **CIEDE2000 is the metric for palette ordering and reporting.** Ordering a fixed
  palette of 1–256 colors is a one-off pairwise comparison and can afford `deltaE00`;
  QA reports mean/p95/max ΔE00, the error map, and worst pixels.
- **Nearest-color assignment still uses Oklab**, even when the palette order was
  produced with CIEDE2000. Ordering changes export indices; it does not change the
  mapping metric.
- CIEDE2000 is not a working space: it is a difference formula over CIELAB pairs.
  Do not replace Oklab centroids, Wu moments, or error-diffusion vectors with it.
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
- The preview keeps the source alpha in both the nearest-color and the dithered path:
  fully transparent pixels stay invisible and semi-transparent pixels keep their
  coverage. An index map carries no alpha, so a dithered preview is composed from the
  source buffer rather than from the palette alone; the reserved index is always
  transparent. Export validation still expects the binary `tRNS` result.
- A reserved transparent index removes one usable opaque slot: `colors` includes it.

### 5.5 Distances and precision

- Clustering, mapping, and dithering distances in Oklab with `f64`.
- Palette ordering uses pairwise CIEDE2000 distances; every ordering has a total
  tie-break (§6.7). Oklab remains the metric for nearest-color assignment.
- sRGB→linear LUT of 256 entries is allowed.
- Oklab is computed per histogram bin / unique color, never per pixel.
- Nearest-color ties: **lowest palette index wins**.
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
- sRGB maps each 5-bit bin to one cell, so the grid already matches the histogram.
  Oklab normalizes the occupied L, a, b ranges onto the 32 steps, because the fixed
  full-gamut range collapses a narrow hue or lightness range into a handful of cells and
  stops the split early; a degenerate span is grown around its center.
- A second occupancy prefix counts the bins per cell. A box with no occupied cell is
  empty, so an inclusion–exclusion residual from non-binary alpha weights can neither
  become a representative nor block the split loop.
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
- Implementation notes, all of which preserve the algorithm above:
  - `mapper.nearestOklab(corrected)` is a nearest-color cell grid over the working space,
    filled on demand. Oklab uses 128 steps per axis (finer than one sRGB level), sRGB
    reuses the mapper's 6-bit grid. A cell always resolves from its own center, so the
    result does not depend on visit order.
  - Source coordinates come from a 6-bit RGB table per space, built once and cached. A
    per-pixel `rgb8ToOklab` costs three cube roots and gains nothing over the 5-bit
    histogram and 6-bit lookup cells already in use.
  - The error clamp compares squared magnitude and takes one `sqrt` only when it clamps;
    `Math.hypot` costs the same work on every pixel.
  - `strength = 0` returns the plain mapping directly, because no error can leave a pixel.

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

#### 6.6.5 Defaults (presets are post-1.0)

The table below is a design reference for future presets; v1.0.0 ships the individual
controls only, with no preset picker. The current UI default is **Wu, K=16, Oklab, no
dither, source order, no transparent index**.

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
- `addPaletteEntry`, `updatePaletteEntry`, `removePaletteEntry`, `setPaletteLock`, and
  `movePaletteEntry` return new palettes; IDs survive, indices are reassigned, and exact
  duplicate colors are rejected in the editor.
- Locks pin an entry to its current display slot. Unlocked entries fill the remaining
  slots in the requested order, so a locked color never moves. Locked colors cannot be
  removed; HEX edits keep the lock.
- `sortPalette(palette, order)` returns a new palette; IDs survive, indices are reassigned.
  The strip export and HEX list use this order.
- Perceptual ordering uses pairwise **CIEDE2000** distances and a deterministic path/2-opt
  search. Oklab `L/C/h` remain the keys for `hue-*` and `lightness-*`; the ordering metric
  changes indices, not the nearest-color metric.
- Sort keys:
  - `source`: ID ascending, restoring extraction order after any other sort.
  - `manual`: keep the current array order; the editor’s ← / → buttons move an unlocked
    entry one slot and switch the sort to Manual. A locked entry keeps its slot, so a move
    that would cross it is refused.
  - `lightness-asc` / `lightness-desc`: Oklab L, then hue, then C descending, then ID.
  - `hue-asc` / `hue-desc`: achromatic (`C < 0.02`) first by L in the requested
    direction; chromatic entries form **circular hue bands** and each band is sorted by L
    in the requested direction, then C descending, ID. The sequence starts after the
    largest hue gap, so reds near 0°/360° stay together. A band wider than 30° is split at
    the internal gap that best balances the two halves, with a bias toward wider gaps, so
    a continuous blue-purple region becomes several ramps instead of one L sweep. Both
    modes use the same bands and differ only in the ramp direction.
  - `hue-perceptual-asc` / `hue-perceptual-desc`: the same bands, refined per band by
    deterministic CIEDE2000 2-opt with fixed L seed endpoints. A small DP then chooses
    each band's direction (forward/reverse) to minimize the Delta E at the joins; a band
    may run light-to-dark even in the ascending mode when that keeps the strip continuous.
    The descending mode uses the opposite seed and its own DP.
  - `perceptual`: start from `lightness-asc`, then 2-opt with fixed first/last entries.
    Keeps the Oklab dark-to-light flow and removes local CIEDE2000 jumps.
  - `perceptual-path`: nearest-neighbor path from the darkest to the lightest Oklab L
    entry, then 2-opt with fixed ends. Both directions are tried; the lower total cost
    wins. The fixed-endpoint idea follows
    [colorsort](https://github.com/rowland-208/colorsort).
  - `perceptual-flow`: all-start nearest-neighbor cycle, 2-opt, cut at the largest
    CIEDE2000 edge, then orient dark-to-light by Oklab L. This is DCCW single-palette
    sorting ([Kim & Choi 2021](https://doi.org/10.1145/3450626.3459776)) with
    deterministic 2-opt instead of LKH.
- The sort select shows one row per family: `source`, `manual`, `hue`,
  `hue-perceptual`, `lightness`, `perceptual`, `perceptual-path`, `perceptual-flow`.
  A direction button maps the three directional families to their `-asc`/`-desc` keys
  and is disabled for fixed-direction orders. URLs, sessions, and exports keep the full
  key, so existing links and saved sessions still load.
- `dedupePalette` folds exact RGB duplicates into the first entry and records aliases;
  a “keep duplicates” option is out of scope for v1.
- `paletteHash` covers canonical `{order, space, entries:[{index,rgb,alpha}]}`.
- Locked entries cannot be removed; removing an entry renumbers indices deterministically.

### 6.8 Indexing (`core/map.js`, `core/png/encode.js`)

- Bit depth: `K ≤ 2 → 1`, `K ≤ 4 → 2`, `K ≤ 16 → 4`, `K ≤ 256 → 8`.
- Indices are packed MSB-first within each byte, per the PNG specification.
- `transparentIndex` is validated against `0..K-1`; `-1` means none.
- `tRNS` contains one alpha byte per palette entry: 0 at the transparent index, 255
  elsewhere. No other alpha.
- Index map length MUST equal `width * height`.
- Every index MUST be `< K`.

### 6.9 QA (`core/metrics/`)

Implemented in v1.1 on the preview.

- `computeQuality(original, mapped)` compares source preview RGB with mapped preview RGB
  using CIEDE2000 and skips fully transparent source or mapped pixels.
- Mean is exact; p95 uses a fixed histogram of 0.1-wide buckets from 0 to 200; max is exact.
- Worst pixels: top 20 by ΔE00, tie-break `(y, x)` ascending.
- Error map: RGBA heatmap with a fixed 256-entry ramp, clamped at 20 ΔE00; transparent
  pixels stay transparent.
- The UI measures the preview, not the full-resolution export. Contrast matrices remain
  out of v1.1.

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
- Color-assignment decisions (extraction, mapping, dithering) use Oklab; palette
  ordering and QA use CIEDE2000. Both are deterministic and use documented ties.
- Nearest-color ties: lowest palette index.
- K-means: fixed iteration cap and epsilon; no wall-clock stop.
- Float comparisons use `f64`; stored palette values are exact 8-bit.
- Canonical JSON: object keys sorted recursively; no insignificant whitespace.
- Hash: SHA-256 via `crypto.subtle`; fallback FNV-1a 64-bit with a flag.
- `ALGORITHM_VERSION = 3`; bump it when a decision-affecting rule changes.

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
Loaded state: three columns on desktop — export, stage, and settings rail — following the
PaletteForge workflow without its header clutter. The export column spans the canvas and
palette rows; its palette-editor hint sits at the bottom of that free left column so hint
text changes never resize the canvas, and the palette starts at the canvas’s left edge.
On mobile the order is toolbar, export, canvas, palette, hint, settings.

```text
┌──────────────────────────────────────────────────────────────┐
│ [PEIQ]                                      [theme] [help]   │ 52 px
├──────────────────────────────────────────┬───────────────────┤
│ Export (180–220) │ Stage                   │ Rail (360/340 px) │
│  primary PNG     │  toolbar: change · fit  │  Palette          │
│  copy / strip    │  canvas / before-after  │   mode, algorithm │
│  reduced / HEX   │  palette strip          │  Dither           │
│  hint (bottom)   │  status line            │  (scrolls)        │
└──────────────────┴─────────────────────────┴───────────────────┘
```

- **Header:** 52 px (48 px below 980 px); brand on the left; a settings-rail toggle,
  language toggle, theme toggle, and Help on the right. No mode tabs, nav links, download
  buttons, account controls, or secondary subbar. The rail toggle only appears once an
  image is loaded.
- **Empty state:** full-width hero; no rail. After an image loads, the hero collapses into
  the stage and the rail appears.
- **≥ 1220 px:** export `clamp(180–220 px)` + stage `1fr` + rail **360 px**.
  **980–1219 px:** export **180 px** + stage `1fr` + rail **340 px**.
  **< 980 px:** stacked; export, toolbar, canvas, palette, settings. **< 600 px:** single
  column, 44 px touch targets, canvas `55svh`.
- **Stage:** a 28 px desktop toolbar, canvas, palette strip, usage bar, and a compact
  24 px status line. "Change image" lives in the stage toolbar, not the header.
- **Export column:** a narrow left column with the primary indexed-PNG action, strip,
  reduced PNG, HEX, and strip orientation. It does not take width from the canvas. Each
  validated result adds Save and Copy actions. The palette-editor hint is bottom-aligned
  in the same left column.
- **Rail:** a stack of collapsible settings sections — Palette (with the Extract/Map
  switch) and Dither. Export is not in the rail; the Quality section is collapsed by default.
  The header toggle collapses the whole rail and gives its 360/340 px to the stage; the
  choice persists in `peiq.rail` and is restored before paint.
- **Palette strip:** directly under the canvas; swatches wrap and scroll. A compact bar
  above it shows the palette count and a sort select: source, manual, hue grouped, hue
  perceptual, lightness, perceptual smooth, perceptual color path, and perceptual flow.
  A direction button next to the select switches Hue and Lightness between dark→light and
  light→dark and is disabled for orders with a fixed direction. The selected order controls
  the swatches, HEX copy, and strip export.
- **Desktop frame:** the page itself does not scroll. Header, stage, and compact footer
  fill the viewport; the stage gives the canvas the remaining height and only the rail
  (or a palette strip with many colors) scrolls.
- **Export panel:** a separate left column with the primary indexed-PNG action and the
  strip/reduced/HEX actions; above the canvas below 980 px. The column spans the canvas and
  palette rows, the palette aligns with the canvas’s left edge, and the editor hint sits at
  the bottom of the free left column. After validation, every result offers Save and Copy.
- **Quality:** export validation and palette compliance stay in the status line. The
  Quality section measures the current preview with CIEDE2000: mean, p95, max, a toggleable
  error map, and the 20 worst pixels. Contrast matrices are out of v1.1.
- The header shows the full public name at ≥980 px; below that, the short mark `PEIQ`
  with an `aria-label`/`title` carrying the full name. The document title uses the full
  name.
- The `Help` and theme buttons are always visible, including the empty state.
- Visual language, tokens, component styles, motion, and breakpoints: see
  [`DESIGN.md`](DESIGN.md).

### 8.2 Controls

The loaded UI has three control surfaces: the stage toolbar, the export column left of the
canvas (above it on mobile), and the right settings rail. Rail sections are independently collapsible;
**Palette** starts open and **Dither** may be opened alongside it. Desktop spacing is
compact but keeps an 8 px gap between labels and controls; the rail scrolls only when
open bodies exceed the viewport. Touch layouts keep 44 px targets.

Every non-obvious control has an 18 px `?` button. It opens a plain-language tooltip on
hover or focus, uses tap on touch, closes on `Esc` or an outside tap, and is appended to
`<body>` so the rail never clips it. Tooltip text also becomes the button’s `aria-label`.

**Stage toolbar** (above the canvas)

- "Change image" button (file picker, drag, paste).
- Fit and 100%.
- Original/result toggle.
- Image info: filename, dimensions, unique colors (5-bit bins).

**Palette rail section**

- Mode tabs `Extract` and `Map` (inside the section, not the header).
- Extract: five algorithms (popularity, median cut, Wu, octree, K-means++), colors
  2–256 via a range plus a numeric field (kept in sync; commits clamp and empty falls back
  to 16), working space, with refinement defaulting on for median cut and Wu. **Default:
  Wu, K=16, Oklab.**
- Map: built-in target palette (PICO-8, Game Boy, C64, ZX Spectrum, EGA), "Load palette
  file…" for `.hex`, `.gpl`, `.pal`, `.json`, and 1×N/N×1 PNG strips, transparent index,
  alpha threshold. Map does not extract colors: the target palette is used as-is and the
  extractor settings apply only in Extract mode. The hint and the Help section explain
  that every pixel becomes the nearest color in the target palette and that the right half
  of the preview is the result. The transparent index defaults to **None** in both modes;
  choosing one removes that entry from the preview and the indexed/strip output. A
  restored session keeps the target palette name it showed, including imported files.
- Palette order bar: source / manual / hue grouped / hue perceptual / lightness /
  perceptual smooth / perceptual color path / perceptual flow; swatches, HEX list, and
  strip export follow it. A direction button next to the select switches hue and
  lightness between dark→light and light→dark; it is disabled for fixed-direction
  orders. Hue modes group similar tones into bounded bands; the plain hue mode sorts each
  band by Oklab lightness, and the perceptual hue mode refines each band with CIEDE2000
  and chooses each band's direction so neighboring bands join at their closest ends.
  Perceptual modes are labeled by their result, not by the metric name; Oklab and
  CIEDE2000 belong in Help and technical docs.
- Palette editor: **Edit** turns swatch clicks into selection, exposes a HEX field, and
  adds an icon **Pick** button plus text **Apply**, text arrows **← / →**, and icon
  **Add / Remove / Lock** buttons with action labels. Add is a plus, Remove a trash can,
  and Lock shows an open or closed padlock with the same accent pressed state while the
  entry is locked. The HEX field is fixed at 7.5 rem so the controls stay grouped on the
  left. The palette bar carries compact undo/redo icon buttons next to Edit. A preview
  icon button sits between redo and Edit: it opens the current palette as one full-screen
  strip on a neutral gray background, with two gray presets and a color picker for the
  background. Color blocks keep a gap of roughly 15% of the block width between neighbors
  at any palette size. The chosen background persists under `peiq.previewBg`; the preview is
  read-only and never changes the export. `Esc`, the close button, or a click on the
  backdrop closes it, and focus returns to the trigger. The dialog traps Tab while open,
  and the page behind it does not scroll. Edit is a
  toggle button with a visible pressed state; its label does not change, so the bar never
  rewraps. The editor row reveals with a 150 ms height transition and the canvas refits
  each frame, so opening or closing it never blinks or jumps. **Pick** is an icon button with
  a visible pressed state; it arms a canvas eyedropper with a floating color/HEX
  preview under the pointer: press and drag to sample the visible preview (the reduced
  side when the point is right of the divider), watch the magnified loupe, and release to
  apply it to the selected entry or fill the HEX field for **Add**. A mouse click applies
  on release at the same point. **Pick stays armed after a successful sample** so several
  swatches can be recolored without pressing the button again; the button toggles it off
  and `Esc` stops it.
  **Picked-color anchors:** a successful pick creates a marker at the sampled point;
  extracted and imported colors have no marker until explicitly picked. Markers are
  visible only in Edit mode, follow pan and zoom, and can be dragged or nudged with arrow
  keys to update the entry. A drag commits one undo step; `Esc` cancels it. A marker is
  stored by palette ID as normalized image coordinates, so reordering and locking do not
  move it; removing the entry or making it transparent removes it. Markers persist in the
  session but never enter palette JSON or hashes.
  **Clearing the selection:** clicking any empty part of the palette card (bar, strip
  gaps, or editor row), or pressing `Esc` while the palette has focus, clears the edited
  entry and HEX field. Controls and swatches keep their own action. With no entry
  selected, Pick fills the HEX field for **Add** instead of overwriting an existing color.
  **← / →** move the selected unlocked color one slot, switch to Manual order, and remap
  the preview. Moving changes export indices, not the set of mapped colors, so the preview
  normally looks identical; the transparent index follows the entry. Adding, removing, or
  editing a color changes the candidate set and therefore the preview and Reduced PNG.
  Locked entries keep their slot, and a move that would cross one is blocked. Locks pin an
  entry to its current slot during sorting and block removal.
  The editor keeps up to 50 snapshots of the editable state (settings, colors, order,
  locks, selection, sort, transparent index, and picked-color markers). Palette edits and
  settings changes share one timeline: extractor, dither, alpha, and transparent-index
  changes commit one step per gesture, and changing the extractor starts a fresh
  extraction and drops manual edits while undo restores them. `Ctrl/Cmd+Z` and
  `Ctrl/Cmd+Shift+Z` work outside text fields whether or not Edit is on, and the undo/redo
  icon buttons are always visible in the palette bar.
  Rename, roles, and drag reordering remain post-1.1.

**Dither rail section**

- Methods: none, Floyd–Steinberg, Atkinson, Stucki, Jarvis, Burkes, Sierra, Bayer
  2×2/4×4/8×8, blue noise.
- Strength 0–100%; serpentine and edge-stop for error diffusion only.
- The controls disable themselves when the selected method does not use them.

**Export panel** (left of the canvas on desktop, above it on mobile)

- Primary: "Download indexed PNG".
- Secondary: "Palette strip", "Reduced PNG", "Copy HEX".
- Every completed export appears as a validated file row with **Save file** and **Copy**.
  Copy uses the already validated bytes: PNG results are written to the clipboard as
  `image/png`; `.hex`, `.gpl`, and `.json` results are copied as text. Copy is never
  offered before validation and never replaces Save.
- While an export runs, show an indeterminate progress bar and stage label; mark the
  panel `aria-busy` and disable every export/copy button.
- Only one export may be in flight. A second click, a different export button, or
  `Copy HEX` while busy is ignored. Changing image or settings cancels the stale export.
- If image clipboard writes are unavailable or denied, say so and point to the matching
  Save action instead of failing silently.
- Indexed export uses the sorted palette and declared transparent index; it is decoded
  and compared to the index map.
- Strip orientation toggle `N×1` / `1×N` with a filename preview.
- Contract summary before download: `K`, bit depth, transparent index, dimensions.
- Palette-file exports: `.hex`, `.gpl`, and native `.json`.
- After validation, show a `Save <file>` link. The actual file write is a real user
  gesture; browsers may block an async automatic download after a worker response. No
  silent auto-download.

**Help**

- Header `?` button opens the Help drawer with How it works, shortcuts, references, and
  credits.
- Header theme toggle cycles `auto → light → dark`; the preference persists in
  `localStorage` under `peiq.theme`; the current mode is announced.
- Header language toggle cycles `auto → en → ru`; `peiq.locale` persists the mode and
  `auto` follows the browser language. Switching updates the whole site in place.
- A small `?` next to every non-obvious control opens a plain-language tooltip. Tooltip
  text is also the button’s `aria-label`.
- Nothing auto-opens; `Esc` and outside-click close; focus returns to the trigger.

### 8.3 Canvas interactions

- Before/after divider at 50%, draggable; keyboard: `role="slider"`, arrow keys ±1%.
- Zoom: wheel at cursor, `+`/`−` toolbar buttons, pinch on touch, `F` fit, `1` 100%.
- Pan: drag with one finger or the mouse; two-finger pinch also pans by its midpoint.
- `O` toggles original.
- Pixelated rendering at ≥100%; smooth below. Error-map and palette-swap previews are
  post-1.0.
- Checkerboard behind alpha.
- Largest canvas backing store: `min(devicePixelRatio, 2)`.
- No layout shift while processing; keep the last result visible with a progress overlay.
- Keep the previous status line and export controls during a preview. An export click while
  a preview is in flight reports processing instead of exporting a stale palette.

### 8.4 Visual system

All colors, typography, component styles, depth, motion, and breakpoints are defined in
[`DESIGN.md`](DESIGN.md). The plan fixes behavior and contracts only.

- Components MUST use the `--peiq-*` variables from `DESIGN.md` ?2; no hard-coded hex.
- Dynamic palette swatch colors are the only inline-style exception: set `--swatch` on the
  element, never a hex in JS. The full-screen preview background is the second exception:
  it is user data, so it is set as `--peiq-preview-bg` on the dialog, never as a literal
  `background` value.
- If a visual value and this plan disagree, `DESIGN.md` wins; if behavior disagrees, this
  plan wins.

### 8.5 Keyboard shortcuts

| Key | Action |
|---|---|
| `F` | Fit canvas |
| `1` | 100% zoom |
| `O` | Toggle original |
| `E` | Toggle error map |
| `T` | Cycle theme: auto → light → dark |
| `Ctrl/Cmd+Z` | Undo the last palette or settings change |
| `Ctrl/Cmd+Shift+Z`, `Ctrl/Cmd+Y` | Redo the last palette or settings change |
| `?` | Toggle Help drawer |
| `Esc` | Close help, popover, or picking mode |

Single-key shortcuts are disabled while an input, textarea, or select has focus. Text
entry keeps its native undo; Ctrl/Cmd+Z and Ctrl/Cmd+Y still reach the shared history
when a select, range slider, or checkbox is focused.

### 8.6 Accessibility

- Every input has a `<label>`; swatches are `<button>` with `aria-label="Index 3, #ff004d"`.
- Status uses `aria-live="polite"`.
- The before/after divider is keyboard-operable with `role="slider"`.
- The theme toggle is a 32 px button with a dynamic `aria-label` naming the current mode
  and the next action; theme changes are announced via a polite live region.
- The language toggle is a compact text button with a dynamic `aria-label` naming the
  current mode, effective language, and next action; changes are announced.
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
- Hover/focus (desktop) or tap (touch) opens a popover: 2–4 short sentences of plain
  text. The Help drawer carries the references; tooltips do not navigate. Maximum width
  320 px; positioned next to the trigger.
- `Esc`, outside-click, or a second click closes it; focus returns to the trigger.
- Hints never cover the canvas, never block a control, and never auto-open.

**Help drawer**

- The header `?` button opens a non-modal right-side drawer with two tabs:
  - **Guide** — topics, each with a summary, 2–4 short paragraphs, and canonical links.
  - **Shortcuts** — the table from §8.5.
- Closed by default. Remembers the last tab for the session only.
- Desktop: 680 px overlay above the right rail; the canvas does not relayout. Body text is
  1rem at 1.6 line height, and each section opens with a bold takeaway (or a bold term
  list) so the drawer reads as prose rather than a wall of small text.
  < 960 px: full-height sheet; `Esc` closes.
- The drawer header uses the page header height (`--peiq-header-height`) and the same
  inline padding, its title matches the brand's 18 px/800 scale, and the close button is
  an 18 px icon. The two bottom borders line up when the drawer is open.
- Current order: How it works, Extracting a palette, Mapping to a palette, Palette order
  and preview, Picked colors, Quality, Shareable settings, Saved session, and Shortcuts.
  Extraction names the five methods and their trade-offs; Mapping stays a separate
  section. References and credits are native `<details>` disclosures, closed by default,
  so the guide stays short without removing attribution.
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

- v1.0 Help content: How it works, extraction and mapping, ordering and preview, picked
  colors, quality, shareable settings, saved session, shortcuts, references, and credits.
  There is no long-form Guide, topic tabs, or deep-link routing in this release.
- **Forget saved session** is not in the drawer. It sits in the footer next to the
  privacy statement, so it is visible without scrolling; the button opens a native
  confirmation dialog with Cancel focused by default and clears IndexedDB only after the
  user confirms.
- `js/content/references.js` holds canonical references:
  `{ id, title, authors, year, venue, url }`; it is the single source for UI links.
- Rendered with `createElement`/`textContent`; no Markdown parser, no `innerHTML`, no
  iframe, no embedded video, no third-party widget.
- Links are canonical sources (papers, specs, engine docs), `target="_blank"`,
  `rel="noopener noreferrer"`. No prefetch/preconnect. The page remains local-only; only
  an explicit click navigates away.
- Content is static and bundled; zero runtime fetches.
- Drawer semantics: `role="dialog"`, `aria-modal="false"`, labelled by its heading;
  focus moves in on open and returns on close.
- Post-1.0 only: `js/content/learn.js`, `#help=<topic>` deep links, Guide/Shortcuts tabs.
- Non-goals: first-run tour, modal onboarding, permanent explanatory paragraphs,
  documentation site, comments/community.

---

### 8.9 URL state

- The hash stores normalized settings only: mode, extractor, color count, space, built-in
  palette id, dither settings, alpha threshold, transparent index, and sort order.
- Defaults are omitted; `v=1` versions the format. Image bytes, palette edits, imported
  palette contents, and QA results are never serialized.
- User changes rewrite the hash with `history.replaceState`; loading a URL or editing the
  hash restores the controls. A pending transparent index is applied after the palette
  exists.

### 8.10 Session persistence

- IndexedDB stores the last image as encoded bytes (`ArrayBuffer`), plus settings, palette
  entries, locks, order, selected entry, edit mode, transparent color id, and the
  palette/settings undo history. Version 1 records with a Blob are read once and upgraded
  on the next save.
- On load, a saved session reopens the editor directly. The URL hash remains a portable
  settings config: if it differs from the saved settings, it wins and the palette is
  re-extracted from the image instead of restoring local edits.
- A newer image load owns the UI. If the user drops or chooses an image while the saved
  session is being read or decoded, the restore is abandoned and must not apply settings,
  replace the image, or surface its own decode error afterwards.
- **Forget saved session** in the footer clears the stored image and state after a
  confirmation dialog; a failed decode, invalid record, unavailable storage, or quota
  error falls back without trapping the user.
- Imported palette contents and QA results are not part of the session.

### 8.11 Localization

- The site UI is fully available in English and Russian. Repository documentation stays
  English; only the rendered site switches.
- `js/content/messages.en.js` and `js/content/messages.ru.js` hold flat catalogs with
  matching key sets; `js/content/messages.js` combines them for `MESSAGES`.
  `js/core/i18n.js` owns locale detection, interpolation, and `Intl.PluralRules` plural
  formatting; `js/ui/i18n.js` applies the catalog to the DOM and dispatches locale changes.
- `peiq.locale` stores `auto | en | ru`. In `auto`, the first `ru`/`en` prefix in
  `navigator.languages` wins, otherwise English; a `languagechange` event re-resolves it.
  `js/theme-init.js` writes `<html lang>`, `data-locale`, and `data-locale-mode` before paint.
- The header language toggle cycles `auto → en → ru`, sits next to the theme toggle, and
  uses a compact text label (`AUTO`/`АВТО`, `EN`, `RU`). Switching updates static copy,
  tooltips, dynamic status and toasts, palette state, Help references/credits, and the
  document title without reloading.
- Static HTML uses `data-i18n`, `data-i18n-tooltip`, `data-i18n-aria-label`,
  `data-i18n-title`, `data-i18n-content`, and `data-i18n-placeholder`. Dynamic code uses
  `t()` and `tp()`; no user-facing string bypasses the catalog. English is the fallback.
- Russian uses the `one` / `few` / `many` / `other` plural forms for color, pixel, and HEX
  counts. Both languages share the same layout; no per-language component overrides.
- Reference titles, authors, and venues stay canonical; group headings, print notes, and
  credit labels/descriptions are localized.
- The same URL serves both languages through JavaScript. This is good for the user but
  does not create a separately indexable Russian page; Russian search visibility would
  require a static `/ru/` route with `hreflang`, not only JS switching.

### 8.12 SEO metadata

- `index.html` carries an absolute `canonical`, `index,follow,max-image-preview:large`,
  a keyword-first `<title>` that ends with the `PEIQ` short mark, and a natural-length
  `<meta name="description">`. The repository display name remains in JSON-LD and the
  header; the title avoids truncating a 33-character unbroken word in search results.
- Open Graph and Twitter Card metadata use absolute URLs and the 1200×630
  `assets/og-image.png` social preview.
- JSON-LD describes a free `WebApplication` with category, browser requirements, feature
  list, repository, license, screenshot, and `offers.price = "0"`.
- `sitemap.xml` lists the canonical page with `lastmod`; `robots.txt` references the
  project sitemap. GitHub project pages cannot own the host-root `robots.txt`, so manual
  Search Console submission remains the reliable discovery path.
- `test/seo.test.js` checks the metadata, JSON-LD, social image dimensions, sitemap, and
  robots references. Localized Russian SEO would need a separate static route.

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
| Full preview pass at 4 MP | < 2 s |
| 4096² K=64, no dither | < 8 s |

### 9.2 Strategies

- Web Worker for all core work; decode on main thread.
- Full image up to a 4,194,304-pixel preview budget; above it, scale by area so the preview
  lands just under the budget and keeps the source aspect ratio. The original half of the
  canvas always draws the full-resolution decode; the status line names the preview size
  when it differs from the source.
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

- Preview buffers ≤ 4 MB and stay in memory; the full-resolution RGBA source is decoded
  only for an export and released when the worker receives it.
- Full-res RGBA 4096² = 64 MB; histogram ~1.5 MB; LUTs ~1 MB; index map 16 MB.
- Release canvases and buffers after export; revoke object URLs.
- Reject > 16.7 MP before allocating the preview and export buffers.

---

## 10. Testing

> **v1.0.0 scope:** tests for QA metrics, palette editing, presets, `.ase`/CSS/DTCG
> exports, manifest, and deep links are post-1.0 reference. The release suite covers the
> lean feature matrix in §2.

### 10.1 Framework

- `node --test` only. No test dependencies.
- Tests import `core/**` directly; no DOM.
- Canvas-dependent behavior is covered by manual browser checks and by testing the
  pure PNG encoder/decoder in Node.
- Test helpers in `test/helpers.js` generate images programmatically (no binary fixtures).

### 10.2 Test map

| File | Covers |
|---|---|
| `color.test.js` | sRGB/Oklab/Lab, ΔE00 Sharma pairs, hex, contrast |
| `version.test.js` | `APP_VERSION` matches `package.json`; `ALGORITHM_VERSION` positive |
| `rng.test.js` | splitmix64 sequence, seed determinism |
| `hash.test.js` | SHA-256/FNV fallback, canonical JSON |
| `histogram.test.js` | binning, alpha weights, representatives |
| `quantize.test.js` | popularity, median cut, Wu, octree, K-means++ basics |
| `quantize-advanced.test.js` | refinement, degenerate inputs, determinism |
| `palette.test.js` | IDs, ordering, locks, dedupe, hash |
| `palette-order.test.js` | perceptual determinism, endpoints, CIEDE2000 cost, DCCW cut, locks, 256 colors |
| `picked-markers.test.js` | marker round-trip, clamping, invalid records, clone independence |
| `clipboard-image.test.js` | image clipboard feature detection, PNG blob type and bytes |
| `map.test.js` | exact/LUT modes, tie-break, alpha, compliance |
| `dither.test.js` | kernels, serpentine, strength, edge stop, Bayer, blue noise, compliance |
| `png.test.js` | encode/decode, filters 0–4, bit depths, tRNS, packing, round-trip |
| `formats.test.js` | .hex/.gpl/.pal/.json round-trips |
| `palettes.test.js` | built-in counts/values, import parsers |
| `metrics.test.js` | ΔE stats, p95, worst pixels, compliance |
| `pipeline.test.js` | stage composition, preview vs final params |
| `pipeline-m2.test.js` | indexed export, transparent index, alpha compliance |
| `golden.test.js` | synthetic fixture → reviewed hashes |
| `theme.test.js` | dark/light token parity, auto resolution, 3-state cycle, invalid storage, rail restore |
| `rail-state.test.js` | rail state normalization and toggle |
| `controls.test.js` | extractor select normalization |
| `i18n.test.js` | locale detection, message formatting, plurals |
| `messages.test.js` | EN/RU key parity, placeholders, referenced keys |
| `references.test.js` | reference and credit records |
| `seo.test.js` | title, description, canonical, JSON-LD |
| `session-state.test.js` | session clone, validation, picked markers |
| `url-state.test.js` | versioned URL settings round-trip |

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
7. Aseprite: load `.gpl`, the indexed PNG, and the strip; verify colors.
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
| Fully transparent image | Palette empty; export blocked with a visible warning and next action |
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

> **v1.0.0 scope:** native palette JSON, palette strip, indexed PNG, reduced RGBA PNG,
> `.hex`, and `.gpl`. The `.pal`/`.css`/`.tokens.json`/`.ase` exports, QA report, and
> manifest below are post-1.0 reference and are not release-blocking.

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
      "alpha": 255, "name": "background" }
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
| Order | As exported (source/hue/lightness/perceptual/custom) |
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
| `.pal` | JASC: `JASC-PAL`, `0100`, count, then `R G B` *(post-1.0)* |
| `.css` | `:root { --peiq-color-1: #rrggbb; ... }` *(post-1.0)* |
| `.tokens.json` | DTCG `color` object *(post-1.0)* |
| `.ase` | Adobe Swatch Exchange *(post-1.0)* |
| Manifest | §12.6 *(post-1.0)* |
| QA JSON | §12.5 *(post-1.0)* |

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

> **v1.0.0 scope:** files for QA metrics, palette editing, presets, extra palette
> formats, manifest, deep links, and URL state are post-1.0 reference. The lean feature
> matrix in §2 and milestones in §15 are authoritative; do not create those files for the
> 1.0 release.

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
| `js/main.js` | Bootstrap, worker wiring, preview/render, control and mode wiring |
| `js/theme-init.js` | Classic `<head>` script: resolve `peiq.theme`, `peiq.rail`, and `peiq.locale` before paint, set theme, rail, and language attributes |
| `js/ui/dom.js` | `el()`, `$`, `$$`, `debounce()`, `copyText()`; no framework |
| `js/ui/theme.js` | 3-state toggle, matchMedia listener, persistence, meta theme-color |
| `js/ui/rail.js` | Settings-rail collapse toggle, persistence, announcement, locale refresh |
| `js/ui/i18n.js` | Locale resolution, static `data-i18n` application, change events, error/detail localization |
| `js/ui/dropzone.js` | File picker/drag/paste; decode + downscale preview |
| `js/ui/controls.js` | Extract/Map/Dither/Order controls; presets |
| `js/ui/canvas-view.js` | Render, zoom/pan, divider, original/error/swap views |
| `js/ui/palette-view.js` | Swatches, reorder, lock, add/remove, copy hex, import |
| `js/ui/palette-editor.js` | Strip and editor controls, selection, undo/redo history, transparent index, status |
| `js/ui/palette-preview.js` | Full-screen palette strip, gray presets and custom background, focus return, `peiq.previewBg` persistence |
| `js/ui/picked-markers.js` | Picked-color overlay, drag/cancel, overlap offsets, keyboard nudge focus |
| `js/ui/palette-picker.js` | Pick mode, loupe, preview tooltip, marker drag, canvas pointer routing |
| `js/ui/export-view.js` | Validated Save/Copy rows, object URLs, image and text clipboard helpers |
| `js/ui/export-controller.js` | Export request ids, progress, worker jobs, palette-file validation, stale-result handling |
| `js/ui/quality-panel.js` | QA request lifecycle, stats, error map, worst pixels, locale refresh |
| `js/ui/session-url.js` | URL hash settings, IndexedDB session record, restore, clear, session status |
| `js/ui/status.js` | Progress, timings, warnings, toasts |
| `js/ui/tooltips.js` | `?` control hints; fixed bubble, hover/focus/touch, Esc/outside close |
| `js/ui/learn-view.js` | Contextual popovers, Help drawer, Guide/Shortcuts tabs, references |
| `js/ui/shortcuts.js` | Keyboard map; opens the Help drawer’s Shortcuts tab |

### Content

| Path | Responsibility |
|---|---|
| `js/content/references.js` | Canonical references `{id, title, authors, year, venue, url}`, plus credits; `url` is `null` for print-only papers |
| `js/content/messages.js` | Combines the two locale tables and exports `MESSAGES` |
| `js/content/messages.en.js` | English flat UI catalog |
| `js/content/messages.ru.js` | Russian flat UI catalog; the key set mirrors English |

### Worker

| Path | Responsibility |
|---|---|
| `js/workers/pipeline.worker.js` | Message loop, cancellation, progress, stage orchestration, transferables |

### Core

| Path | Responsibility / API | Tests |
|---|---|---|
| `js/core/types.js` | JSDoc typedefs only | — |
| `js/core/version.js` | `APP_VERSION`, `ALGORITHM_VERSION` | sync check |
| `js/core/color.js` | Color math, ΔE, hex, contrast | `color.test.js` |
| `js/core/rng.js` | `createRng(seed)`, `splitmix64`, `nextFloat` | `rng.test.js` |
| `js/core/hash.js` | `sha256Hex`, `fnv1a64Hex`, `stableStringify` | `hash.test.js` |
| `js/core/i18n.js` | Locale detection, interpolation, plural selection, number formatting; no DOM | `i18n.test.js` |
| `js/core/theme-mode.js` | `normalizeThemeMode`, `nextThemeMode`, `resolveTheme`; no DOM | `theme.test.js` |
| `js/core/rail-state.js` | `normalizeRailState`, `nextRailState`; no DOM | `rail-state.test.js` |
| `js/core/histogram.js` | `buildHistogram(pixels, opts)` | `histogram.test.js` |
| `js/core/quantize/index.js` | `extractPalette(hist, params)`, dispatch, refinement | `quantize.test.js`, `quantize-advanced.test.js` |
| `js/core/quantize/popularity.js` | `extractPopularity` | `quantize.test.js` |
| `js/core/quantize/median-cut.js` | `extractMedianCut` | `quantize.test.js` |
| `js/core/quantize/wu.js` | `extractWu` | `quantize-advanced.test.js` |
| `js/core/quantize/octree.js` | `extractOctree` | `quantize-advanced.test.js` |
| `js/core/quantize/kmeans.js` | `extractKMeans` | `quantize-advanced.test.js` |
| `js/core/quantize/refine.js` | `refinePalette` (Lloyd refinement) | `quantize-advanced.test.js` |
| `js/core/palette.js` | `createPalette`, `addPaletteEntry`, `updatePaletteEntry`, `removePaletteEntry`, `movePaletteEntry`, `setPaletteLock`, `sortPalette`, `paletteHexList`, `paletteHash` | `palette.test.js` |
| `js/core/preview-bg.js` | `normalizePreviewBackground`, `DEFAULT_PREVIEW_BACKGROUND`, gray presets; no DOM | `preview-bg.test.js` |
| `js/core/palette-order.js` | Deterministic CIEDE2000 perceptual orders (`perceptual`, `perceptual-path`, `perceptual-flow`) | `palette-order.test.js` |
| `js/core/picked-markers.js` | Picked-color marker map serialization, validation, and cloning | `picked-markers.test.js` |
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
| `js/core/metrics/index.js` | `computeQuality`: per-pixel ΔE00 stats, p95, top 20, error map | `metrics.test.js` |
| `js/ui/session-store.js` | IndexedDB read/write/clear for the last image + session state | — |
| `js/core/session-state.js` | Palette/history/marker cloning and saved-record validation | `session-state.test.js` |
| `js/core/url-state.js` | Versioned hash encode/decode for settings; no image data | `url-state.test.js` |
| `js/core/view-offsets.js` | Center-preserving offsets when the canvas frame resizes without a refit | `view-offsets.test.js` |
| `js/core/pipeline.js` | `runPipeline(job)` stage composition | `pipeline.test.js`, `determinism.test.js` |
| `js/core/log.js` | Optional debug logger; disabled in production | — |

### Assets and tools

| Path | Responsibility |
|---|---|
| `assets/blue-noise-64.bin` | 64×64 blue-noise mask (checksum in `assets/PROVENANCE.md`) |
| `assets/fonts/InterVariable-latin.woff2` | Self-hosted Inter variable Latin subset (~48 KB) |
| `assets/fonts/OFL.txt` | Inter SIL Open Font License |
| `assets/favicon.svg` | Local orange-on-charcoal PEIQ mark |
| `assets/og-image.png` | 1200×630 social preview card |
| `assets/screenshots/*.png` | README captures refreshed with the UI |
| `assets/PROVENANCE.md` | Screenshot, social card, font, and blue-noise provenance |
| `tools/dev-server.mjs` | Zero-dep static server |
| `tools/gen-blue-noise.mjs` | Void-and-cluster generator; deterministic seed |
| `tools/spec.mjs` | Print one plan/DESIGN/research section without loading the whole document |
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

### M3 — v1.0 closure (complete)

- [x] Core extraction, fixed palettes, mapping, dithering
- [x] Indexed PNG, palette strip, reduced PNG, HEX copy
- [x] Export validation, progress bar, single-export lock
- [x] Tooltips, references, credits, version footer
- [x] Remove the QA placeholder from the rail
- [x] Palette-file exports: `.hex`, `.gpl`, `.json`
- [x] Responsive, accessibility, browser, and performance pass against §9–§10
- [x] README, screenshots, and help copy aligned with the lean scope
- [x] GitHub Pages smoke test
- **Exit:** lean feature matrix complete; all exports green; `0.4.0`.

### M4 — Release (complete)

- [x] Release checklist §17
- [x] Both themes, mobile 360 px, keyboard-only pass
- [x] Version `1.0.0` in `package.json` and `APP_VERSION`
- [x] Annotated tag `v1.0.0`
- **Exit:** v1.0.0 tagged; Pages deploys from the same commit on push.

### M5 — v1.1: editing and quality (complete)

- [x] Minimal palette editor: remove, edit HEX, add, and keep a stable manual order.
      No semantic roles in this release.
- [x] Locks: locked entries survive sorting/removal and keep their palette identity;
      removal renumbers deterministically.
- [x] ΔE00 summary (mean/p95/max), error map, and worst-pixel list. No contrast matrix.
- [x] URL state: serialize normalized parameters in the hash, restore on reload, never
      put image data in the URL.
- **Exit:** `1.1.0` tagged; editor, locks, QA summary, and URL restore tested.

### M6 — v1.2: session continuity (complete)

- [x] Store the last image as a Blob in IndexedDB and reopen the editor on load.
- [x] Persist settings, palette colors/order/locks, selection, edit mode, and undo/redo
      history.
- [x] URL settings take precedence when the hash differs from the saved session.
- [x] Provide **Forget saved session** (now the footer; see §8.10) and fall back to the
      hero on empty, invalid, or unavailable storage.
- **Exit:** `1.2.0` tagged; reload restores the image, palette, locks, and undo history.

### M6.1 — v1.3: mobile editing and load resilience (complete)

- [x] Add compact touch undo/redo icon buttons to the palette editor and keep the HEX
      field in sync after a history step.
- [x] Add press-drag-release eyedropper picking with a magnified loupe; a mouse click
      still applies on release at the same point.
- [x] Let the newest image load win over a saved-session restore, including a drop while
      IndexedDB is still being read.
- [x] Decode the full-resolution source only for export and release it to the worker;
      the preview stays downscaled and the 16.7 MP cap remains.
- **Exit:** `1.3.0` tagged; touch history, loupe picking, stale-restore protection, and
  full-resolution export after reload verified.

### M6.2 — v1.3.1: reliable saved-image bytes (complete)

- [x] Store the session image as `ArrayBuffer` bytes instead of a `File` or `Blob`;
      mobile browsers may not preserve a picked file's backing data across a reload.
- [x] Read version 1 Blob records once and upgrade them to byte records on the next save.
- [x] Reject empty or incomplete saved bytes and fall back to the hero with a clear
      restore message instead of a decode loop.
- [x] Try an `<img>` decode before reporting `imageDecode` when `createImageBitmap` cannot
      open a restored blob.
- **Exit:** `1.3.1` tagged; repeated reloads restore the image, legacy records migrate,
  and a corrupt record falls back without blocking the next load.

### M6.3 — v1.4.0: perceptual palette ordering (complete)

- [x] Add `perceptual`: start from `lightness-asc`, then CIEDE2000 2-opt with fixed
      first/last entries.
- [x] Add `perceptual-path`: nearest-neighbor path from the darkest to the lightest
      entry, then 2-opt with fixed ends; try both directions.
- [x] Add `perceptual-flow`: all-start cycle, 2-opt, cut the largest CIEDE2000 edge, and
      orient dark-to-light; DCCW single-palette sorting with 2-opt instead of LKH.
- [x] Keep locks, URL/session round-trip, IDs, and export indices deterministic; add
      Help copy and EN/RU labels without exposing metric names in the control.
- [x] Keep Pick armed after a successful sample so several swatches can be recolored
      without pressing the button again.
- **Exit:** `1.4.0` tagged; `npm test` 156 passing and the browser pass at 1280/360 px
  are green.

### M6.4 — picked-color anchors (complete)

- [x] Create a marker only after an explicit eyedropper sample; extracted and imported
      colors have no marker.
- [x] Drag a marker to recolor its entry with the loupe; commit one undo step per drag,
      cancel with `Esc`, and keep pan/pinch working off the marker.
- [x] Show all picked markers in Edit mode, select by click, and remove a marker when its
      entry is removed or becomes the transparent index.
- [x] Persist normalized marker positions in session and history, handle nearby-marker
      overlap, and make the selected marker focusable with arrow-key nudging.
- [x] Keep marker positions out of palette JSON, hashes, and export.
- **Exit:** `1.4.0` tagged; `npm test` 156 passing and the browser pass at 1280/360 px
  are green.

### M6.5 — compact desktop frame and validated clipboard copy (complete)

- [x] Reduce the desktop header to 52 px, the stage toolbar to 28 px, and the status line
      to 24 px without shrinking touch targets below 600 px.
- [x] Tighten desktop workspace gaps and padding so the canvas keeps the reclaimed height.
- [x] Move the palette-editor hint into the free left export column, bottom-aligned with
      the palette, so changing hints and languages never resizes the canvas.
- [x] Add Save and Copy to every validated result row; PNG results are copied as images
      and palette files as text, with a clear fallback to Save when clipboard writes fail.
- [x] Clear the palette selection by clicking empty strip space or pressing Esc while the
      palette has focus, so Pick can fill the HEX field for Add.
- [x] Add helper tests for image clipboard support and PNG blob creation.
- **Exit:** `1.4.0` tagged; `npm test` 156 passing and the browser pass at 1280/360 px
  are green.

### M6.6 — v1.5.0: post-release UI polish (complete)

- [x] Align the Help drawer header with the page header and widen the desktop drawer.
- [x] Make the hero background full-bleed and refresh the README screenshots from the
      current UI.
- [x] Stabilize the palette editor reveal, add the collapsible settings rail, and keep
      palette and settings changes on one undo timeline.
- [x] Default the transparent index to None in Map, preserve a restored imported palette's
      name and colors, and keep the image centered when the frame resizes.
- [x] Explain palette mapping in the Map hint and Help; compact the HEX field and use icon
      Add, Remove, and Lock buttons.
- **Exit:** `1.5.0` tagged; `npm test` 166 passing and the browser pass at 1280/360 px
  are green.

### M7 — Later / not planned for v1.x

Palette roles, contrast matrix, presets, palette swap, manifest/QA JSON, `.pal`/`.css`/
`.ase`/DTCG exports, batch/ZIP, CLI/WASM, animation, NES banks, Yliluoma, exact mapping
for photos, SSIM/APCA, palette cycling, min-churn, print/CMYK, neural quantization,
accounts/cloud.

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

- [x] Zero `dependencies`/`devDependencies`; `npm ls` empty.
- [x] No build step; page works from a plain static server.
- [x] `node --test` green on Node 22 (91 tests).
- [x] Core tests cover every algorithm, format, and contract.
- [x] Manual browser matrix §10.6 completed in Chrome 157 and Edge 157. Firefox and Safari
      were not available in this environment (documented limitation).
- [x] DevTools shows zero network requests after load.
- [x] Strip round-trip and indexed round-trip validated on the release corpus.
- [x] Palette `.hex`, `.gpl`, and `.json` exports round-trip.
- [x] Imported indexed PNG and strips decode in an independent GDI+ decoder; palette,
      strip order, and every indexed pixel match. Aseprite and Godot were unavailable in
      this environment (documented limitation).
- [x] Mobile 360 px and keyboard-only pass.
- [x] Both themes: auto follows OS, toggle cycles, persists, no FOUC; `theme.test.js` parity green.
- [x] Header shows only brand + language/theme toggles + Help; no extra buttons.
- [x] Export progress appears and concurrent export clicks are ignored.
- [x] README complete; screenshots current.
- [x] `APP_VERSION` and `package.json` = `1.0.0`.
- [x] `LICENSE` = GPL-3.0; README states it.
- [x] Pages workflow verified; the live 0.4.0 deployment was smoke-tested at the project
      URL. The 1.0.0 deployment starts when this release commit is pushed.
- [x] Annotated tag `v1.0.0` on the version-bump commit.

### v1.4.0

- [x] `npm test` 156 passing.
- [x] Browser pass at 1280 px and 360 px: preview stability, palette edits, pick and
      markers, all four exports, session restore and clear, keyboard.
- [x] URL `v=1`, session record v2 with optional markers, palette JSON v1, export
      filenames, and `ALGORITHM_VERSION` stay compatible; 1.3.1 URLs and sessions load.
- [x] `APP_VERSION` and `package.json` = `1.4.0`.
- [x] Annotated tag `v1.4.0` on the version-bump commit.

### v1.5.0

- [x] `npm test` 166 passing.
- [x] Browser pass at 1280 px and 360 px: Help header, settings rail and canvas centering,
      Map defaults and mapping copy, imported session restore, palette editor icons, both
      themes, keyboard.
- [x] URL `v=1`, session record v2, palette JSON v1, export filenames, and
      `ALGORITHM_VERSION` stay compatible; 1.4.0 URLs and sessions load.
- [x] `APP_VERSION` and `package.json` = `1.5.0`.
- [x] Annotated tag `v1.5.0` on the version-bump commit.

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
| 2026-11-13 | Move Export to a stage panel; fix the desktop page frame; compact footer with repository link | Export is the primary output action, not a setting; only the rail should scroll; owner asked for a repo link |
| 2026-11-13 | Add `?` tooltips for non-obvious controls, including serpentine scan and edge stop | Plain-language explanations without permanently growing the rail; 13 hints cover the algorithm settings |
| 2026-11-13 | Make export a third desktop column, left of the stage; export above canvas on mobile | Export is a primary action, but the palette needs vertical room; the narrow export column and 360 px rail give the canvas more width than the previous in-stage layout |
| 2026-11-13 | Align palette with canvas; export column spans canvas+palette rows | Owner wants the palette and canvas to share a left edge, with export as a distinct column to their left |
| 2026-11-13 | Release 0.3.1 with the version shown in the footer | Makes the running build identifiable; the tag marks this UI batch |
| 2026-11-13 | Add an indeterminate export progress bar and a single-export busy lock | Users should not mistake a slow export for a frozen page; concurrent export clicks must not race |
| 2026-11-13 | Release 0.3.2 with export progress and the busy lock | Tagged patch release for the export UX fix |
| 2026-11-14 | v1.0.0 scope reset: single-image extraction + fixed-palette mapping + validated indexed/strip handoff; park editor, QA, presets, manifests, extra formats, batch, CLI | Landscape refresh shows extraction, dithering, formats, and batch are commodity; the remaining wedge is the validated handoff, and the full compiler scope was overkill |
| 2026-11-14 | Reduced RGBA export preserves source alpha; transparent index applies only to indexed/strip output; tooltips corrected | Matches the existing alpha contract and removes a misleading hint about RGBA alpha |
| 2026-11-14 | Add zoom buttons and pinch-to-zoom on canvas | Mobile users could only Fit/100%; two-finger zoom is expected on touch |
| 2026-11-14 | Release 0.3.3 for the mobile zoom/toolbar, alpha, tooltip, background, and Help fixes | Patch release for the post-0.3.2 batch; tag the version-bump commit |
| 2026-11-14 | Plan v1.1: minimal palette editor + locks, ΔE00 summary/error map, URL state | Owner selected the few post-1.0 features with direct workflow value; roles, presets, swap, and manifest remain later |
| 2026-11-14 | Add `.hex`, `.gpl`, and `.json` palette-file exports with parse-back validation | Completes the v1.0 palette handoff without adding the deferred format set |
| 2026-11-14 | Release 0.4.0: M3 complete, palette exports, accessibility/Pages/performance pass | Closes the lean v1.0 feature scope before the 1.0.0 release checklist |
| 2026-11-14 | Fully transparent images: empty palette, export blocked with an explicit warning | An indexed PNG needs at least one `PLTE` entry; this resolves the contradiction between the empty-palette rule and the former “export allowed” wording |
| 2026-11-14 | Release 1.0.0: M4 complete | Chrome 157, Edge 157, independent GDI+ PNG decode, themes, 360 px, keyboard, and 91 tests verified; Firefox/Safari and Aseprite/Godot were unavailable |
| 2026-11-14 | Default extractor is Wu with K=16 | Balanced quality across photos and pixel art; every other method stays selectable |
| 2026-11-14 | Locks pin entries to their current slot; locked colors cannot be removed; HEX edits keep the lock | Minimal v1.1 rule that preserves palette identity and deterministic indices without drag reordering |
| 2026-11-14 | Canvas eyedropper samples the visible preview and shows a floating color/HEX chip | Works in every supported browser without a platform API; sampling the reduced side lets users pull mapped colors back into the palette |
| 2026-11-14 | Manual palette order uses ← / → buttons instead of drag-and-drop | Keyboard, touch, and screen-reader friendly; locked slots and neighbors block moves deterministically |
| 2026-11-14 | Preview renders the transparent index as transparent for nearest-color mapping; Map mode can also select None | Matches the tRNS export; the reduced side clears the original beneath it so the checkerboard shows through |
| 2026-11-14 | Palette editor keeps a 50-step undo/redo history | Covers colors, order, locks, selection, sort, and transparent index; Ctrl/Cmd+Z stays native inside text fields |
| 2026-11-14 | QA measures the preview per pixel with CIEDE2000; p95 uses 0.1 buckets, worst list is top 20, error map clamps at 20 ΔE00 | Keeps measurement responsive and aligned with the preview; contrast and full QA reports stay out of v1.1 |
| 2026-11-14 | URL state stores normalized v1 settings in the hash; defaults omitted; imported palettes, edits, and QA results excluded | Shareable and reproducible without image data or a backend |
| 2026-11-14 | Release 1.1.0: M5 complete | Palette editor, locks, manual order, eyedropper, quality report, and URL state tested; 116 tests |
| 2026-11-14 | Add IndexedDB session persistence with image, settings, palette, locks, selection, and undo/redo history | Last-image continuity without counting against the small localStorage quota; URL hash stays the portable config and takes precedence when different |
| 2026-11-14 | Release 1.2.0: M6 complete | Session restore, URL precedence, forget action, and 119 tests verified |
| 2026-11-14 | Fix the extractor select mapping so Median cut reaches the median-cut implementation | The UI mapper omitted the median-cut case and silently ran Wu for that choice; `test/controls.test.js` locks the mapping |
| 2026-11-14 | Refresh tooltips and Help for v1.2 and the current shortcuts | The drawer still described QA and URL state as upcoming; hints now cover octree, alpha preview behavior, dither scaling, error-map clamping, and `Ctrl/Cmd+Y`, and the text is shorter |
| 2026-11-14 | Add complete English/Russian site localization with automatic detection and a header toggle | The site follows the browser language by default and switches in place; catalogs stay separate from English repository documentation, and Russian plural forms use `Intl.PluralRules` |
| 2026-11-14 | Remove emoji from repository documentation and add a no-emoji rule | Plain-text documentation is easier to scan and diff; emoji are allowed only when explicitly requested |
| 2026-11-15 | Add canonical, Open Graph, Twitter Card, JSON-LD WebApplication, keyword-aware title/description, and a 1200×630 social preview | Improves search snippets and link previews without changing the app; sitemap `lastmod` refreshed and metadata covered by `seo.test.js` |
| 2026-11-15 | Add compact undo/redo icon buttons to the palette editor on touch layouts | The keyboard-only history left phones without a way back; the icons appear below 980 px and reuse the existing 50-step history |
| 2026-11-15 | Pick colors with a magnified loupe and commit on pointer release | A finger covers the sampled pixel and touch screens have no hover; dragging updates the loupe and the release point is the applied color |
| 2026-11-15 | Abandon a saved-session restore when a newer image load starts | A reload followed by an immediate drop could let the restore overwrite the new image or report its own decode error; the newest load now owns the UI |
| 2026-11-15 | Decode the full-resolution source only at export | Keeping a 16 MP RGBA copy for the session costs 64 MiB and contributes to mobile memory pressure; the preview stays downscaled and export re-decodes the original |
| 2026-11-15 | Release 1.3.0: M6.1 complete | Touch undo/redo, loupe picking, newest-load session guard, and lazy full-resolution export verified; 134 tests |
| 2026-11-15 | Store saved session images as ArrayBuffer bytes instead of File/Blob objects | Mobile browsers can lose a picked file's backing data across reload even when IndexedDB returns a Blob; explicit bytes survive, and version 1 records migrate on the next save |
| 2026-11-15 | Lead the search title with keywords and end it with PEIQ | Google truncated the long unbroken repository name and dropped the descriptive suffix; the full name stays in JSON-LD and the header |
| 2026-11-15 | Retry image decode through an `<img>` element before reporting imageDecode | Some mobile browsers fail `createImageBitmap` on a restored blob but decode the same bytes through the image element |
| 2026-11-15 | Release 1.3.1: M6.2 complete | Saved-image byte storage, v1 migration, and the decode fallback verified with repeated reloads and a corrupt record; 135 tests |
| 2026-11-16 | Allow CIEDE2000 for palette ordering; keep Oklab for extraction, mapping, and dithering | These stages optimize different things: clustering needs a vector space with centroids and fast per-pixel distances, while ordering a fixed 1–256 color palette is a one-off pairwise comparison. Splitting the metric removes the apparent conflict without changing nearest-color assignment. |
| 2026-11-16 | Add perceptual, perceptual-path, and perceptual-flow palette orders | Perceptual starts from the lightness order and refines it with 2-opt; path fixes the darkest and lightest ends; flow uses the DCCW cycle-cut idea. All three use deterministic CIEDE2000 2-opt, preserve locks, and only change order and export indices. |
| 2026-11-16 | Keep Pick armed after a successful sample | Re-arming the eyedropper for every swatch was unnecessary friction; the button and Esc still stop the mode. |
| 2026-11-16 | Add picked-color anchors only for explicitly sampled colors | Extracted and imported colors have no source point; user-created anchors avoid 256 handles and arbitrary positions while keeping direct manipulation where a point actually exists. Markers stay UI/session state and never enter palette JSON or hashes. |
| 2026-11-16 | Compact the desktop frame: 52 px header, 28 px toolbar, 24 px status line, and 8 px workspace gaps | The canvas is the working surface; desktop chrome was spending 127 px of height on header, toolbar, padding, and gaps. Touch layouts keep their 44 px targets, and the reclaimed height all goes to the canvas. |
| 2026-11-16 | Move the palette-editor hint into the left export column | Hint text changes with Pick and with the language, and inside the palette card it resized the canvas. Bottom-aligning the hint in the free left column keeps the instruction visible without any layout shift. |
| 2026-11-16 | Add Save and Copy to every validated export result | Copying belongs after validation and should work for any export, not only the indexed PNG: PNG results become image clipboard items and palette files become text. Placing Copy beside Save keeps the two post-validation handoffs together instead of creating a second pre-validation export path. |
| 2026-11-16 | Clear the palette selection on empty-strip click or palette-scoped Esc | With an entry always selected, the eyedropper could only recolor an existing color; clearing the selection lets Pick fill HEX for Add. Scoping Esc to the palette avoids clearing the editor while closing Help or a tooltip. |
| 2026-11-16 | Keep the previous status line and export controls while a preview runs; place the status line under the palette | Replacing the image stats with a processing message and disabling every export button on each preview made both areas blink during slider edits. The last validated stats and controls now stay in place, and a click during the short preview window reports processing rather than exporting a stale palette. The desktop grid gives the status line the stage column, matching the layout and keeping it under the palette instead of stretching from the left edge. |
| 2026-11-16 | Report 0 ms extraction when a palette is overridden, restored, or comes from Map mode | The stage did not run: palette edits pass a fixed color list to the worker, Map mode starts from a chosen palette, and a restored session brings its own. Keeping the last real extraction time would go stale after a settings change and would still be 0 after restore, so 0 is the honest value. |
| 2026-11-16 | Release 1.4.0: M6.3–M6.5 complete | Perceptual ordering, picked-color anchors, the compact desktop frame, validated Copy, palette-selection clearing, and preview/status stability ship as one minor release. URL v1, session v2, palette JSON v1, filenames, and `ALGORITHM_VERSION` stay compatible, so no major bump is warranted; 156 tests |
| 2026-11-16 | Widen the desktop Help drawer to 680 px and set its body at 1rem/1.6 | The 360 px drawer wrapped long explanations into narrow columns and forced heavy scrolling; a wider sheet with larger text reads as prose while staying an overlay that does not relayout the canvas. Bold section takeaways and the three order names keep the key facts scannable. |
| 2026-11-16 | Make the empty-state hero background full-bleed and name the indexed PNG in its subtitle | Inside the 1600 px shell the blue radial was clipped at the shell edge, leaving a visible vertical seam on wide monitors; extending the hero to the viewport with `calc(50% - 50vw)` margins keeps the content in the shell and lets the glow fade naturally. The old subtitle offered only a strip or reduced PNG, omitting the indexed PNG and palette file that the tool is built around. |
| 2026-11-16 | Put palette and settings changes on one undo timeline and move the undo/redo buttons into the palette bar | Settings changes used to clear the palette history and exit Edit, so an accidental dither or extractor change was unrecoverable. Snapshots now carry the settings and `paletteEdited` flag; each settings gesture commits one step, undo restores settings and palette together, and the extractor path starts a fresh extraction. The bar is always visible, so desktop users no longer depend on a hidden touch-only control. |
| 2026-11-16 | Show Pick as an icon button with a pressed state and use a single ring for the selected swatch | The text button competed with Apply/Add for width and gave no visual confirmation beyond the hint. An eyedropper icon with an accent background and inset ring when armed matches the toolbar, and the 2 px gap plus accent ring read as a double border on every selected swatch, so the gap was removed. |
| 2026-11-16 | Reveal the palette editor with a height transition and redraw the canvas before paint on resize | The editor row appeared in one layout step, and the resize observer redrew on the next animation frame, so a frame painted the old bitmap stretched into the new box. The slot now animates `0fr` to `1fr`, the canvas redraws synchronously inside the observer, and Edit keeps one label so the bar cannot rewrap: opening or closing the editor is a smooth refit instead of a blink. |
| 2026-11-16 | Add a header toggle that collapses the settings rail | On a wide screen the rail is 360 px of permanent width; users who work mostly in the canvas should be able to reclaim it. The choice persists in `peiq.rail`, `theme-init.js` applies it before paint, and the stage takes the freed column without a flash. |
| 2026-11-16 | Keep the Edit label and report Map mode without an extraction timing | Swapping Edit for Done changed the button width, rewrapped the palette bar, and resized the canvas together with the editor; a pressed state reports the mode without moving anything. Map never extracts, so the status line no longer shows a 0 ms extraction item there, and the Map section states that extractor settings apply in Extract mode. |
| 2026-11-16 | Match the Help drawer header to the page header | The drawer bar was 65 px tall against the page's 52 px, with a 20 px/600 title, so the two bottom borders stepped and the overlay looked like a separate app. It now uses `--peiq-header-height`, the same 24 px inline padding, the brand's 18 px/800 title scale, and an 18 px close icon; the borders line up at 52 px (48 px on touch). |
| 2026-11-16 | Default the transparent index to None in Map mode | Forcing index 0 made every pixel that mapped to the palette's first color disappear, so mapping looked broken and the screenshot showed holes. Both modes now start at None; choosing an index still removes that entry from the preview and indexed/strip output. |
| 2026-11-16 | Preserve a restored palette's own name and target through reloads | Session saves used the startup fixed-palette name, so a restored import was renamed PICO-8 on the next reload and its colors were unavailable when switching back to Imported. The record now keeps the name the UI shows and restores the imported colors; Map also loads the palette named by the select, including a URL hash. |
| 2026-11-16 | Keep the image centered when the frame resizes without a refit | After zoom or pan, collapsing or opening the rail and the palette editor changed the frame width and height while the offsets stayed put, pushing the image off-center. The resize observer now shifts the offsets by half the size delta; fit mode still refits normally. |
| 2026-11-16 | Explain mapping in the Map section and Help | "Map uses this palette as-is" described the palette, not the operation. The hint and a new Help section now state that every pixel becomes the nearest target color, which preview half is the result, and when transparency appears. |
| 2026-11-16 | Clear the palette selection from the whole card and compact the editor | The old rule only cleared from the thin strip, so most empty space did nothing. Any empty part of the palette card now clears the selection while controls and swatches keep their action. The HEX field is fixed at 7.5 rem so it no longer pushes the controls right, and Add, Remove, and Lock became icon buttons; Lock shows an open or closed padlock and its action label names the next step. |
| 2026-11-16 | Release 1.5.0: M6.6 complete | The post-release polish ships as one minor release: Help header and wide drawer, full-bleed hero, current README captures, collapsible settings rail, Map transparency default and mapping explanation, restored palette identity, centered resize, and the compact icon editor. URL v1, session v2, palette JSON v1, filenames, and `ALGORITHM_VERSION` stay compatible; 166 tests |
| 2026-11-16 | Group hue sorting into bands before lightness (first pass) | `hue-asc`/`hue-desc` sorted by continuous hue, so lightness only broke exact hue ties and real palettes read as a rainbow instead of a ramp per family. Chromatic colors now split into circular bands at 15° gaps, a palette covering under 30° stays one band, a continuous sweep uses its largest gaps, and each band sorts by Oklab L; both modes share the bands and differ only in ramp direction. Existing hue URLs still load but their order and palette hash change, so `ALGORITHM_VERSION` becomes 3; 168 tests |
| 2026-11-16 | Bound hue bands and add hue-perceptual modes | The first-pass gap rule still left a continuous blue-purple region as one huge band, so L order interleaved hue and lightness. Hue bands now split at the most balanced internal gap until every band is at most 30°, and `hue-perceptual-asc` / `hue-perceptual-desc` refine each band with deterministic CIEDE2000 2-opt seeded by L. Per-band L ramps still left an 84 Delta E jump on the extracted 72-color StoneBlock palette, so the perceptual modes also choose each band's direction to minimize the join; the plain hue modes remain strict L ramps. Old hue URLs still load; their order and palette hash change again before release, so `ALGORITHM_VERSION` stays 3 because the banded hue change is unreleased; 172 tests |
| 2026-11-16 | Show sort families with a direction button | Eleven select rows made the order list slow to scan, and six of them differed only by direction. The select now has eight rows: source, manual, hue grouped, hue perceptual, lightness, perceptual smooth, perceptual color path, and perceptual flow. One direction button maps the three directional families to their `-asc`/`-desc` keys and is disabled for fixed-direction orders. Stored keys, URLs, sessions, and export order keep the full key, so old links and saved sessions still load; 173 tests |
| 2026-11-16 | Add a full-screen palette preview | Judging a palette against a page or sprite at real size needs a clean, full-width strip without the editor around it. A preview button in the palette bar opens the current order as one full-screen strip on a neutral gray background, with each color block inset in its slot so neighbors keep a gap of about 15% of the block width; two gray presets and a native color picker set the background, which is remembered under `peiq.previewBg`. The overlay is read-only, traps Tab, closes on Esc, the close button, or a backdrop click, and returns focus to its trigger. The user-chosen background is data, so it is the second permitted inline style after `--swatch`; it never enters the palette, hash, URL, or session. 176 tests |
| 2026-11-16 | Add an extraction guide and compact the rest of Help | The drawer explained mapping but never named the five extractors or their trade-offs, so the extraction half of the workflow was opaque. A dedicated section now covers colors, alpha weighting, working space, refinement, and each method in one line. Redundant prose was trimmed, and references and credits became closed disclosures so the guide stays scannable without losing attribution. |
| 2026-11-16 | Move Forget saved session from Help to the footer behind a confirmation dialog | The action sat near the bottom of a long drawer, so it was hard to find and easy to hit while reading. The footer is visible without scrolling on desktop and already carries the local-only claim; a text action there opens a native dialog with Cancel focused by default, and IndexedDB is cleared only after confirmation. The Help text now points to the footer. 178 tests |
| 2026-11-16 | Keep the source alpha in the dithered preview | The dithered branch rebuilt the preview from the index map alone, so with the default transparent index None every fully transparent pixel became opaque palette entry 0, which reads as a black hole, and semi-transparent pixels lost their coverage; the nearest-color preview did neither. Index maps carry no alpha, so the preview is now composed from the source buffer, `indicesToRgba` validates the map and accepts an alpha source, and export validation keeps the binary `tRNS` expectation. 183 tests |
| 2026-11-16 | Normalize the Wu grid and skip empty boxes in Oklab | The fixed Oklab grid covered the whole gamut at 32 steps per axis, so a single-hue or nearly gray image collapsed into a handful of cells: Wu stopped short of K and some images returned clipped empty-box means such as `#00ffff` or `#000200`. The grid now normalizes the occupied L, a, b ranges, and an occupancy prefix identifies empty boxes exactly, since non-binary alpha weights leave a rounding residual in the moment prefix. Narrow green fixtures now return 16 of 16 colors instead of 8 or 10 with extremes. 186 tests |
| 2026-11-16 | Answer error-diffusion decisions from a working-space cell cache | Every dithered pixel paid `rgb8ToOklab` (three cube roots), `oklabToRgb8` (three cubes plus gamma) and `Math.hypot`, so Floyd–Steinberg on a 16 MP file took 7.9 s and even a 1024² preview took 0.6 s, above the plan's own 100–300 ms budget. Source coordinates now come from a cached 6-bit table per space, the nearest palette entry comes from a lazily filled 128-step Oklab cell grid (sRGB keeps the mapper's 6-bit grid), and the clamp uses squared magnitude with one `sqrt`. A 16 MP Floyd–Steinberg pass drops to 1.4 s and a 1024² preview to 0.25 s; CIEDE2000 mean error stays within 0.05 of the previous output across K = 8, 24, 256 in both spaces, and the pass stays deterministic because a cell always resolves from its own center. `strength = 0` now returns the plain mapping directly. 188 tests |
| 2026-11-16 | Draw the original at full resolution and spend a 4 MP budget on the mapping preview | Both halves of the canvas drew a ≤1024 px copy, so 100% zoom showed a quarter of a 4096 px source and the dither on screen could not be compared with the export. The session now keeps the full-resolution decode and draws the original half from it; the mapping preview keeps the full image up to 4,194,304 pixels and scales larger images by area, preserving the aspect ratio, instead of stopping at a fixed long edge. Picking and the loupe read the full-resolution decode through a scratch canvas, so enlarging the preview does not cost sample accuracy, and the status line names the preview size whenever it differs from the source. Supersedes the 2026-11-15 decision to keep only a preview copy: one full-resolution bitmap is cheaper than a 64 MiB RGBA copy plus its canvas. 193 tests |

---

## 19. Post-1.0 backlog (explicitly out of v1.0.0)

Nothing in this table is release-blocking for `1.0.0`. Do not start these without a new
scope decision and a matching plan update.

| Item | Status after 1.0 | Why parked |
|---|---|---|
| Minimal palette editor: remove/edit/add + locks | Implemented in v1.1 | Expands the palette model and UI; roles stay out |
| ΔE00 summary, error map, worst pixels | Implemented in v1.1 | Reporting layer; strengthens the validated-handoff story; contrast stays out |
| URL state (params only) | Implemented in v1.1 | Cheap reproducibility/shareability; no image data |
| Palette roles | Candidate 1.2 | Design-token semantics are outside the game/art core |
| Presets (Photo, Pixel Art, Retro, Game Sprite, UI) | Candidate 1.2 | Convenience; users can set the same controls manually |
| Palette swap / recolor preview | Candidate 1.2 | Needs a second palette and index contract |
| Manifest + QA JSON | Candidate 1.2 | Only valuable with batch/CI, which is not v1.0 |
| `.pal`, `.css`, `.ase`, DTCG exports | Candidate 1.1 | `.hex`, `.gpl`, `.json` cover the common palette handoff |
| Help guide with 12+ topics, deep links | Candidate 1.1 | Tooltips + references already cover the controls; long-form content is a separate project |
| URL-hash state | Candidate 1.1 | Convenience; no image data in URL |
| Batch/ZIP, CLI, WASM, API | Not planned for v1.x | The landscape refresh shows batch/API is already served by free tools; conflicts with local-first simplicity |
| Animation frames, NES banks, palette cycling, min-churn | Not planned for v1.x | Needs a different data model and asset pipeline |
| Yliluoma, exact mapping for photos, SSIM/APCA | Not planned for v1.x | Existing dithering/LUT/validation is sufficient; measure demand first |
| Print/CMYK/spot | Not planned | Different color science and file contracts |
| Neural quantization | Not planned | Model licensing, determinism, palette compliance |
| Accounts/cloud | Never | Contradicts the local-first product |

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
