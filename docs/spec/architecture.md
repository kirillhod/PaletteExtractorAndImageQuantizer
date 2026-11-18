# PEIQ — architecture spec

Part of the [implementation plan](../../IMPLEMENTATION_PLAN.md). Section numbers are the
original single-file plan's and never renumber, so an existing reference such as
`plan §6.5` still resolves. `node tools/spec.mjs plan <section>` searches every spec
file. Normative keywords (**MUST**, **MUST NOT**, **SHOULD**, **SHOULD NOT**, **MAY**,
RFC 2119) are defined in the plan.

Sections: §4, §9, §11, §14.

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
| Transparency + no transparent index | Indexed export reserves the lowest unused or least-used entry and reports index, color, and count |
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

## 14. File-by-file implementation checklist

> **Scope note.** Every row exists today except five reference rows that did not ship:
> `js/core/formats/ase.js`, `css.js`, `dtcg.js`, `manifest.js`, and `js/core/log.js`. They
> keep the intended shape of those features; creating one needs a scope decision in the
> plan and an entry in the decision log. The feature matrix in §2 and milestones in
> `docs/history/milestones.md` §15 are authoritative.

Legend: **S** = signatures/notes, **T** = required tests.

### Root

| Path | Responsibility |
|---|---|
| `index.html` | Semantic shell, panels, labels, no inline logic; loads `js/main.js` |
| `.nojekyll` | Disable Jekyll on Pages |
| `README.md` | User-facing usage, privacy, browser support, dev commands, license |
| `IMPLEMENTATION_PLAN.md` | Plan entry point: current state, file index, Definition of Done |
| `docs/spec/` | Normative plan by topic: product, architecture, algorithms, ui, contracts, appendix |
| `docs/history/` | Append-only decision log, closed milestones, release records |
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
| `js/ui/palette-preview.js` | Full-screen palette strip, layouts, caption color, background presets and color pickers, focus return, `peiq.previewBg` and `peiq.previewLayout` persistence |
| `js/ui/color-picker.js` | Swatch popover: saturation/value field, hue ramp, hex field, viewport clamp, `Esc` scoping |
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
| `js/core/preview-size.js` | `previewSize(width, height)`, `PREVIEW_FULL_PIXELS`: area-budgeted preview scaling; no DOM | `preview-size.test.js` |
| `js/core/picked-markers.js` | Picked-color marker map serialization, validation, and cloning | `picked-markers.test.js` |
| `js/core/map.js` | `buildMapper`, `buildExactMap`, `mapPixels`, `mapIndices`, `indicesToRgba` | `map.test.js` |
| `js/core/dither/index.js` | `ditherPixels(image, palette, dither)` | `dither.test.js` |
| `js/core/dither/kernels.js` | Error-diffusion tables + Bayer generation | `dither.test.js` |
| `js/core/dither/error-diffusion.js` | ED implementation | `dither.test.js` |
| `js/core/dither/ordered.js` | Two-candidate ordered dither | `dither.test.js` |
| `js/core/dither/blue-noise.js` | Mask loading/tiling | `dither.test.js` |
| `js/core/dither/blue-noise-mask.js` | Generated 64×64 mask (base64) | `dither.test.js` |
| `js/core/png/crc.js` | CRC32/Adler-32 | `png.test.js` |
| `js/core/png/chunks.js` | Chunk writer/parser, zlib (native compression with stored fallback) | `png.test.js` |
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
| `tools/spec.mjs` | Print one plan section or one spec file without loading the whole document; `plan` searches every part |
| `tools/cdp.mjs` | Minimal Chrome DevTools Protocol client for the manual browser check; dev tooling only |
| `tools/browser-check.mjs` | Zero-dep headless smoke suite: canvas, worker, themes, focus, stage overlay, export; run by `npm test` |
| `.github/workflows/ci.yml` | `npm test` (Node suite and browser smoke) on push/PR |
| `.github/workflows/pages.yml` | Stage the static site and deploy it to GitHub Pages on `main` |
