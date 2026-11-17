# AGENTS.md

Operating instructions for coding agents working on
**PaletteExtractorAndImageQuantizer** (short mark **PEIQ**).

## 1. Project

A zero-dependency, local-first **palette compiler** in the browser: extract palettes, map
images to fixed palettes, dither, and export validated indexed PNGs, palette strips,
reduced PNGs, and `.hex`/`.gpl`/`.json` palette files. Nothing is uploaded. Static GitHub
Pages; no backend, no accounts, no build step.

**Status:** `0.3.2`; M2 complete. v1.0.0 scope reset (2026-11-14): lean single-image
handoff. Palette editor, QA metrics, presets, manifests, extra formats, batch, and CLI are
post-1.0.

**Agreed identifiers** (do not rename without approval):

| Item | Value |
|---|---|
| Display name | `PaletteExtractorAndImageQuantizer` (repository name) |
| Short mark | `PEIQ` |
| Package name | `palette-extractor-and-image-quantizer` |
| CSS class prefix | `peiq-` |
| JSON format namespace | `peiq/*` |
| Storage keys | `peiq.*` |
| Worker entry | `js/workers/pipeline.worker.js` |
| Version constants | `js/core/version.js` → `APP_VERSION`, `ALGORITHM_VERSION` |
| Plan | [`IMPLEMENTATION_PLAN.md`](IMPLEMENTATION_PLAN.md), [`docs/spec/`](docs/spec/), [`docs/history/`](docs/history/) |

## 2. Source of truth

[`IMPLEMENTATION_PLAN.md`](IMPLEMENTATION_PLAN.md) is authoritative for scope,
architecture, algorithms, behavior, contracts, tests, and release criteria. It is the
entry point: the status table, the index of every part, and the Definition of Done. The
normative text lives beside it in `docs/spec/`, split by topic, and the append-only record
lives in `docs/history/`:

- `docs/spec/product.md` — scope, constraints, palettes, backlog.
- `docs/spec/architecture.md` — layers, data model, performance, errors, file map.
- `docs/spec/algorithms.md` — color, extraction, mapping, dithering, indexing, QA,
  determinism.
- `docs/spec/ui.md` — layout, controls, canvas, motion, accessibility, URL, session, i18n,
  Help.
- `docs/spec/contracts.md` — tests and export contracts.
- `docs/spec/appendix.md` — reference tables.
- `docs/history/` — decision log, closed milestones, release records; a record, not a plan.

[`DESIGN.md`](DESIGN.md) is authoritative for colors, typography, component styles,
layout values, motion, and responsive rules.

- The plan index maps every section number to its file. Section numbers never renumber, so
  `node tools/spec.mjs plan 6.5` finds a section in whichever file holds it and old
  references stay valid.
- Read `product.md` and `architecture.md` before code, `algorithms.md` for color/mapping/
  dithering/PNG/QA work, `ui.md` for UI behavior, and `contracts.md` for tests and output
  contracts. `docs/history/` is a record, not a plan.
- Read `DESIGN.md` before any UI work. If a visual value conflicts with the plan, DESIGN
  wins; if behavior conflicts, the plan wins.
- Do not silently diverge from a **MUST**. Update the spec file and the decision log first.
- Do not simplify a formula, constant, tie-break, or chunk layout without a test proving
  equivalence.
- [`RESEARCH_REPORT.md`](RESEARCH_REPORT.md) is frozen evidence, not a spec; do not edit it
  except for a sourced factual correction.
- This file is the process contract; the plan and its spec set are the product contract;
  DESIGN.md is the visual contract.

## 3. Layout

```text
/                    index.html, .nojekyll, package.json, LICENSE, README.md,
                     plan/design/research docs
/css/                tokens, base, layout, components, canvas, learn, responsive
/js/main.js          bootstrap, feature detection, worker wiring
/js/theme-init.js    classic head script: resolve theme before paint
/js/ui/              DOM, canvas, palette, export, help, tooltips, theme, status,
                     shortcuts
/js/content/         static references and guide data (no fetch, no DOM)
/js/workers/         pipeline.worker.js
/js/core/            DOM-free, Node-testable: color, quantize, dither, png, formats,
                     palettes, pipeline
/assets/             blue-noise-64.bin, Inter (OFL) + license, own artwork
/test/               node --test suites and fixture helpers
/tools/              dev-server.mjs, gen-blue-noise.mjs, cdp.mjs
/docs/agent/         agent procedures: context map, browser check, release
/docs/spec/          normative plan by topic: product, architecture, algorithms, ui,
                     contracts, appendix
/docs/history/       append-only: decision log, closed milestones, release records
/.opencode/skills/   thin adapters that register docs/agent procedures as skills
/.github/workflows/  ci.yml, pages.yml
```

Import direction is one-way: `ui → worker → core`. `content` is static data rendered by
`ui`; it imports neither `core` nor `ui`. Full file map: `docs/spec/architecture.md` §14.

## 4. Environment

- **Node 22+** for tests and the dev server. No `npm install`; there are no dependencies.
- **Browser baseline:** Chrome/Edge 111+, Firefox 113+, Safari 16.4+. Required:
  ES modules, Web Workers, `createImageBitmap`, canvas 2D, `CompressionStream` /
  `DecompressionStream` (`deflate`), `crypto.subtle`.
- **Dev server:** `npm run dev` → `http://localhost:5173/` (ES modules do not load over
  `file://`). It binds to all interfaces and prints LAN URLs so a phone on the same
  network can open the tool; `node tools/dev-server.mjs 5173 --host=localhost` keeps it
  loopback-only. Allow Node.js on private networks in the OS firewall if prompted; the
  README has the exact Windows inbound rule for TCP 5173.
- **No build step.** The repository root is the site; GitHub Pages serves it directly.
  `.nojekyll` must exist.
- **Encoding:** UTF-8, LF (enforced by `.gitattributes`). No generated artifacts except
  the documented blue-noise mask.
- **Tests:** `npm test` runs `node --test`. Canvas behavior is checked manually; the pure
  PNG encoder/decoder is tested in Node.

## 5. Non-negotiable rules

1. **Zero dependencies, zero build.** `package.json` must not gain `dependencies` or
   `devDependencies`. No bundler, transpiler, CSS preprocessor, CDN, external/CDN font, or
   icon library. A self-hosted OFL font asset is allowed only when the plan declares it.
   Implement with platform APIs or add to the backlog.
2. **Local-only.** No `fetch`, XHR, WebSocket, beacon, analytics, or third-party script at
   runtime. Downloads use `Blob` + object URLs, revoked after use. Verify zero network
   requests in DevTools.
3. **Core is DOM-free and pure.** `js/core/**` must not touch `window`, `document`,
   `canvas`, `Image`, `navigator`, `localStorage`, or `fetch`; it must run under
   `node --test`. Side effects live in `ui`, `main.js`, or the worker.
4. **One color implementation.** All conversions, distances, and contrast go through
   `js/core/color.js`. Color-assignment decisions (extraction, mapping, dithering) use
   Oklab Euclidean; palette ordering and reporting use CIEDE2000. Nearest-color ties:
   **lowest palette index wins**.
5. **Determinism.** No `Math.random`; use `js/core/rng.js` (`splitmix64`, explicit seed).
   No wall-clock stopping. Every sort has a total-order tie-break. Canonical JSON sorts
   keys. `Date.now()` only in metadata excluded from hashes.
6. **Alpha policy.** Extraction weights by `alpha/255` and ignores fully transparent
   pixels. Mapping does not composite. Indexed PNG has **binary** transparency via
   `tRNS`; pixels below `alphaThreshold` become the declared index. If none is declared
   and transparency exists, indexed export reserves the lowest unused or least-used index
   and reports the choice. Semi-transparent pixels warn. RGBA export preserves alpha. A
   transparent index consumes one slot.
7. **PNG contract.** Indexed: color type 3, bit depth `K≤2→1`, `K≤4→2`, `K≤16→4`, else 8;
   chunks `IHDR`, `PLTE`, optional `tRNS`, `IDAT`, `IEND` only; filter 0; indices packed
   MSB-first; no ICC/gAMA/sRGB/pHYs/tEXt. Strip: exact `N×1` or `1×N`, 8-bit, no padding
   or profile. Every export is decoded and compared; a mismatch aborts the download.
8. **Never silently downscale or crop the final output.** The original half of the canvas
   always draws the full-resolution decode. The mapping preview keeps the full image up to
   a 4,194,304-pixel budget and scales anything larger by area to sit just under it, keeping
   the aspect ratio; the status line names the preview size whenever it differs from the
   source. Export re-decodes the original at full resolution. Reject > 16,777,216 pixels
   with a clear error. Reduced-size export requires an explicit opt-in and a warning in the
   export result.
9. **Worker protocol.** Monotonic `requestId`; stale results ignored; buffers transferred,
   not cloned; worker stateless between jobs; yield every 64 rows so `cancel` is
   deliverable; one in-flight job; replace the worker after a crash.
10. **No silent failures.** Every error has a code (plan §4.6), a human message, and a next
    action. Warnings appear in the status bar and export result. Empty `catch` is forbidden.
11. **Accessibility is part of the contract.** Labels, visible focus, keyboard operation
    for the divider and native selects, `aria-live` status, no traps, reduced motion,
    color never the only signal. Target WCAG 2.2 AA for the UI.
12. **License stays GPL-3.0-only.** Original code only. Do not change `LICENSE`,
    `package.json` license, or the README license statement without owner approval.
13. **Generated artifacts are not committed**, except `assets/blue-noise-64.bin`, which is
    a runtime asset generated deterministically by `tools/gen-blue-noise.mjs` and committed
    with its checksum/provenance. Never hand-edit it.
14. **Contracts and identifiers are frozen.** Do not change the palette JSON schema,
    filenames, chunk layout, determinism guarantee, `peiq-` prefix, or `peiq/*` namespace
    without updating the plan and decision log.
15. **Palette identity is not array position.** `PaletteEntry.id` survives reordering;
    `index` is the export position. When palette editing lands post-1.0, locks keep
    indices during sort. Exact duplicates fold into the first entry with aliases. Removal
    renumbers deterministically.
16. **Caps are enforced before allocation.** File ≤ 64 MiB, pixels ≤ 16,777,216, palette
    1–256, index map length = `w*h`. Reject decompression bombs and invalid dimensions.
17. **The learning layer must not get in the way.** Hints and the Help drawer are
    opt-in and closed by default; nothing auto-opens or covers the canvas. Content is
    static data in `js/content/`, rendered with `createElement`/`textContent` — no
    `innerHTML`, Markdown parser, iframe, embed, or runtime fetch. External links open
    only on explicit click with `rel="noopener noreferrer"`; no prefetch/preconnect.
    Update the matching guide topic whenever an algorithm or contract changes.
18. **Follow the Blender design system, not a clone.** Follow `DESIGN.md` (§1, §8).
    Do not copy Blender CSS, logo, wordmark, artwork, screenshots, or theme files. No
    external images, videos, or icon packs; use CSS/SVG/canvas/own screenshots. The
    self-hosted Inter font must ship with its OFL license.
19. **Themes are complete, never mixed.** Dark and light each define every
    theme-sensitive token; components use tokens only, with no `[data-theme]` component
    overrides. `js/theme-init.js` resolves `peiq.theme` before paint (external classic
    head script, no inline JS). The header toggle is a 3-state auto/light/dark button; it
    persists `peiq.theme`, updates `meta[name="theme-color"]`, and listens to system
    changes only in `auto`. Theme switching is instant: no color cross-fade, no layout
    shift. `test/theme.test.js` asserts token parity.

## 6. Coding conventions

- English for code, comments, docs, UI strings, and commits.
- Native ES modules; **named exports only**; no default exports.
- Every `.js` starts with `// @ts-check`; use JSDoc typedefs from `js/core/types.js`;
  avoid `any`; validate external input at boundaries.
- Formatting: 2 spaces, single quotes, semicolons, trailing commas, ~100 columns.
- Naming: `kebab-case.js`, `camelCase` functions, `PascalCase` typedefs,
  `SCREAMING_SNAKE_CASE` constants.
- `const` over `let`; never `var`; use `===`/`!==`; guard `NaN`/`Infinity`.
- Core functions are pure: no argument mutation; document any locally owned buffer
  mutation. Prefer functions + plain data over classes.
- No `console.log` in shipped code; `js/core/log.js` is debug-gated and off by default.
- No `innerHTML` with user-controlled strings; no inline event handlers. Avoid inline
  styles; the only exceptions are dynamic palette swatches via
  `style.setProperty('--swatch', hex)`, the user-chosen full-screen preview background
  via `style.setProperty('--peiq-preview-bg', hex)`, and the color picker's hue stop via
  `style.setProperty('--picker-hue', …)`. Style with `css/tokens.css` and `DESIGN.md`
  components.
- All colors come from `--peiq-*` variables in `DESIGN.md`; no hard-coded hex in CSS or JS.
- No dead code, speculative abstractions, or TODOs without a plan/backlog entry.
- Comments explain *why*; cite the plan section or paper for non-obvious math.
- No emoji in code, UI strings, comments, documentation, or commit messages unless the
  user explicitly requests them. Use plain words or ASCII markers instead.

## 7. Testing and verification

- Run the **full** suite with `npm test`; a subset is not “done”.
- Every algorithm needs a known-answer/property test, a determinism test, and a
  compliance check where applicable.
- Every export needs an encode → decode → compare round-trip test.
- Golden hashes change only intentionally, with a decision-log entry.
- UI changes need a manual browser pass at 1280 px and 360 px, keyboard-only, plus the
  relevant items from plan §10.6. Follow [`docs/agent/browser-check.md`](docs/agent/browser-check.md)
  (skill `peiq-browser-check`) instead of writing a new driver.
- Any UI change that alters a README screenshot or the social preview must refresh
  `assets/screenshots/*.png` and `assets/og-image.png` from the current UI in the same
  change, then update [`assets/PROVENANCE.md`](assets/PROVENANCE.md). A stale capture is a
  documentation defect, not a follow-up.
- Theme changes need `test/theme.test.js` parity plus a manual auto → light → dark →
  reload check in both themes.
- Report the command and its result. “Should work” is not verification.

## 8. Definition of done

A change is done only when `npm test` passes; new behavior has a test; determinism holds;
no dependency/build/network was added; output contracts still validate; UI changes pass
the browser check; README screenshots and the social preview match the current UI;
warnings/errors are surfaced; docs and the decision log are updated; and the change is
committed locally with a descriptive body (plan §16).

## 9. Documentation

- Spec first: behavior belongs in the matching `docs/spec/` file; visual design belongs in
  `DESIGN.md`; `README.md` is user-facing; this file is process; `docs/history/` is a
  record.
- Update the spec file and the decision log in the same change when a fact or contract
  changes. One fact has one home: do not restate a rule in `AGENTS.md` or `README.md`
  when a spec file already owns it, link instead.
- Use clickable canonical Markdown links on first mention; relative links for internal
  references; never bare URLs.
- Do not create new design docs and do not fork the plan. Add a section to the spec file
  that owns the topic; create a new spec file only with owner approval.

## 10. Git

- Local commits are allowed and encouraged after a coherent, verified change.
- **Do not push**, add/change remotes, publish branches, tags, releases, or PRs.
- Commit messages: English, plain imperative, **no conventional prefixes** (`feat:`,
  `fix:`, etc.). Start with a verb and always include a non-empty body explaining why,
  scope, and plan/milestone references. Describe the product change, not the machine:
  keep browser versions, OS, local paths, installed-tool availability, and other
  environment details out of commits. Verification evidence belongs in the task report
  and, when it is a release record, in the plan checklist.

  ```text
  Add Wu quantizer and its moment tests

  Wu gives the balanced photo path a deterministic, near-optimal box split.
  The implementation follows docs/spec/algorithms.md §6.4.3 and compares against
  brute-force MSE on small fixtures.

  Refs: docs/spec/algorithms.md §6.4.3; docs/spec/contracts.md §10.2; M2
  ```

- Release commits that bump the version get an annotated local tag
  (`git tag -a v1.0.0 -m "PaletteExtractorAndImageQuantizer 1.0.0"`). The tag,
  `package.json`, and `APP_VERSION` must match. Never move, delete, or reuse a tag.
- **Version bump.** The tagged commit must contain both `package.json` and
  `js/core/version.js` with matching versions; a bump updates both in that commit.
  Never tag a commit that lacks either update. Tags stay local; do not push them.
  The full checklist is [`docs/agent/release.md`](docs/agent/release.md) (skill `peiq-release`).
- Do not rewrite history. Check `git status` before committing; never commit generated
  files (except the blue-noise asset), logs, OS junk, or secrets.
- One coherent change per commit; keep refactors separate from behavior changes.

## 11. Agent workflow

1. Read the relevant `docs/spec/` file and check plan §0 for the current state. Read
   `DESIGN.md` before UI work.
2. Make the smallest coherent change that advances that milestone; do not start another.
3. Implement, add tests, run `npm test`, then verify UI work in a browser.
4. Update the owning spec file and the decision log when behavior or contracts change.
5. Commit locally with a descriptive body.
6. Report evidence: commands, results, limitations.
7. If ambiguous, choose the option that preserves frozen contracts and document it. Ask
   only for product/legal/scope decisions.
8. Do not add dependencies, services, or telemetry to work around a problem.
9. Do not refactor unrelated code or “improve” contracts opportunistically.
10. Leave the repository green; fix flakiness instead of skipping silently.
11. Keep context small. Load skill `peiq-context-map` or read
    [`docs/agent/context-map.md`](docs/agent/context-map.md) to locate files and specs, use
    `node tools/spec.mjs <plan|algorithms|ui|contracts|design|research> <section>` instead
    of reading a whole document, grep before reading, and read large files in slices. A
    spec file is one topic: open the one you need, never sweep `docs/spec/`. Do not read
    `DESIGN.md`, `RESEARCH_REPORT.md`, `docs/history/`, `js/main.js`, or a `messages.*.js`
    table end to end. Send “where/how” questions to the `explore` subagent and keep the
    main context for edits.

## 12. Current state and next task

- Canonical status, the test count, and the unreleased list live in plan §0; decisions in
  [`docs/history/decisions.md`](docs/history/decisions.md); closed milestones in
  [`docs/history/milestones.md`](docs/history/milestones.md). Do not duplicate feature
  lists or counts here.
- Released `v1.6.0`; M6.3–M6.7 are complete. Status and the test count live in plan §0.
- Next: M7 — later / not planned for v1.x.
- Do not assume UI files are missing: `index.html`, `css/`, `js/ui/`, and the worker
  exist.
- The public name is fixed to the repository name; the short mark is `PEIQ`.

## 13. Useful commands

```bash
npm test
node --test test/color.test.js
npm run dev                    # http://localhost:5173/ + LAN URLs
node tools/dev-server.mjs 8080
node tools/dev-server.mjs 8080 --host=localhost   # loopback only
node tools/gen-blue-noise.mjs
node tools/spec.mjs plan 6.5        # one plan section, any file
node tools/spec.mjs algorithms 6.6  # one spec file by topic
node tools/spec.mjs plan --list     # combined contents
git status
```
