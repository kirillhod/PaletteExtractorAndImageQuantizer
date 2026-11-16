# PEIQ — product spec

Part of the [implementation plan](../../IMPLEMENTATION_PLAN.md). Section numbers are the
original single-file plan's and never renumber, so an existing reference such as
`plan §6.5` still resolves. `node tools/spec.mjs plan <section>` searches every spec
file. Normative keywords (**MUST**, **MUST NOT**, **SHOULD**, **SHOULD NOT**, **MAY**,
RFC 2119) are defined in the plan.

Sections: §1, §2, §3, §13, §19.

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
