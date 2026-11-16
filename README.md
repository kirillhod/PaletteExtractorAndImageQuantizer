# PaletteExtractorAndImageQuantizer

**Turn any image into a clean, usable palette — right in your browser.**

Extract colors, map an image to a fixed palette, dither the result, and export
engine-ready indexed PNGs, palette strips, and palette files. Everything runs on your
device: no uploads, no accounts, no dependencies, no build step.

![PEIQ workspace with a hydrangea photo, a 24-color palette, and the open palette editor](assets/screenshots/workspace-dark.png)

*Extract up to 256 colors from a photo, compare before and after, edit individual swatches,
and export a validated indexed PNG.*

## What you can do

### Extract a palette

Choose the colors that define your image.

- Five extractors (Wu by default): **popularity**, **median cut**, **Wu**, **octree**,
  and **K-means++**.
- From **2 to 256 colors**, with a slider or an exact number.
- Work in **Oklab** for perceptual results or **sRGB** for legacy pipelines.
- Median cut and Wu get a Lloyd refinement pass for cleaner clusters.
- Sort the result by source order, bounded hue bands, hue-perceptual bands, or lightness
  — switch direction with one button — or use one of three perceptual orders that keep
  neighboring colors close.
- Preview the sorted palette full-screen as one strip with clear gaps between colors on a
  neutral gray background; switch between two grays or pick any color, and the choice is
  remembered.
- Edit the result: change a HEX value, add or remove colors, lock entries so they keep
  their place when sorting, move colors left/right in Manual order, pick colors straight
  from the canvas (each sampled color gets a draggable anchor), and undo or redo palette
  and settings changes with `Ctrl/Cmd+Z`, `Ctrl/Cmd+Shift+Z`, or `Ctrl/Cmd+Y`.
  Reordering changes the exported index order; the preview and Reduced PNG stay the same
  because the color set is unchanged, apart from exact ties. Adding, removing, or editing
  a color changes the mapping. A move cannot cross a locked entry.
- See the original and the reduced image side by side with a draggable divider.

### Map to a fixed palette

Constrain artwork to the palette your engine or hardware expects.

- Built-in palettes: **PICO-8**, **Game Boy DMG**, **Commodore 64**, **ZX Spectrum**, and
  **EGA**.
- Map mode replaces every pixel with the nearest color in the target palette; the right
  half of the preview shows the result. It does not run an extractor: method, color count,
  and working space apply in Extract mode.
- Import `.hex`, `.gpl`, `.pal`, `.json`, or a PNG palette strip (`N×1` or `1×N`).
- Choose a transparent index for sprites. The index starts at **None**, so every palette
  color stays visible; a chosen entry disappears from the preview and from indexed/strip
  output.
- Tune the alpha threshold and preview the result immediately.

### Dither like a pixel artist

- **Error diffusion:** Floyd–Steinberg, Atkinson, Stucki, Jarvis, Burkes, Sierra.
- **Ordered:** Bayer 2×2, 4×4, and 8×8.
- **Blue noise:** a generated 64×64 void-and-cluster mask.
- Adjust strength, serpentine scan, and edge stop; serpentine and edge stop apply to error
  diffusion only.
- Hover or tap the `?` next to any setting for a short explanation.

![Mapping the hydrangea photo to the Game Boy DMG palette with Floyd–Steinberg dithering](assets/screenshots/map-dither-dark.png)

*Map a photo to a four-color built-in palette and tune error diffusion until the result
looks right.*

### Check quality

- CIEDE2000 **mean**, **p95**, and **max** between the source and the mapped preview.
- Toggleable CIEDE2000 error map, from near-zero (dark blue) to 20+ (red).
- The 20 worst pixels with their coordinates.
- Measurements use the preview; fully transparent pixels are skipped.

### Export files your tools can use

- **Indexed PNG** with `PLTE` and optional `tRNS`, using the smallest bit depth for the
  palette (1, 2, 4, or 8 bits).
- **Palette strip** as an exact `N×1` or `1×N` PNG.
- **Reduced RGBA PNG** for quick previews and sharing.
- **Palette files** in `.hex`, `.gpl`, or `.json`.
- **HEX list** copied to the clipboard.
- **Save** and **Copy** on every validated result: PNGs copy as images, palette files as
  text.

Indexed PNGs, strips, reduced PNGs, and palette files are parsed or decoded again and
checked before the Save link appears. A mismatch blocks the download.

### Work comfortably

- Dark, light, and automatic themes.
- Before/after divider, fit, 100% zoom, `+`/`−` buttons, pinch-to-zoom on touch, and
  original toggle.
- Helpful tooltips and a Help drawer with the shortcuts and a reference list.
- The settings rail collapses from the header so the canvas can take the full width; the
  choice is remembered between visits.
- Keyboard shortcuts: `F` fit, `1` 100%, `O` original, `E` error map, `T` theme, `?` Help,
  and `Ctrl/Cmd+Z` / `Ctrl/Cmd+Shift+Z` / `Ctrl/Cmd+Y` for undo and redo.
- Settings live in the URL hash: a reload restores the mode, extractor, colors, working
  space, dither, alpha threshold, transparent index, sort, and built-in palette. The image
  itself is never included in the URL.
- The last image, palette edits, settings, locks, selection, picked-color markers, and
  undo/redo history come back after a reload from local IndexedDB. Use **Forget saved
  session** in Help to remove them.
- Everything stays responsive down to phone width.

## How it works

1. **Drop an image** or paste it from the clipboard.
2. **Extract** a palette or pick a fixed one.
3. **Dither** if you want to trade sharp dots for smoother gradients.
4. **Export** an indexed PNG, a palette strip, a reduced image, or a palette file.

The preview uses a downscaled copy for speed. Export always processes the original image
at full resolution.

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
third-party scripts. Theme, language, and settings-rail preferences stay in local storage,
and the optional saved session stays in local IndexedDB; **Forget saved session** in Help
removes the session.

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
