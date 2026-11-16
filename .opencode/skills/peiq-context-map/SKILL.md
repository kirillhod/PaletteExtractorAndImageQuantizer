---
name: PEIQ context map
description: Use before exploring PEIQ code or docs. Maps a task (color, quantize, dither, PNG, export, UI, palette, i18n, session, release) to the exact files, plan sections, and single test command so the large docs never need a full read.
---

# PEIQ context map

## Do not read these end to end

| File | Approx. tokens | Read instead |
| --- | ---: | --- |
| `IMPLEMENTATION_PLAN.md` | 30k | `node tools/spec.mjs plan 6.5` or `--list` |
| `RESEARCH_REPORT.md` | 30k | `node tools/spec.mjs research 4.5`; only for sourced claims |
| `DESIGN.md` | 15k | `node tools/spec.mjs design 5` |
| `js/main.js` | 20k | grep the function name, read about 80 lines around it |
| `js/content/messages.en.js` | 7k | grep the key; the RU table is a separate file |
| `js/content/messages.ru.js` | 7k | grep the key; do not load both |
| `index.html` | 9k | grep the `id`, read the panel |

`AGENTS.md` is loaded automatically; do not re-read it.

## Task map

| Task | Start here | Spec | Focused test |
| --- | --- | --- | --- |
| Color conversion, distance, contrast | `js/core/color.js` | plan §5 | `node --test test/color.test.js` |
| Histogram, extraction | `js/core/histogram.js`, `js/core/quantize/` | plan §6.2-§6.4 | `test/quantize.test.js`, `test/quantize-advanced.test.js` |
| Mapping, tie-break, alpha | `js/core/map.js` | plan §6.5 | `test/map.test.js` |
| Dithering | `js/core/dither/`, `assets/blue-noise-64.bin` | plan §6.6 | `test/dither.test.js`, `test/golden.test.js` |
| Palette model, add/remove/lock | `js/core/palette.js` | plan §6.7 | `test/palette.test.js` |
| Palette order, perceptual sort | `js/core/palette-order.js` | plan §6.7, §8.4 | `test/palette-order.test.js` |
| Indexed image, transparent index | worker + `js/core/map.js` | plan §6.8, §12.3 | `test/pipeline-m2.test.js`, `test/png.test.js` |
| PNG encode/decode, inflate, chunks | `js/core/png/` | plan §12.2-§12.4 | `test/png.test.js`, `test/golden.test.js` |
| Palette formats and import | `js/core/formats/`, `js/core/palettes/` | plan §13 | `test/formats.test.js`, `test/palettes.test.js` |
| Pipeline and worker protocol | `js/core/pipeline.js`, `js/workers/pipeline.worker.js` | plan §4.4-§4.6 | `test/pipeline.test.js` |
| App state, wiring, preview | `js/main.js` | plan §8 | browser check skill |
| Export jobs, validation, Copy HEX | `js/ui/export-controller.js` | plan §8.3, §12 | browser check skill |
| Canvas, loupe, markers | `js/ui/canvas-view.js`, `js/ui/picked-markers.js`, `js/core/picked-markers.js` | plan §8.3 | `test/picked-markers.test.js` |
| Save/Copy result rows | `js/ui/export-view.js` | plan §8.3, §12 | `test/clipboard-image.test.js` + browser |
| Palette strip and editor UI | `js/ui/palette-view.js`, editor code in `js/main.js` | plan §8.4 | `test/palette.test.js` + browser |
| EN/RU strings | `js/content/messages.en.js`, `js/content/messages.ru.js`, `js/ui/i18n.js`, `js/core/i18n.js` | plan §8.11 | `test/i18n.test.js`, `test/messages.test.js` |
| Theme, layout, responsive | `css/`, `index.html`, `js/theme-init.js`, `js/ui/theme.js`, `js/core/theme-mode.js` | DESIGN §2, §4, §5, §9 | `test/theme.test.js` + browser check skill |
| URL state, session restore | `js/core/url-state.js`, `js/core/session-state.js`, `js/ui/session-store.js` | plan §8.9-§8.10 | `test/url-state.test.js`, `test/session-state.test.js` |
| Quality metrics | `js/core/metrics/index.js` | plan §6.9 | `test/metrics.test.js` |
| SEO, Help, references | `index.html`, `js/content/references.js`, `js/ui/learn-view.js` | plan §8.8, §8.12 | `test/seo.test.js`, `test/references.test.js` |
| Release and tagging | this repo's `AGENTS.md` §10 | plan §15, §17 | load skill `peiq-release` |

## Reading recipe

1. Locate the section: `node tools/spec.mjs plan 6.5`, `node tools/spec.mjs design 4`,
   or `node tools/spec.mjs <doc> --list`.
2. For code, grep the symbol and read a slice with `offset`/`limit`; keep each read under
   about 200 lines.
3. Expand only the call sites that matter; do not sweep whole directories.
4. For "where/how does this work" questions, send the `explore` subagent and keep the
   parent context for edits.
5. Verification: targeted `node --test test/x.test.js` while iterating, full `npm test`
   before claiming done.

## Budget signals

- A single full-plan read is roughly one third of a 100k window.
- `main.js` is about 20k tokens and each message table about 7k; reading both message
  tables plus `index.html` is already about 23k.
- Screenshots and large tool output are expensive: print only the fields you need and
  capture a screenshot only when a visual decision depends on it.
