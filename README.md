# PaletteExtractorAndImageQuantizer

Extract a palette from an image, map an image to a fixed palette, dither the result, and
export validated indexed PNGs, palette strips, and palette files. Everything runs on your
device: no uploads, no accounts, no dependencies, no build step.

![PEIQ workspace with a hydrangea photo, a 24-color palette, and the open palette editor](assets/screenshots/workspace-dark.png)

*Extract up to 256 colors from a photo, compare the original with the result, edit
individual swatches, and export a validated indexed PNG.*

## What you can do

### Extract a palette

- Five extractors: **popularity**, **median cut**, **Wu** (default), **octree**, and
  **K-means++**.
- **2 to 256 colors**, set with a slider or typed as an exact number.
- **Oklab** working space for perceptual results or **sRGB** for legacy pipelines.
- Median cut and Wu run a Lloyd refinement pass after the initial split.
- Eight sort orders: source order, manual order, hue grouped, hue perceptual, lightness,
  perceptual smooth, perceptual color path, and perceptual flow. The direction button
  reverses hue grouped, hue perceptual, and lightness.
- Full-screen palette preview: one strip with a gap between colors, on a neutral gray
  background that can be switched or replaced with any color; the choice is remembered.
- Edit colors: change a HEX value, add or remove entries, lock entries so they keep their
  place when sorting, and move colors left or right in manual order. A move cannot cross a
  locked entry.
- Pick colors straight from the canvas; each sampled color gets a draggable anchor.
- Compare the original and the result with a draggable divider.
- Undo and redo cover palette and settings changes.

Reordering changes the exported index order. The preview and the reduced PNG keep the same
pixels because the color set is unchanged, apart from exact ties; adding, removing, or
editing a color changes the mapping.

### Map to a fixed palette

- Built-in palettes: **PICO-8**, **Game Boy DMG**, **Commodore 64**, **ZX Spectrum**, and
  **EGA**.
- Map mode replaces every pixel with the nearest color in the target palette and shows the
  result on the right half of the canvas. It does not run an extractor: method, color
  count, and working space apply in Extract mode only.
- Import `.hex`, `.gpl`, `.pal`, `.json`, or a PNG palette strip (`N×1` or `1×N`).
- Pick a transparent index for sprites. It starts at **None**, so every palette color stays
  visible; if the image has transparency, indexed export reserves the least-used entry
  automatically and names it in the result. Pixels mapped to the chosen index become
  transparent in the preview and in indexed and strip output.
- Set the alpha threshold and see the result immediately.

### Dither

- **Error diffusion:** Floyd–Steinberg, Atkinson, Stucki, Jarvis, Burkes, Sierra.
- **Ordered:** Bayer 2×2, 4×4, and 8×8.
- **Blue noise:** a generated 64×64 void-and-cluster mask.
- Adjust strength, serpentine scan, and edge stop; the last two apply to error diffusion
  only.

![Mapping the hydrangea photo to the Game Boy DMG palette with Floyd–Steinberg dithering](assets/screenshots/map-dither-dark.png)

*Map a photo to a four-color built-in palette and tune error diffusion until the result
looks right.*

### Check the result

- CIEDE2000 **mean**, **p95**, and **max** between the source and the mapped preview.
- A toggleable CIEDE2000 error map on the right half of the canvas, from near-zero (dark
  blue) to 20+ (red). It stays on across settings and palette changes and re-measures the
  new preview automatically.
- The 20 worst pixels with coordinates, located by numbered markers on the error map.
- Measurements use the preview; fully transparent pixels are skipped.

### Export

- **Indexed PNG** with `PLTE` and optional `tRNS`, at the smallest bit depth for the palette
  (1, 2, 4, or 8 bits).
- **Palette strip** as an exact `N×1` or `1×N` PNG.
- **Reduced RGBA PNG** for previews and sharing.
- **Palette files** in `.hex`, `.gpl`, or `.json`; the HEX list also copies to the
  clipboard.
- **Save** and **Copy** on every validated result: PNGs copy as images where the browser
  allows it, palette files as text.

Every export is decoded or parsed again and compared before the Save link appears; a
mismatch blocks the download.

## How it works

1. **Drop** an image or paste it from the clipboard.
2. **Extract** a palette or pick a fixed one.
3. **Dither** if you want smoother gradients.
4. **Export** an indexed PNG, a palette strip, a reduced image, or a palette file.

The original half of the canvas draws the full-resolution image. Mapping runs on the full
image up to 4,194,304 pixels and scales larger images down to that budget; the status line
names the preview size whenever it differs from the source. Export always processes the
original at full resolution.

## Interface and saved work

- Settings live in the URL hash: mode, extractor, colors, working space, dither, alpha
  threshold, transparent index, sort, and target palette. A reload restores them; the image
  is never in the URL.
- The last image, palette edits, settings, locks, selection, picked-color markers, and
  undo/redo history are restored from local IndexedDB. **Forget saved session** in the
  footer removes them after a confirmation.
- Canvas: fit, 100%, zoom buttons, wheel and pinch zoom, pan, an original toggle, and a
  keyboard-operable divider. Dark, light, and automatic themes.
- Help drawer: extraction and mapping guides, keyboard shortcuts, and references. Most
  settings also have a `?` explainer.

## Built-in palettes

| Palette | Colors |
|---|---:|
| PICO-8 | 16 |
| Game Boy DMG | 4 |
| Commodore 64 (VICE) | 16 |
| ZX Spectrum | 15 |
| EGA | 16 |

You can also import any palette with up to 256 colors.

## Privacy

Images are decoded and processed entirely in your browser. Nothing is uploaded, and the
page makes no network requests after loading. No analytics, accounts, cookies, or
third-party scripts. Theme, language, and layout preferences stay in local storage, and the
optional saved session stays in local IndexedDB.

## Browser support

Chrome/Edge 111+, Firefox 113+, and Safari 16.4+. The app needs ES modules, Web Workers,
Canvas 2D, `createImageBitmap`, `CompressionStream` / `DecompressionStream`, and
`crypto.subtle`; no extensions or WebAssembly are required.

## Run it locally

The app is a static page with no install or build step. Serve the folder and open it in a
browser (Node.js 22+ runs the development server):

```bash
npm run dev
```

Then open `http://localhost:5173/`.

## Credits

- **Code:** original work, GPL-3.0-only. See [LICENSE](LICENSE).
- **Inter font:** self-hosted under the SIL Open Font License 1.1. The license ships as
  [assets/fonts/OFL.txt](assets/fonts/OFL.txt).
- **Algorithms:** implementations are original and follow the published methods. The
  Help drawer’s **References** section links the papers for the extractors, dithering,
  CIEDE2000, Oklab, PNG, sRGB, and WCAG.
- **Built-in palettes:** factual hardware and community color values. Names and
  trademarks belong to their owners; this project is not affiliated with them.
- **Blue-noise mask:** generated locally by `tools/gen-blue-noise.mjs`.

**License:** GPL-3.0-only. See [LICENSE](LICENSE).
