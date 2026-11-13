# PaletteExtractorAndImageQuantizer

Browser-local palette compiler: extract palettes, map images to fixed palettes, dither,
and export engine-ready indexed PNGs, validated palette strips, palette sidecars, and QA
reports. Dark and light themes, no uploads, no dependencies, no build step.

**Status: M1 vertical slice is working.**

- Drop, paste, or pick a PNG/JPEG/WebP/GIF/BMP image.
- Extract with median cut or popularity in Oklab or sRGB.
- Compare original and reduced results with a draggable divider, zoom, and pan.
- Copy HEX values, download a pixel-validated palette strip (`N×1` or `1×N`), or download
  a reduced PNG.
- Switch dark/light/auto themes; the preference persists.
- Every strip is decoded and compared to the palette before download.

Run it:

```bash
npm run dev
# http://localhost:5173/
```

Test it:

```bash
npm test   # 43 tests, zero dependencies
```

Not in M1 yet: fixed-palette mapping, Wu/octree/K-means, Floyd–Steinberg/Bayer/blue-noise,
indexed PNG with `tRNS`, ΔE QA, and the full theory guide. These are M2–M4 in the plan.

See [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) for scope and contracts, and
[DESIGN.md](DESIGN.md) for the visual system.

**License:** GPL-3.0-only. See [LICENSE](LICENSE).
