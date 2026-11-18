# PEIQ — release checklists

Per-release verification records. The checklist to follow for a new release is in `docs/agent/release.md`.

Moved verbatim from the single-file [implementation plan](../../IMPLEMENTATION_PLAN.md);
section numbers below are its original ones.

---

## 17. Release checklist (v1.0.0)

- [x] Zero `dependencies`/`devDependencies`; `npm ls` empty.
- [x] No build step; page works from a plain static server.
- [x] `node --test` green on Node 22 (91 tests).
- [x] Core tests cover every algorithm, format, and contract.
- [x] Manual browser matrix §10.6 completed in Chrome 157 and Edge 157. Firefox and Safari
      were not available in this environment (documented limitation).
- [x] DevTools shows zero network requests after load.
- [x] Strip round-trip and indexed round-trip validated on the release corpus.
- [x] Palette `.hex`, `.gpl`, and `.json` exports round-trip.
- [x] Imported indexed PNG and strips decode in an independent GDI+ decoder; palette,
      strip order, and every indexed pixel match. Aseprite and Godot were unavailable in
      this environment (documented limitation).
- [x] Mobile 360 px and keyboard-only pass.
- [x] Both themes: auto follows OS, toggle cycles, persists, no FOUC; `theme.test.js` parity green.
- [x] Header shows only brand + language/theme toggles + Help; no extra buttons.
- [x] Export progress appears and concurrent export clicks are ignored.
- [x] README complete; screenshots current.
- [x] `APP_VERSION` and `package.json` = `1.0.0`.
- [x] `LICENSE` = GPL-3.0; README states it.
- [x] Pages workflow verified; the live 0.4.0 deployment was smoke-tested at the project
      URL. The 1.0.0 deployment starts when this release commit is pushed.
- [x] Annotated tag `v1.0.0` on the version-bump commit.

### v1.4.0

- [x] `npm test` 156 passing.
- [x] Browser pass at 1280 px and 360 px: preview stability, palette edits, pick and
      markers, all four exports, session restore and clear, keyboard.
- [x] URL `v=1`, session record v2 with optional markers, palette JSON v1, export
      filenames, and `ALGORITHM_VERSION` stay compatible; 1.3.1 URLs and sessions load.
- [x] `APP_VERSION` and `package.json` = `1.4.0`.
- [x] Annotated tag `v1.4.0` on the version-bump commit.

### v1.5.0

- [x] `npm test` 166 passing.
- [x] Browser pass at 1280 px and 360 px: Help header, settings rail and canvas centering,
      Map defaults and mapping copy, imported session restore, palette editor icons, both
      themes, keyboard.
- [x] URL `v=1`, session record v2, palette JSON v1, export filenames, and
      `ALGORITHM_VERSION` stay compatible; 1.4.0 URLs and sessions load.
- [x] `APP_VERSION` and `package.json` = `1.5.0`.
- [x] Annotated tag `v1.5.0` on the version-bump commit.

### v1.6.0

- [x] `npm test` 199 passing.
- [x] Browser pass at 1280 px and 360 px: hue and hue-perceptual sorts with undo and redo,
      the full-screen palette preview, the full-resolution original, the automatic
      transparent index and its warning, the error map with numbered markers, both themes,
      keyboard.
- [x] URL `v=1`, session record v2, palette JSON v1, and export filenames stay compatible;
      existing hue URLs load with the new order. `ALGORITHM_VERSION` is 4.
- [x] `APP_VERSION` and `package.json` = `1.6.0`.
- [x] Annotated tag `v1.6.0` on the version-bump commit.

### v1.7.0

**Changelog**

- PNG exports are compressed losslessly with the browser's DEFLATE stream, with the
  stored-block stream as the fallback; a tiny file never grows, and every export is still
  decoded and compared before Save.
- Palette swatches can be dragged in Edit mode, with an insertion bar, one undo step, and
  `Esc` cancellation. Arrows remain the keyboard, touch, and screen-reader path.
- Full screen and Hide canvas join the stage toolbar; `Esc` restores the frame, focus
  returns to the opener, and neither state is persisted.
- Loading a new image asks before replacing the current one. Adding, applying, or dragging
  a duplicate color selects the existing swatch, scrolls it into view, and pulses it.
- Canvas zoom reaches 6400%, so a 32x32 sprite can be worked at 2048 px.
- The validated export block stays mounted through a job, the progress bar sits on the
  panel edge, and each new Save link pulses once instead of making the panel jump.
- The palette preview gains layouts, captions, an auto-fitting grid, a phone Settings
  tray, and an in-page color picker.
- `npm test` now runs a zero-dependency headless browser smoke suite for canvas, worker,
  themes, focus, stage states, layout overflow, and compressed export.
- Smaller fixes: the header uses the PEIQ mark, the favicon and sitemap are current,
  letter shortcuts work on non-Latin layouts, the Help shortcut is reachable, and the
  360 px stage toolbar wraps instead of scrolling sideways.

- [x] `npm test` 240 passing plus 16 browser checks at 1280x900 and 360x800.
- [x] Manual visual checks during the cycle: palette drag, both stage states, 64x zoom,
      replace dialog, duplicate reveal, steady export panel, compressed export, both
      themes, keyboard. Chrome and Edge paths are covered by the smoke suite; Firefox,
      Safari, and touch gestures remain manual (L-8).
- [x] URL `v=1`, session record v2, palette JSON v1, export filenames, and
      `ALGORITHM_VERSION` 4 stay compatible; 1.6.0 URLs and sessions load.
- [x] `APP_VERSION` and `package.json` = `1.7.0`.
- [x] Annotated tag `v1.7.0` on the version-bump commit.
