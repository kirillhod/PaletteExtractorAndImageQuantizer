# PaletteExtractorAndImageQuantizer

Browser-local palette compiler: extract palettes, map images to fixed palettes, dither,
and export engine-ready indexed PNGs, validated palette strips, palette sidecars, and QA
reports. Dark and light themes, no uploads, no dependencies, no build step.

**Status: M2 is working.**

- Drop, paste, or pick a PNG/JPEG/WebP/GIF/BMP image.
- Extract with popularity, median cut, Wu, octree, or K-means++ in Oklab or sRGB, up to
  256 colors. Median cut and Wu use a Lloyd refinement pass.
- Map to a built-in palette (PICO-8, Game Boy, C64, ZX Spectrum, EGA) or import `.hex`,
  `.gpl`, `.pal`, `.json`, or a PNG palette strip.
- Sort the palette by source order, hue (dark→light / light→dark), or lightness
  (dark→light / light→dark); the swatches, HEX list, and strip export follow.
- Dither with Floyd–Steinberg, Atkinson, Stucki, Jarvis, Burkes, Sierra, Bayer 2×2/4×4/8×8,
  or blue noise; control strength, serpentine, and edge stop.
- Set a transparent index and alpha threshold for sprites.
- Export from the panel under the palette: a **4/8-bit indexed PNG** with `PLTE`/`tRNS`,
  a validated `N×1`/`1×N` strip, or a reduced RGBA PNG. Every export is decoded and
  checked before the Save link appears.
- Hover or tap the `?` next to algorithm settings for short explanations, including
  serpentine scan and edge stop.
- Copy HEX values and switch dark/light/auto themes; the preference persists.

Run it:

```bash
npm run dev
# http://localhost:5173/
```

The dev server binds to all interfaces and prints LAN URLs. Open one of those on a
phone or tablet connected to the same Wi-Fi; allow Node.js on private networks if the
firewall asks. On Windows, if the phone times out, add an inbound rule from an elevated
PowerShell:

```powershell
New-NetFirewallRule -DisplayName "PEIQ dev server (TCP 5173)" `
  -Direction Inbound -Action Allow -Protocol TCP -LocalPort 5173 -Profile Private
```

Remove it with `Remove-NetFirewallRule -DisplayName "PEIQ dev server (TCP 5173)"`.
Use `node tools/dev-server.mjs 5173 --host=localhost` to keep the server loopback-only.

Test it:

```bash
npm test   # 85 tests, zero dependencies
```

## GitHub Pages

The repository is the static site; there is no build step. `.nojekyll` is committed, and
`.github/workflows/pages.yml` stages only `index.html`, `css/`, `js/`, `assets/`, and
`LICENSE` before deploying through GitHub Actions.

1. Make the repository public if you are on the free plan.
2. Open **Settings → Pages → Build and deployment** and set **Source** to
   **GitHub Actions**.
3. Run the **pages** workflow, or push to `main`.
4. Open `https://<user>.github.io/PaletteExtractorAndImageQuantizer/`.

The app uses relative paths, so the project-page subpath works without configuration.
No secret, token, or environment variable is needed for deployment.

Not in M2 yet: ΔE00 QA/error maps, palette editor with locks, all palette-format exports,
batch, animated frames, and the full theory guide. These are M3–M4 in the plan.

See [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) for scope and contracts, and
[DESIGN.md](DESIGN.md) for the visual system.

## Credits and licenses

- **Application code:** original work, GPL-3.0-only. No third-party source code is
  bundled. See [LICENSE](LICENSE).
- **Inter font:** self-hosted variable font under the SIL Open Font License 1.1; the
  license ships as [assets/fonts/OFL.txt](assets/fonts/OFL.txt).
- **Algorithms:** implementations are original and follow the published methods. The
  Help drawer’s **References** section links the papers for median cut, Wu, octree,
  K-means/LBG and k-means++, Floyd–Steinberg, Bayer, void-and-cluster blue noise,
  CIEDE2000, Oklab, PNG, sRGB, and WCAG. Print-only papers are cited without a
  redistributed PDF.
- **Built-in palettes:** factual hardware/community color values. Product names and
  trademarks belong to their owners; this project is not affiliated with them.
- **Blue-noise mask:** generated locally by `tools/gen-blue-noise.mjs`; no third-party
  mask is redistributed.
- **Visual design:** original CSS, SVG, and layout inspired by Blender’s public design
  language. No Blender code, logo, theme file, or artwork is included.
- **Research:** sources and trade-offs are recorded in
  [RESEARCH_REPORT.md](RESEARCH_REPORT.md). Links open only on an explicit click.

The full attribution policy is in
[IMPLEMENTATION_PLAN.md §3.6](IMPLEMENTATION_PLAN.md#36-licensing-and-attribution).

**License:** GPL-3.0-only. See [LICENSE](LICENSE).
