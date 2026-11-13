# Assets

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

## Blue noise

`blue-noise-64.bin` is a 64×64 byte mask generated deterministically by
`tools/gen-blue-noise.mjs` (void-and-cluster, seed `0x5eed`). It is also embedded as
base64 in `js/core/dither/blue-noise-mask.js` so the browser never fetches it.

- SHA-256: `0dc8e180b19234febe7cd007dd1aa4bd5acdbfcaeee423a86fead748c2b0c1c4`
- Regenerate with `node tools/gen-blue-noise.mjs`; do not hand-edit the mask.
