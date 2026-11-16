# PaletteExtractorAndImageQuantizer — Implementation Plan

**Plan version:** 1.5.0
**Product version at completion:** 1.5.0
**Status:** Approved for implementation
**Date:** 2026-11-13 (split by topic 2026-11-16)
**License:** GPL-3.0-only (owner decision, 2026-11-13)
**Source research:** [RESEARCH_REPORT.md](RESEARCH_REPORT.md)
**Public name:** `PaletteExtractorAndImageQuantizer` (the repository name).
**Short mark:** `PEIQ`.
**Identifiers:** frozen from this revision (`peiq-` CSS prefix, `peiq/*` JSON namespace,
`peiq.*` storage keys).

Normative keywords: **MUST**, **MUST NOT**, **SHOULD**, **SHOULD NOT**, **MAY**
(RFC 2119 semantics). A deviation from a MUST requires updating this plan first.

---

## 0. How to use this document

This plan is the single source of truth for scope, architecture, algorithms, output
contracts, testing, and release criteria. It is split by topic so a task loads one file,
not the whole plan. `AGENTS.md` holds the operating rules for agents and defers to this
plan for *what* to build.

| File | Contents |
|---|---|
| [`docs/spec/product.md`](docs/spec/product.md) | §1 product definition, §2 feature matrix, §3 constraints, §13 built-in palettes, §19 backlog |
| [`docs/spec/architecture.md`](docs/spec/architecture.md) | §4 layers and data model, §9 performance, §11 error handling, §14 file map |
| [`docs/spec/algorithms.md`](docs/spec/algorithms.md) | §5 color science, §6 extraction, mapping, dithering, indexing, QA, §7 determinism |
| [`docs/spec/ui.md`](docs/spec/ui.md) | §8 layout, controls, canvas, motion, accessibility, URL state, session, i18n, Help |
| [`docs/spec/contracts.md`](docs/spec/contracts.md) | §10 testing, §12 export contracts |
| [`docs/spec/appendix.md`](docs/spec/appendix.md) | Appendices A–E: glossary, references, palette data, Bayer matrices, kernels |
| [`docs/history/decisions.md`](docs/history/decisions.md) | §18 decision log, append-only |
| [`docs/history/milestones.md`](docs/history/milestones.md) | §15 closed milestones M0–M6.6 |
| [`docs/history/releases.md`](docs/history/releases.md) | §17 per-release verification records |

- Section numbers are the original single-file numbers and never renumber, so an existing
  reference such as `plan §6.5` still resolves. `node tools/spec.mjs plan 6.5` searches
  every spec file; `node tools/spec.mjs plan --list` prints the combined contents.
- Read `product.md` and `architecture.md` before code, `algorithms.md` for color, mapping,
  dithering, PNG, or QA work, `ui.md` before UI work, and `contracts.md` for tests and
  output formats.
- History and the appendix are reference only; do not open them for a normal change.
- Never silently diverge from a frozen contract. Record the reason in
  [`docs/history/decisions.md`](docs/history/decisions.md) first, then change the rule in
  its spec file.

### Current state (2026-11-16)

| Item | State |
|---|---|
| Research report | Evidence, frozen 2026-11-14; see its status header for what shipped differently |
| Plan | This index plus `docs/spec/`; scope reset 2026-11-14; content current as of `v1.5.0` plus the unreleased changes listed below |
| Scaffold | `index.html`, CSS, `package.json`, `.gitignore`, dev server, CI |
| Core | Color, histogram, five extractors, refinement, exact/LUT mapping, dithering, PNG index/encode/decode, palettes, perceptual ordering, picked-marker serialization |
| UI | Stage + compact collapsible rail with a header toggle, left export column with validated clipboard copy, contextual tooltips, English/Russian localization, themes, extract/map modes, fixed palettes, dithering, indexed PNG, full-screen palette preview, Help with extraction and mapping guides and collapsed references and credits, footer session clearing with confirmation, picked-color markers, workspace error map with numbered worst-pixel markers |
| Tests | 199 passing (`node --test`), including golden hashes, dithering, palettes, bounded hue bands, hue-perceptual ordering, perceptual ordering, sort-family mapping, preview backgrounds, dithered preview alpha, Wu grid bounds and occupancy, dither tone and gradient spread, preview sizing, automatic transparent index, Help placement, picked markers, clipboard helpers, formats, indexed PNG, alpha, metrics, URL state, session state, controls, i18n, messages, theme parity, rail state, view offsets, SEO, references, plan split integrity |
| Version | `js/core/version.js`; `v1.5.0` tagged; M6.3–M6.6 complete; unreleased bounded hue bands, hue-perceptual modes, compact sort controls, the full-screen palette preview, the full-resolution original with a 4 MP preview budget, the automatic transparent index, and the workspace error map, with `ALGORITHM_VERSION` 3 |
| Next | Ship the unreleased changes with the next release; otherwise M7 — later / not planned for v1.x |

> **v1.0.0 scope reset (2026-11-14).** The refreshed landscape in
> [RESEARCH_REPORT.md §4.5](RESEARCH_REPORT.md#45-landscape-refresh-14-nov-2026) shows
> that generic extraction, quantization, dithering, batch export, and palette-format
> export are now commodity features. v1.0.0 is deliberately narrowed to **single-image
> extraction + fixed-palette mapping + validated indexed PNG/strip + essential
> dithering**. Palette editing, perceptual QA, presets, manifests, extra formats, batch,
> CLI, and long-form guide content are parked after 1.0. The feature matrix and backlog in
> [`docs/spec/product.md`](docs/spec/product.md) are authoritative for this reduced scope.

---

## 16. Definition of Done

A change is done only when:

1. `node --test` passes (full suite, not a subset).
2. New behavior has a test: known-answer, property, golden, or round-trip.
3. Determinism is preserved; no `Math.random`, no wall-clock decisions.
4. No dependency, build step, CDN, or network call was added.
5. Contracts in §12 still hold; validation still runs on export.
6. UI changes are checked in a browser at 1280 px and 360 px, keyboard-only, in both themes.
7. Warnings/errors are surfaced; no silent catch.
8. Non-obvious math cites a plan section or a paper.
9. The owning spec file and the decision log are updated if a rule or contract changed.
10. The change is committed locally with a descriptive body (see AGENTS.md §10).
