# PEIQ — contracts spec

Part of the [implementation plan](../../IMPLEMENTATION_PLAN.md). Section numbers are the
original single-file plan's and never renumber, so an existing reference such as
`plan §6.5` still resolves. `node tools/spec.mjs plan <section>` searches every spec
file. Normative keywords (**MUST**, **MUST NOT**, **SHOULD**, **SHOULD NOT**, **MAY**,
RFC 2119) are defined in the plan.

Sections: §10, §12.

---

## 10. Testing

> **v1.0.0 scope:** tests for QA metrics, palette editing, presets, `.ase`/CSS/DTCG
> exports, manifest, and deep links are post-1.0 reference. The release suite covers the
> lean feature matrix in §2.

### 10.1 Framework

- `node --test` is the only test framework. No test dependencies.
- Tests import `core/**` directly; no DOM.
- `npm test` runs the Node suite and then `tools/browser-check.mjs`, a zero-dependency
  smoke suite in headless Chrome or Edge: canvas painting, worker wiring, theme painting
  and persistence, keyboard focus order, the stage overlay, layout overflow at 1280 and
  360 px, and a compressed indexed export. Visual review, Firefox and Safari, touch, and
  the rest of 10.6 stay manual.
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
| `png.test.js` | encode/decode, filters 0–4, bit depths, tRNS, packing, round-trip, native compression and stored fallback |
| `formats.test.js` | .hex/.gpl/.pal/.json round-trips |
| `palettes.test.js` | built-in counts/values, import parsers |
| `metrics.test.js` | ΔE stats, p95, worst pixels, compliance |
| `pipeline.test.js` | stage composition, preview vs final params |
| `pipeline-m2.test.js` | indexed export, automatic transparent index, alpha compliance |
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
| `docs.test.js` | plan split integrity: every part exists, relative links resolve, section numbers unique |
| `tools/browser-check.mjs` | headless smoke: canvas, worker, themes, focus order, stage overlay, overflow, compressed export |

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

- **Encoder:** `CompressionStream('deflate')` where the platform provides it, written
  through a single zlib stream with a concurrent reader and writer. The stored-block
  writer (`0x78 0x01`, 65535-byte blocks, Adler-32) is built as the fallback, and the
  shorter of the two streams is used, so a tiny palette strip never grows. If the
  platform compressor is missing or fails, the stored stream keeps the export valid.
- **Decoder (M2): full DEFLATE** — stored, fixed-Huffman, and dynamic-Huffman blocks.
  This enables importing ordinary compressed palette-strip PNGs.
- Compression output is implementation-defined; byte equality is guaranteed only within
  the same browser/version. The decode-then-compare validation, not a byte hash, is the
  output contract.

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
