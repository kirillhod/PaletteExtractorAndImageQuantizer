# PEIQ — milestones

Closed milestones and their exit criteria. The current milestone lives in the plan index; this file is a record, not a plan.

Moved verbatim from the single-file [implementation plan](../../IMPLEMENTATION_PLAN.md);
section numbers below are its original ones.

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
