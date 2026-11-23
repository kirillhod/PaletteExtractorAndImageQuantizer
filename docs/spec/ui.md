# PEIQ — UI spec

Part of the [implementation plan](../../IMPLEMENTATION_PLAN.md). Section numbers are the
original single-file plan's and never renumber, so an existing reference such as
`plan §6.5` still resolves. `node tools/spec.mjs plan <section>` searches every spec
file. Normative keywords (**MUST**, **MUST NOT**, **SHOULD**, **SHOULD NOT**, **MAY**,
RFC 2119) are defined in the plan.

Sections: §8.

---

## 8. UI / UX specification

### 8.1 Layout (desktop ≥ 1220 px)

Empty state: full-width hero with the drop zone; no rail.
Loaded state: three columns on desktop — export, stage, and settings rail — following the
PaletteForge workflow without its header clutter. The export column spans the canvas and
palette rows; its palette-editor hint sits at the bottom of that free left column so hint
text changes never resize the canvas, and the palette starts at the canvas’s left edge.
On mobile the order is toolbar, export, canvas, palette, hint, settings.

```text
┌──────────────────────────────────────────────────────────────┐
│ [PEIQ]                                      [theme] [help]   │ 52 px
├──────────────────────────────────────────┬───────────────────┤
│ Export (180–220) │ Stage                   │ Rail (360/340 px) │
│  primary PNG     │  toolbar: change · fit  │  Palette          │
│  copy / strip    │  canvas / before-after  │   mode, algorithm │
│  reduced / HEX   │  palette strip          │  Dither           │
│  hint (bottom)   │  status line            │  (scrolls)        │
└──────────────────┴─────────────────────────┴───────────────────┘
```

- **Header:** 52 px (48 px below 980 px); brand on the left; a settings-rail toggle,
  language toggle, theme toggle, and Help on the right. No mode tabs, nav links, download
  buttons, account controls, or secondary subbar. The rail toggle only appears once an
  image is loaded.
- **Empty state:** full-width hero; no rail. After an image loads, the hero collapses into
  the stage and the rail appears.
- **≥ 1220 px:** export `clamp(180–220 px)` + stage `1fr` + rail **360 px**.
  **980–1219 px:** export **180 px** + stage `1fr` + rail **340 px**.
  **< 980 px:** stacked; export, toolbar, canvas, palette, settings. **< 600 px:** single
  column, 44 px touch targets, canvas `55svh`; the stage toolbar wraps rather than
  overflowing the viewport.
- **Stage:** a 28 px desktop toolbar, canvas, palette strip, usage bar, and a compact
  24 px status line. "Change image" lives in the stage toolbar, not the header.
- **Export column:** a narrow left column with the primary indexed-PNG action, strip,
  reduced PNG, HEX, and strip orientation. It does not take width from the canvas. Each
  validated result adds Save and Copy actions. The palette-editor hint is bottom-aligned
  in the same left column.
- **Rail:** a stack of collapsible settings sections — Palette (with the Extract/Map
  switch) and Dither. Export is not in the rail; the Quality section is collapsed by default.
  The header toggle collapses the whole rail and gives its 360/340 px to the stage; the
  choice persists in `peiq.rail` and is restored before paint.
- **Palette strip:** directly under the canvas; swatches wrap and scroll. A compact bar
  above it shows the palette count and a sort select: source, manual, hue grouped, hue
  perceptual, lightness, perceptual smooth, perceptual color path, and perceptual flow.
  A direction button next to the select switches Hue and Lightness between dark→light and
  light→dark and is disabled for orders with a fixed direction. The selected order controls
  the swatches, HEX copy, and strip export.
- **Desktop frame:** the page itself does not scroll. Header, stage, and compact footer
  fill the viewport; the stage gives the canvas the remaining height and only the rail
  (or a palette strip with many colors) scrolls.
- **Export panel:** a separate left column with the primary indexed-PNG action and the
  strip/reduced/HEX actions; above the canvas below 980 px. The column spans the canvas and
  palette rows, the palette aligns with the canvas’s left edge, and the editor hint sits at
  the bottom of the free left column. When the canvas is hidden the palette card moves up to
  the export panel’s top edge. After validation, every result offers Save and Copy.
- **Quality:** export validation and palette compliance stay in the status line. The
  Quality section measures the current preview with CIEDE2000: mean, p95, max, a toggleable
  error map, and the 20 worst pixels. `E` or the toggle opens the section; with no
  measurement yet the shortcut measures first and draws the map when the result arrives.
  Once the error map is on it stays on: every new preview of the same image re-measures and
  redraws the map and markers, so a settings or palette change never silently turns the
  overlay off. Loading another image clears it.
  Contrast matrices are out of v1.1.
- The header leads with the PEIQ mark, then the full public name at ≥980 px; below that,
  the short name `PEIQ` with an `aria-label`/`title` carrying the full name. The document
  title uses the full name.
- The `Help` and theme buttons are always visible, including the empty state.
- Visual language, tokens, component styles, motion, and breakpoints: see
  [`DESIGN.md`](../../DESIGN.md).

### 8.2 Controls

The loaded UI has three control surfaces: the stage toolbar, the export column left of the
canvas (above it on mobile), and the right settings rail. Rail sections are independently collapsible;
**Palette** starts open and **Dither** may be opened alongside it. Desktop spacing is
compact but keeps an 8 px gap between labels and controls; the rail scrolls only when
open bodies exceed the viewport. Touch layouts keep 44 px targets.

Every non-obvious control has an 18 px `?` button. It opens a plain-language tooltip on
hover or focus, uses tap on touch, closes on `Esc` or an outside tap, and is appended to
`<body>` so the rail never clips it. Tooltip text also becomes the button’s `aria-label`.

**Stage toolbar** (above the canvas)

- "Change image" button (file picker, drag, paste). All three load paths ask before
  replacing a loaded image: the confirmation names the palette, edits, and undo history
  that will be lost, defaults to keeping the current image, and returns focus when it
  closes.
- **Full screen** and **Hide canvas** close the toolbar row. Below 600 px the row wraps
  instead of running past the viewport, so both stay reachable at 44 px. Full screen lifts
  the canvas over the viewport and hides the header, footer, export column, palette,
  settings, and status; an exit control inside the frame returns. Hide canvas removes the
  stage and its zoom and Original controls, and the palette takes the freed row: it moves up
  beside the export column so both cards start on one top edge, and its swatch strip grows
  into the released height instead of keeping the normal fixed-height scroll box. Both
  buttons are pressed toggles, `Esc` returns to the normal frame, and neither state is
  stored.
- Fit and 100%.
- Original/result toggle.
- Image info: filename, dimensions, unique colors (5-bit bins).

**Palette rail section**

- Mode tabs `Extract` and `Map` (inside the section, not the header).
- Extract: five algorithms (popularity, median cut, Wu, octree, K-means++), colors
  2–256 via a range plus a numeric field (kept in sync; commits clamp and empty falls back
  to 16), working space, with refinement defaulting on for median cut and Wu. **Default:
  Wu, K=16, Oklab.**
- Map: built-in target palette (PICO-8, Game Boy, C64, ZX Spectrum, EGA), "Load palette
  file…" for `.hex`, `.gpl`, `.pal`, `.json`, and 1×N/N×1 PNG strips, transparent index,
  alpha threshold. Map does not extract colors: the target palette is used as-is and the
  extractor settings apply only in Extract mode. The hint and the Help section explain
  that every pixel becomes the nearest color in the target palette and that the right half
  of the preview is the result. The transparent index defaults to **None** in both modes;
  choosing one removes that entry from the preview and the indexed/strip output. When the
  image has transparency and no index is chosen, indexed export reserves the cheapest
  entry and names it in the export result. A restored session keeps the target palette name
  it showed, including imported files.
- Palette order bar: source / manual / hue grouped / hue perceptual / lightness /
  perceptual smooth / perceptual color path / perceptual flow; swatches, HEX list, and
  strip export follow it. A direction button next to the select switches hue and
  lightness between dark→light and light→dark; it is disabled for fixed-direction
  orders. Hue modes group similar tones into bounded bands; the plain hue mode sorts each
  band by Oklab lightness, and the perceptual hue mode refines each band with CIEDE2000
  and chooses each band's direction so neighboring bands join at their closest ends.
  Perceptual modes are labeled by their result, not by the metric name; Oklab and
  CIEDE2000 belong in Help and technical docs.
- Palette editor: **Edit** turns swatch clicks into selection, exposes a HEX field, and
  adds an icon **Copy HEX** button, an icon **Pick** button plus text **Apply**, text
  arrows **← / →**, and icon **Add / Remove / Lock** buttons with action labels. Copy HEX
  copies the value in the field, or the selected entry when the field is empty, so the
  value never has to be selected by hand. Add is a plus, Remove a trash can,
  and Lock shows an open or closed padlock with the same accent pressed state while the
  entry is locked. The HEX field is fixed at 7.5 rem so the controls stay grouped on the
  left. The palette bar carries compact undo/redo icon buttons next to Edit. A preview
  icon button sits between redo and Edit: it opens the current palette full screen on a
  neutral gray background, with two gray presets and an in-page color picker for the
  background and the caption color. The picker is a square saturation/value field, a hue
  ramp, and a hex field in a popover under its swatch; it replaces the browser's dialog,
  which cannot follow the theme. The header has no title and no band of its own; it is
  transparent over the chosen background,
  and its controls sit in two surface chips. Layout switches between one row, a column, and
  a wrapping grid; in the grid a "per row" select offers Auto (fits the palette to the view)
  or 2–32 columns, and HEX and RGB captions can be shown under each color with a user-chosen
  text color, persisting with the background under `peiq.previewLayout` and `peiq.previewBg`.
  Each caption is a button: the HEX line copies the hex and the RGB line copies the
  space-separated triple, with a hover underline and a visible focus ring, so the copy
  action is available to pointer, keyboard, and screen-reader users. The swatch keeps both
  values in its `aria-label`.
  On phones the option tray collapses behind one Settings button beside the close button and
  starts collapsed, so the palette gets the screen; the button expands it in place. A grid
  whose colors all fit is centered in the stage both ways and falls back to top alignment
  when it has to scroll. Color blocks keep a gap of roughly 15% of the block width between
  neighbors in both axes at any palette size. In Row mode a caption is added under the
  color instead of shrinking it, so the block keeps its viewport-based height when HEX or
  RGB is switched on, and the RGB triple stacks one channel per line so a narrow column
  never wraps it at an awkward space.
  The preview is read-only and never changes the export. `Esc`, the close button, or a click
  on the backdrop closes it, and focus returns to the trigger. The dialog traps Tab while
  open,
  and the page behind it does not scroll. Edit is a
  toggle button with a visible pressed state; its label does not change, so the bar never
  rewraps. The editor row reveals with a 150 ms height transition and the canvas refits
  each frame, so opening or closing it never blinks or jumps. **Pick** is an icon button with
  a visible pressed state; it arms a canvas eyedropper with a floating color/HEX
  preview under the pointer: press and drag to sample the visible preview (the reduced
  side when the point is right of the divider), watch the magnified loupe, and release to
  apply it to the selected entry or fill the HEX field for **Add**. A mouse click applies
  on release at the same point. **Pick stays armed after a successful sample** so several
  swatches can be recolored without pressing the button again; the button toggles it off
  and `Esc` stops it.
  **Picked-color anchors:** a successful pick creates a marker at the sampled point;
  extracted and imported colors have no marker until explicitly picked. Markers are
  visible only in Edit mode, follow pan and zoom, and can be dragged or nudged with arrow
  keys to update the entry. A drag commits one undo step; `Esc` cancels it. A marker is
  stored by palette ID as normalized image coordinates, so reordering and locking do not
  move it; removing the entry or making it transparent removes it. Markers persist in the
  session but never enter palette JSON or hashes.
  **Clearing the selection:** clicking any empty part of the palette card (bar, strip
  gaps, or editor row), or pressing `Esc` while the palette has focus, clears the edited
  entry and HEX field. Controls and swatches keep their own action. With no entry
  selected, Pick fills the HEX field for **Add** instead of overwriting an existing color.
  **A color that already exists is never added twice.** Add, Apply, or a marker drag that
  would duplicate an entry selects the entry that already holds the color, scrolls it into
  view, pulses it once in the brand color, and names its position in the toast; the palette
  count does not change.
  **← / →** move the selected unlocked color one slot, switch to Manual order, and remap
  the preview. **Dragging a swatch** in Edit mode moves it to the slot under the pointer:
  a press that travels less than 5 px stays a click (selection), a longer press picks the
  swatch up, dims it, and draws a 3 px accent bar in the gap where it would land; the drop
  switches to Manual order, commits one undo step, and names the new position in the toast.
  A drag cannot start on a locked entry or cross one, and `Esc` cancels. Pointer drag is
  for mouse and pen: on touch the strip has to stay scrollable, so the arrows remain the
  touch path, and they stay the keyboard and screen-reader path everywhere. Moving changes
  export indices, not the set of mapped colors, so the preview
  normally looks identical; the transparent index follows the entry. Adding, removing, or
  editing a color changes the candidate set and therefore the preview and Reduced PNG.
  Locked entries keep their slot, and a move that would cross one is blocked. Locks pin an
  entry to its current slot during sorting and block removal.
  The editor keeps up to 50 snapshots of the editable state (settings, colors, order,
  locks, selection, sort, transparent index, and picked-color markers). Palette edits and
  settings changes share one timeline: extractor, dither, alpha, transparent-index, and
  sort changes commit one step per gesture — picking a sort family or flipping its
  direction — and changing the extractor starts a fresh extraction and drops manual edits
  while undo restores them. `Ctrl/Cmd+Z` and
  `Ctrl/Cmd+Shift+Z` work outside text fields whether or not Edit is on, and the undo/redo
  icon buttons are always visible in the palette bar.
  Rename and roles remain post-1.1.

**Dither rail section**

- Methods: none, Floyd–Steinberg, Atkinson, Stucki, Jarvis, Burkes, Sierra, Bayer
  2×2/4×4/8×8, blue noise.
- Strength 0–100%; serpentine and edge-stop for error diffusion only.
- The controls disable themselves when the selected method does not use them.

**Export panel** (left of the canvas on desktop, above it on mobile)

- Primary: "Download indexed PNG".
- Secondary: "Palette strip", "Reduced PNG", "Copy HEX".
- Every completed export appears as a validated file row with **Save file** and **Copy**.
  Copy uses the already validated bytes: PNG results are written to the clipboard as
  `image/png`; `.hex`, `.gpl`, and `.json` results are copied as text. Copy is never
  offered before validation and never replaces Save.
- While an export runs, show an indeterminate bar pinned to the top edge of the panel and
  put the stage in the status bar; mark the panel `aria-busy`, keep the previous validated
  block mounted and inert, and disable every export/copy button.
- Each new validated file pulses once: a brand layer fades into the Save link's normal fill
  in about 420 ms; `prefers-reduced-motion` drops the pulse. The result block stays in place
  between exports, so the panel never collapses and reopens.
- Only one export may be in flight. A second click, a different export button, or
  `Copy HEX` while busy is ignored. Changing image or settings cancels the stale export.
- If image clipboard writes are unavailable or denied, say so and point to the matching
  Save action instead of failing silently.
- Indexed export uses the sorted palette and declared transparent index; with none declared
  and transparency in the source, it reserves the cheapest entry and reports the choice. It
  is decoded and compared to the index map.
- Strip orientation toggle `N×1` / `1×N` with a filename preview.
- Contract summary before download: `K`, bit depth, transparent index, dimensions.
- Palette-file exports: `.hex`, `.gpl`, and native `.json`.
- After validation, show a `Save <file>` link. The actual file write is a real user
  gesture; browsers may block an async automatic download after a worker response. No
  silent auto-download.

**Help**

- Header `?` button opens the Help drawer with How it works, shortcuts, references, and
  credits. The drawer never opens behind the full-screen palette preview: `?` leaves the
  preview first, and opening the preview closes the drawer.
- Header theme toggle cycles `auto → light → dark`; the preference persists in
  `localStorage` under `peiq.theme`; the current mode is announced.
- Header language toggle cycles `auto → en → ru`; `peiq.locale` persists the mode and
  `auto` follows the browser language. Switching updates the whole site in place.
- A small `?` next to every non-obvious control opens a plain-language tooltip. Tooltip
  text is also the button’s `aria-label`.
- Nothing auto-opens; `Esc` and outside-click close; focus returns to the trigger.

### 8.3 Canvas interactions

- Before/after divider at 50%, draggable; keyboard: `role="slider"`, arrow keys ±1%.
- Zoom: wheel at cursor, `+`/`−` toolbar buttons, pinch on touch, `F` fit, `1` 100%.
  The range is 2%–6400%: a 32×32 sprite reaches 2048 px, so small pixel art can be edited
  pixel by pixel instead of stopping at a stage-sized view.
- Pan: drag with one finger or the mouse; two-finger pinch also pans by its midpoint.
- `O` toggles original.
- Pixelated rendering at ≥100%; smooth below. The error map replaces the mapped preview
  on the right half when enabled, using the same pan, zoom, and divider; numbered markers
  locate the worst pixels from the QA list. Palette-swap previews are post-1.0.
- Checkerboard behind alpha.
- Largest canvas backing store: `min(devicePixelRatio, 2)`.
- No layout shift while processing; keep the last result visible with a progress overlay.
- Keep the previous status line and export controls during a preview. An export click while
  a preview is in flight reports processing instead of exporting a stale palette.

### 8.4 Visual system

All colors, typography, component styles, depth, motion, and breakpoints are defined in
[`DESIGN.md`](../../DESIGN.md). The plan fixes behavior and contracts only.

- Components MUST use the `--peiq-*` variables from `DESIGN.md` ?2; no hard-coded hex.
- Dynamic palette swatch colors are the only inline-style exception: set `--swatch` on the
  element, never a hex in JS. The full-screen preview background is the second exception:
  it is user data, so it is set as `--peiq-preview-bg` on the dialog, never as a literal
  `background` value. The color picker's hue stop is the third: `--picker-hue` carries the
  hue of the saturation/value field, computed from the picker state, and nothing else
  inline.
- If a visual value and this plan disagree, `DESIGN.md` wins; if behavior disagrees, this
  plan wins.

### 8.5 Keyboard shortcuts

| Key | Action |
|---|---|
| `F` | Fit canvas |
| `1` | 100% zoom |
| `O` | Toggle original |
| `E` | Toggle error map |
| `T` | Cycle theme: auto → light → dark |
| `Ctrl/Cmd+Z` | Undo the last palette or settings change |
| `Ctrl/Cmd+Shift+Z`, `Ctrl/Cmd+Y` | Redo the last palette or settings change |
| `?` | Toggle Help drawer |
| `Esc` | Close help, popover, or picking mode |

Single-key shortcuts are disabled while a text field, textarea, contenteditable element,
or select has focus, so typing and type-ahead keep their keys. `?` is the exception: it
opens Help from any control except a text field, textarea, or contenteditable element, and
it closes the full-screen palette preview first, because the Help drawer sits below that
overlay. `F`, `O`, `E`, and `T` match either the produced Latin letter or the physical key
position, so they keep working on a non-Latin layout; `1` accepts the top-row key, while
Shift+1 stays `!`. `?` means the question-mark character, so whether it needs Shift follows
the keyboard layout: Shift+7 on Russian, Shift+/ on English. The Help table prints this row
as `Shift + ?`, since that is the combination on both layouts. `E` opens the Quality section,
measures the preview when no quality result exists yet, and then draws the error map, so the
first press is never a silent no-op. Text entry keeps its native undo; Ctrl/Cmd+Z and
Ctrl/Cmd+Y still reach the shared history when a select, range slider, or checkbox is
focused.

### 8.6 Accessibility

- Every input has a `<label>`; swatches are `<button>` with `aria-label="Index 3, #ff004d"`.
- Status uses `aria-live="polite"`.
- The before/after divider is keyboard-operable with `role="slider"`.
- The theme toggle is a 32 px button with a dynamic `aria-label` naming the current mode
  and the next action; theme changes are announced via a polite live region.
- The language toggle is a compact text button with a dynamic `aria-label` naming the
  current mode, effective language, and next action; changes are announced.
- Both themes meet the same contrast requirements; no state is communicated by color alone.
- Theme switching does not move focus or trigger layout shift.
- Target: WCAG 2.2 AA for the UI itself (4.5:1 text, 3:1 components).
- No keyboard traps; visible focus; dialogs close on `Esc`.

### 8.7 Copy and errors

- Direct, short, no marketing inside the tool.
- Errors name the problem and the next action, e.g.
  “This PNG is 8,192×8,192 (67 MP). The limit is 16.7 MP. Resize it or use a smaller export.”
- Warnings are specific: “Semi-transparent pixels will become fully transparent or
  opaque in indexed PNG.”

### 8.8 Learning layer

Goal: explain the theory **in place**, without turning the tool into a tutorial or a docs
site. Learning is opt-in, contextual, and dismissible.

**Contextual hints**

- A small outlined `?` icon sits next to non-obvious controls: algorithm, colors, space,
  refine, seed, dither method, strength, serpentine, edge stop, order, transparent index,
  alpha threshold, ΔE00 stats, and export options.
- Hover/focus (desktop) or tap (touch) opens a popover: 2–4 short sentences of plain
  text. The Help drawer carries the references; tooltips do not navigate. Maximum width
  320 px; positioned next to the trigger.
- `Esc`, outside-click, or a second click closes it; focus returns to the trigger.
- Hints never cover the canvas, never block a control, and never auto-open.

**Help drawer**

- The header `?` button opens a non-modal right-side drawer with two tabs:
  - **Guide** — topics, each with a summary, 2–4 short paragraphs, and canonical links.
  - **Shortcuts** — the table from §8.5.
- Closed by default. Remembers the last tab for the session only.
- Desktop: 680 px overlay above the right rail; the canvas does not relayout. Body text is
  1rem at 1.6 line height, and each section opens with a bold takeaway (or a bold term
  list) so the drawer reads as prose rather than a wall of small text.
  < 960 px: full-height sheet; `Esc` closes.
- The drawer header uses the page header height (`--peiq-header-height`) and the same
  inline padding, its title matches the brand's 18 px/800 scale, and the close button is
  an 18 px icon. The two bottom borders line up when the drawer is open.
- Current order: How it works, Extracting a palette, Mapping to a palette, Palette order
  and preview, Picked colors, Quality, Shareable settings, Saved session, and Shortcuts.
  Extraction names the five methods and their trade-offs; Mapping stays a separate
  section. References and credits are native `<details>` disclosures, closed by default,
  so the guide stays short without removing attribution.
- Topic list (minimum 12):
  1. `quantization-basics` — what quantization is and what it trades away.
  2. `popularity` — dominant-color selection.
  3. `median-cut` — Heckbert’s box splitting.
  4. `wu` — moment-based splitting.
  5. `octree` — tree reduction.
  6. `kmeans` — Lloyd/LBG and k-means++.
  7. `oklab-vs-srgb` — perceptual spaces and the content-dependent caveat.
  8. `delta-e` — CIEDE2000 and practical thresholds.
  9. `error-diffusion` — FS/Atkinson/Stucki/Jarvis/Burkes/Sierra.
  10. `ordered-dithering` — Bayer and two-candidate ordered dithering.
  11. `blue-noise` — void-and-cluster masks.
  12. `indexed-png` — `PLTE`, `tRNS`, and engine import.
  13. `palette-strips` — the 1×N contract and Aseprite/Godot/Unity.
  14. `alpha` — transparency in indexed output.
  15. `determinism` — seeds, hashes, and reproducibility.
  16. `contrast` — WCAG/APCA and why one number is not “accessible”.

**Content and safety**

- v1.0 Help content: How it works, extraction and mapping, ordering and preview, picked
  colors, quality, shareable settings, saved session, shortcuts, references, and credits.
  There is no long-form Guide, topic tabs, or deep-link routing in this release.
- **Forget saved session** is not in the drawer. It sits in the footer next to the
  privacy statement, so it is visible without scrolling; the button opens a native
  confirmation dialog with Cancel focused by default and clears IndexedDB only after the
  user confirms.
- `js/content/references.js` holds canonical references:
  `{ id, title, authors, year, venue, url }`; it is the single source for UI links.
- Rendered with `createElement`/`textContent`; no Markdown parser, no `innerHTML`, no
  iframe, no embedded video, no third-party widget.
- Links are canonical sources (papers, specs, engine docs), `target="_blank"`,
  `rel="noopener noreferrer"`. No prefetch/preconnect. The page remains local-only; only
  an explicit click navigates away.
- Content is static and bundled; zero runtime fetches.
- Drawer semantics: `role="dialog"`, `aria-modal="false"`, labelled by its heading;
  focus moves in on open and returns on close.
- Post-1.0 only: `js/content/learn.js`, `#help=<topic>` deep links, Guide/Shortcuts tabs.
- Non-goals: first-run tour, modal onboarding, permanent explanatory paragraphs,
  documentation site, comments/community.

---

### 8.9 URL state

- The hash stores normalized settings only: mode, extractor, color count, space, built-in
  palette id, dither settings, alpha threshold, transparent index, and sort order.
- Defaults are omitted; `v=1` versions the format. Image bytes, palette edits, imported
  palette contents, and QA results are never serialized.
- User changes rewrite the hash with `history.replaceState`; loading a URL or editing the
  hash restores the controls. A pending transparent index is applied after the palette
  exists.

### 8.10 Session persistence

- IndexedDB stores the last image as encoded bytes (`ArrayBuffer`), plus settings, palette
  entries, locks, order, selected entry, edit mode, transparent color id, and the
  palette/settings undo history. Version 1 records with a Blob are read once and upgraded
  on the next save.
- On load, a saved session reopens the editor directly. The URL hash remains a portable
  settings config: if it differs from the saved settings, it wins and the palette is
  re-extracted from the image instead of restoring local edits.
- A newer image load owns the UI. If the user drops or chooses an image while the saved
  session is being read or decoded, the restore is abandoned and must not apply settings,
  replace the image, or surface its own decode error afterwards.
- **Forget saved session** in the footer clears the stored image and state after a
  confirmation dialog; a failed decode, invalid record, unavailable storage, or quota
  error falls back without trapping the user.
- Imported palette contents and QA results are not part of the session.

### 8.11 Localization

- The site UI is fully available in English and Russian. Repository documentation stays
  English; only the rendered site switches.
- `js/content/messages.en.js` and `js/content/messages.ru.js` hold flat catalogs with
  matching key sets; `js/content/messages.js` combines them for `MESSAGES`.
  `js/core/i18n.js` owns locale detection, interpolation, and `Intl.PluralRules` plural
  formatting; `js/ui/i18n.js` applies the catalog to the DOM and dispatches locale changes.
- `peiq.locale` stores `auto | en | ru`. In `auto`, the first `ru`/`en` prefix in
  `navigator.languages` wins, otherwise English; a `languagechange` event re-resolves it.
  `js/theme-init.js` writes `<html lang>`, `data-locale`, and `data-locale-mode` before paint.
- The header language toggle cycles `auto → en → ru`, sits next to the theme toggle, and
  uses a compact text label (`AUTO`/`АВТО`, `EN`, `RU`). Switching updates static copy,
  tooltips, dynamic status and toasts, palette state, Help references/credits, and the
  document title without reloading.
- Static HTML uses `data-i18n`, `data-i18n-tooltip`, `data-i18n-aria-label`,
  `data-i18n-title`, `data-i18n-content`, and `data-i18n-placeholder`. Dynamic code uses
  `t()` and `tp()`; no user-facing string bypasses the catalog. English is the fallback.
- Russian uses the `one` / `few` / `many` / `other` plural forms for color, pixel, and HEX
  counts. Both languages share the same layout; no per-language component overrides.
- Reference titles, authors, and venues stay canonical; group headings, print notes, and
  credit labels/descriptions are localized.
- The same URL serves both languages through JavaScript. This is good for the user but
  does not create a separately indexable Russian page; Russian search visibility would
  require a static `/ru/` route with `hreflang`, not only JS switching.

### 8.12 SEO metadata

- `index.html` carries an absolute `canonical`, `index,follow,max-image-preview:large`,
  a keyword-first `<title>` that ends with the `PEIQ` short mark, and a
  `<meta name="description">` that names the color range, palette sources, and export set.
  The repository display name remains in JSON-LD and the header; the title avoids
  truncating a 33-character unbroken word in search results.
- Open Graph and Twitter Card metadata use absolute URLs and the 1200×630
  `assets/og-image.png` social preview.
- JSON-LD describes a free `WebApplication` with category, browser requirements, feature
  list, repository, license, screenshot, and `offers.price = "0"`.
- `sitemap.xml` lists the canonical page with `lastmod`; `robots.txt` references the
  project sitemap. GitHub project pages cannot own the host-root `robots.txt`, so manual
  Search Console submission remains the reliable discovery path.
- `test/seo.test.js` checks the metadata, JSON-LD, social image dimensions, sitemap, and
  robots references. Localized Russian SEO would need a separate static route.
