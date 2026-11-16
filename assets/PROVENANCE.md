# Asset provenance

## Fonts

| File | Purpose |
|---|---|
| `fonts/InterVariable-latin.woff2` | Inter variable font, weight 100–900, Latin subset (~48 KB) |
| `fonts/OFL.txt` | SIL Open Font License for Inter |

- Source: [Google Fonts — Inter](https://fonts.google.com/specimen/Inter), v20 Latin
  subset, downloaded 2026-11-13.
- The font is **self-hosted**: no Google Fonts `@import`, no CDN, no runtime request.
- `DESIGN.md` §3 defines the `@font-face` rule and fallback stack.
- If the font is replaced or updated, keep `OFL.txt` and update this note.

## Screenshots

`screenshots/workspace-dark.png` and `screenshots/map-dither-dark.png` are captures of
the running app using a hydrangea photo supplied by the project owner for documentation.
The workspace capture shows the palette editor open with a selected swatch, the compact
sort select with its direction button, and the full-screen preview button; the map capture
shows the Game Boy DMG palette with Floyd–Steinberg dithering and the transparent index at
None. Both show the footer's confirmed session clear. No third-party artwork, screenshots,
or stock images are included. Refreshed 2026-11-16 at 1440×900 from the current UI.

Refresh both captures at 1440×900 in dark theme and English whenever the interface
changes, keeping the same hydrangea composition. A stale capture is a documentation
defect; see `AGENTS.md` §7.

## Social preview

`og-image.png` is the 1200×630 Open Graph and Twitter Card. It is a static HTML card
using the self-hosted Inter font: the PEIQ mark, the product name, the page URL, a
workspace capture of the current UI (K-means++ with 12 colors and hue sort), and the
matching palette strip. Regenerate it from the current UI whenever the interface or
palette order changes; a stale card is a documentation defect. No third-party artwork,
screenshots, or stock images are included. Refreshed 2026-11-16.

## Blue noise

`blue-noise-64.bin` is a 64×64 byte mask generated deterministically by
`tools/gen-blue-noise.mjs` (void-and-cluster, seed `0x5eed`). It is also embedded as
base64 in `js/core/dither/blue-noise-mask.js` so the browser never fetches it.

- SHA-256: `0dc8e180b19234febe7cd007dd1aa4bd5acdbfcaeee423a86fead748c2b0c1c4`
- Regenerate with `node tools/gen-blue-noise.mjs`; do not hand-edit the mask.
