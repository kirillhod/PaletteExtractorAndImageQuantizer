# AGENTS.md

Operating instructions for coding agents working on **Palette Foundry**.

## 1. Project

Palette Foundry is a zero-dependency, local-first **palette compiler** that runs entirely
in the browser: it extracts palettes, maps images to fixed palettes, dithers, and exports
engine-ready indexed PNGs, validated palette strips, palette sidecars, and QA reports.
Nothing is uploaded. Static hosting on GitHub Pages; no backend, no accounts, no build step.

**Status:** `0.1.0`. Implementation plan `1.0.0` approved. M0 is in progress: the color
core and its tests exist; the rest of M1 is not started.

**Agreed identifiers** (do not rename without approval; they are frozen until
`1.0.0-rc.1`):

| Item | Value |
|---|---|
| Display name | Palette Foundry *(working title; final name TBD)* |
| Package name | `palette-foundry` |
| CSS class prefix | `pf-` |
| JSON format namespace | `palette-foundry/*` |
| Storage keys | `pf.*` |
| Worker entry | `js/workers/pipeline.worker.js` |
| App version constant | `js/core/version.js` → `APP_VERSION` |
| Algorithm version | `ALGORITHM_VERSION = 1` |
| Plan | [`IMPLEMENTATION_PLAN.md`](IMPLEMENTATION_PLAN.md) |

## 2. Source of truth

[`IMPLEMENTATION_PLAN.md`](IMPLEMENTATION_PLAN.md) is authoritative. It defines product
scope, algorithms, contracts, tests, milestones, and the decision log.

- Read §1–§3 before touching code.
- Read §4–§7 for architecture, color, mapping, and dithering.
- Read §8 before UI work.
- Read §10–§12 for tests and output contracts.
- Read §13 for palette data; §15 for the current milestone.

Rules:

- Do not silently diverge from a **MUST**. Update the plan (and the decision log) first.
- Do not simplify a formula, constant, tie-break, or chunk layout without a test that
  proves the replacement is equivalent.
- If implementation reveals that the plan is wrong, fix the plan in the same change.
- [`RESEARCH_REPORT.md`](RESEARCH_REPORT.md) is evidence and context, not a spec. Do not
  edit it except for a factual correction backed by a source.
- This file is the *process* contract; the plan is the *product* contract.

## 3. Layout

```text
/                       index.html, .nojekyll, package.json, LICENSE, README.md,
                        IMPLEMENTATION_PLAN.md, AGENTS.md
/css/                   tokens.css, base.css, layout.css, components.css,
                        canvas.css, responsive.css
/js/
  main.js               bootstrap, feature detection, worker wiring
  ui/                   DOM, state, canvas, palette, QA, export, status, shortcuts
  workers/              pipeline.worker.js
  core/                 DOM-free, Node-testable modules
    color.js            ✅ color science, ΔE, hex, contrast
    quantize/           popularity, median-cut, wu, octree, kmeans
    dither/             kernels, error-diffusion, bayer, ordered, blue-noise
    png/                crc, chunks, encode, decode
    formats/            hex, gpl, pal, ase, css, dtcg, json, manifest
    palettes/           builtin, import
    metrics/            delta-e, worst, contrast, error-map
    pipeline.js         stage composition
/assets/                blue-noise-64.bin (+ provenance)
/test/                  node --test suites and fixture helpers
/tools/                 dev-server.mjs, gen-blue-noise.mjs
/.github/workflows/     ci.yml, pages.yml
```

Keep the import direction one-way: `ui → worker → core`. Core never imports UI.

## 4. Environment

- **Node 22+** for tests and the dev server. No `npm install` is required; there are no
  dependencies.
- **Browser baseline:** Chrome/Edge 111+, Firefox 113+, Safari 16.4+. Required APIs:
  ES modules, Web Workers, `createImageBitmap`, canvas 2D, `CompressionStream` /
  `DecompressionStream` (`deflate`), `crypto.subtle`.
- **Dev server:** `npm run dev` → `http://localhost:5173/`. ES modules do not load over
  `file://`.
- **No build step.** The repository root is the site. GitHub Pages serves it directly;
  `.nojekyll` must exist.
- **Platform:** Windows is the primary dev environment; the repo normalizes text to LF via
  `.gitattributes`. UTF-8, LF, no generated artifacts (one documented exception: the
  blue-noise mask).
- **Testing:** `npm test` runs `node --test`. Canvas/bitmap behavior is checked manually
  in a browser; pure PNG encode/decode is tested in Node.
- **No package manager lockfile is needed** while there are zero dependencies. If a
  lockfile appears, something is wrong.

## 5. Non-negotiable rules

These are contract-level. Violating one produces plausible-looking but wrong output.

1. **Zero runtime dependencies. Zero build step.**
   `package.json` MUST NOT gain `dependencies` or `devDependencies`. No bundler, no
   transpiler, no CSS preprocessor, no CDN, no external fonts, no icon library. If a
   capability is missing, implement it with platform APIs or add it to the deferred
   backlog — do not add a package.

2. **Local-only.**
   No `fetch`, `XMLHttpRequest`, WebSocket, beacon, analytics, or third-party script at
   runtime. Outputs are downloaded via `Blob` + object URLs, which are revoked after use.
   Verify with DevTools (zero network requests after load).

3. **Core is DOM-free and pure.**
   `js/core/**` MUST NOT reference `window`, `document`, `canvas`, `Image`, `navigator`,
   `localStorage`, or `fetch`. It must be importable by `node --test`. All side effects
   live in `ui/**`, `main.js`, or the worker.

4. **One color implementation.**
   Every conversion, distance, and contrast calculation goes through
   `js/core/color.js`. Do not duplicate Oklab/Lab math in modules, tests, or UI. Decisions
   use Oklab Euclidean by default; reporting uses CIEDE2000. Nearest-color ties:
   **lowest palette index wins**.

5. **Determinism is a feature, not an accident.**
   No `Math.random` anywhere. All randomness goes through `js/core/rng.js`
   (`splitmix64`, explicit seed). No wall-clock stopping. Every sort has an explicit
   total-order tie-break. Canonical JSON sorts keys. `Date.now()` may only appear in
   metadata, and that metadata is excluded from hashes.

6. **Alpha policy is fixed.**
   Extraction weights by `alpha/255` and ignores fully transparent pixels. Mapping uses
   RGB without compositing. Indexed PNG has **binary** transparency via `tRNS`; pixels
   below `alphaThreshold` become the declared transparent index. Semi-transparent pixels
   are warned about. RGBA PNG export preserves alpha. A reserved transparent index
   consumes one palette slot.

7. **PNG output is contract-bound.**
   Indexed PNG: color type 3, bit depth `K≤2→1`, `K≤4→2`, `K≤16→4`, else 8; chunks
   `IHDR`, `PLTE`, optional `tRNS`, `IDAT`, `IEND` only; filter 0 on every row; indices
   packed MSB-first; no ICC/gAMA/sRGB/pHYs/tEXt. Strip: exact `N×1` or `1×N`, 8-bit,
   no padding, no profile, exact values. Validate every export by decoding it and
   comparing to the source palette/index map; abort the download on mismatch.

8. **Never silently downscale or crop the final output.**
   Preview may use a ≤1024 px long-edge copy. Export re-decodes the original and processes
   it at full resolution. Images above 16,777,216 pixels are rejected with a clear error.
   A reduced-size export is allowed only when the user explicitly opts in and the UI and
   manifest say so.

9. **Worker protocol is stable.**
   Messages carry a monotonic `requestId`; stale results are ignored and buffers dropped.
   Pixel buffers are transferred, not cloned. The worker is stateless between jobs. Long
   loops yield every 64 rows so `cancel` can be delivered. The UI keeps at most one
   in-flight job. On worker crash, replace it and show a recoverable error.

10. **No silent failures.**
    Every error has a code from §4.6 of the plan, a human-readable message, and a next
    action. Warnings appear in the status bar and in the manifest. Empty `catch` blocks
    are forbidden.

11. **Accessibility is part of the contract.**
    Labels on every control, visible focus, keyboard operation for the divider and
    palette reorder, `aria-live` status, no keyboard traps, `prefers-reduced-motion`
    respected, color never the only signal. Target WCAG 2.2 AA for the UI itself.

12. **License stays GPL-3.0-only.**
    Original code only. Do not copy code from GPL-incompatible sources. Do not change
    `LICENSE`, `package.json` `license`, or the README license statement without explicit
    owner approval.

13. **Generated artifacts are not committed**, except `assets/blue-noise-64.bin`, which is
    a runtime asset generated by `tools/gen-blue-noise.mjs`, committed with its checksum
    and provenance in `assets/README.md`. Regenerate deterministically; never hand-edit.

14. **Do not change agreed identifiers or contracts** (palette JSON schema, manifest,
    filenames, chunk layout, tier of guarantee) without updating the plan and the decision
    log. The display name is the only identifier allowed to change before
    `1.0.0-rc.1`; batch the rename once.

15. **Palette identity is not array position.**
    `PaletteEntry.id` is stable across reordering; `index` is the export position. Locked
    entries keep their indices during sort. Duplicate exact colors are folded into the
    first entry and recorded as aliases. Removing an entry renumbers deterministically.

16. **Security caps are enforced before allocation.**
    File ≤ 64 MiB, pixels ≤ 16,777,216, palette 1–256, index map length = `w*h`. Reject
    decompression bombs and invalid dimensions before creating large typed arrays.

## 6. Coding conventions

- English for code, comments, docs, UI strings, and commit messages.
- Native ES modules. **Named exports only**; no default exports.
- Every `.js` file starts with `// @ts-check`. Use JSDoc typedefs from
  `js/core/types.js`; avoid `any`. Validate external inputs at boundaries.
- Formatting: 2 spaces, single quotes, semicolons, trailing commas, ~100-column lines.
- Naming: `kebab-case.js` files; `camelCase` functions/variables; `PascalCase` typedefs;
  `SCREAMING_SNAKE_CASE` module constants.
- Prefer `const`; never `var`. Use `===`/`!==`. Guard `NaN` and `Infinity`.
- Core functions are pure: no mutation of arguments, return new arrays/typed arrays.
  Mutate only locally owned buffers, and document it.
- Avoid classes unless encapsulating state with invariants. Prefer functions + plain data.
- No `console.log` in shipped code. `js/core/log.js` is debug-gated and off by default.
- No `innerHTML` with user-controlled strings. Build DOM with `createElement` and
  `textContent`. Use `type="button"` on non-submit buttons.
- No inline event handlers or inline styles. Toggle classes/data attributes; style via
  `css/tokens.css` and component classes.
- CSS is plain, `pf-` prefixed, token-driven. Avoid `!important`. Keep specificity flat.
- Async: never leave a floating promise; surface errors; cancel on navigation/unload.
- Keep modules focused (< ~400 lines). Split by responsibility, not by file size alone.
- Comments explain *why*, not *what*. For non-obvious math, cite the plan section or the
  paper (e.g. `// CIEDE2000, plan §5.3; Sharma et al. 2005`).
- Delete dead code instead of commenting it out. No speculative abstractions.
- Do not add a TODO without a corresponding entry in the plan backlog or milestone list.

## 7. Testing and verification

- Run the **full** suite with `npm test`. A subset is not sufficient for “done”.
- Every new algorithm needs:
  1. a known-answer or property test;
  2. a determinism test (same input/seed → identical result);
  3. a compliance test where applicable.
- Every export needs a **round-trip** test: encode → decode → compare.
- Golden tests (`test/golden.json`) may change only intentionally; update them together
  with a decision-log entry explaining why.
- Required known-answer tests are listed in plan §10.3 (CIEDE2000 Sharma pairs, Oklab
  references, CRC32, Bayer matrices, kernel sums, contrast).
- UI changes require a manual browser pass at 1280 px and 360 px, keyboard-only, plus the
  relevant items from plan §10.6.
- Performance-sensitive changes must stay within plan §9 budgets. Report measured stage
  timings when they change materially.
- Do not claim success without showing the command and its result. “Should work” is not a
  verification.

## 8. Definition of done

A change is done only when:

1. `npm test` passes in full.
2. New behavior has a test (known-answer, property, golden, or round-trip).
3. Determinism is preserved (no RNG, clock, or unstable ordering introduced).
4. No dependency, build step, CDN, or network call was added.
5. Output contracts in plan §12 still hold, and export validation still runs.
6. UI changes pass the browser/keyboard check.
7. Warnings/errors are surfaced; nothing is swallowed.
8. Non-obvious math cites the plan or a paper.
9. The plan and decision log are updated if a rule or contract changed.
10. The change is committed locally with a descriptive body (see §10).

## 9. Documentation

- **Plan first.** `IMPLEMENTATION_PLAN.md` describes behavior; `README.md` is user-facing;
  `AGENTS.md` is process. Keep them consistent.
- When a fact or contract changes, update the plan in the same change and add a decision
  log entry with the date and reason.
- External references: clickable Markdown links to canonical sources on first mention in
  a document or major section — not every repetition, never bare URLs. Internal references
  use relative links.
- Code comments are English and reference plan sections for non-obvious rules.
- Keep README usage current: supported inputs, presets, exports, browser support, privacy,
  dev commands, license.
- Do not create new design docs. Extend the plan.

## 10. Git

- **Local commits are allowed and encouraged** after a coherent, verified change.
- **Do not push**, add/change remotes, publish branches, tags, releases, or PRs.
- **Commit messages:** English, plain imperative, **no conventional prefixes** (`feat:`,
  `fix:`, `docs:`, `chore:`). Start with a verb: `Add`, `Remove`, `Implement`, `Fix`,
  `Update`, `Refactor`. Keep the subject short and **always include a non-empty body**
  explaining why, scope, and the plan/milestone reference.

  ```text
  Add Wu quantizer and its moment tests

  Wu gives the balanced photo path a deterministic, near-optimal box split.
  The implementation follows plan §6.4.3 and compares against brute-force MSE
  on small fixtures.

  Refs: IMPLEMENTATION_PLAN.md §6.4.3, §10.2; M2
  ```

- **Version tags:** every release commit that bumps the version gets an annotated local
  tag, e.g. `git tag -a v1.0.0 -m "Palette Foundry 1.0.0"`. The tag, `package.json`, and
  `APP_VERSION` must match. Never move, delete, or reuse a tag.
- Do not rewrite history unless explicitly asked.
- Check `git status` before committing. Never commit `node_modules/`, logs, OS junk,
  generated files (except the documented blue-noise asset), or secrets.
- One coherent change per commit; do not mix refactors with behavior changes.

## 11. Agent workflow

1. Read the plan sections relevant to the task, then check §15 for the current milestone.
2. State the smallest coherent change that advances the milestone. Do not start a second
   milestone in the same change.
3. Implement, add tests, run `npm test`, then verify in the browser for UI work.
4. Update plan checkboxes and the decision log when behavior or contracts change.
5. Commit locally with a descriptive body.
6. Report evidence: commands run, results, known limitations.
7. If blocked by ambiguity, choose the option that preserves the frozen contracts and
   document it. Ask only for product/legal/scope decisions (name, license, release scope)
   — not for implementation choices the plan already covers.
8. Do not add dependencies, external services, or telemetry to work around a problem.
9. Do not refactor unrelated code or “improve” contracts opportunistically.
10. Leave the repository green. If a test is flaky, fix or remove the flakiness before
    moving on; do not skip silently.

## 12. Current state and next task

- Plan: ✅ v1.0.0.
- M0: scaffold ✅, color core ✅ (9/9 tests), `README.md` still a stub.
- Next: `types.js`, `version.js`, `rng.js`, `hash.js`, `test/helpers.js`, then M1
  (histogram → median cut → PNG encoder/decoder → worker → preview → strip).
- Nothing else is implemented yet. Do not assume UI files exist.
- The only open product decision is the public name; identifiers are provisional but
  frozen until `1.0.0-rc.1`.

## 13. Useful commands

```bash
npm test                       # full suite
node --test test/color.test.js # one suite
npm run dev                    # http://localhost:5173/
node tools/dev-server.mjs 8080 # alternate port
node tools/gen-blue-noise.mjs  # regenerate the mask deterministically
git status                     # before every commit
```

## 14. Quick contract cheat sheet

| Rule | Value |
|---|---|
| Max palette | 256 entries |
| Indexed bit depth | `K≤2→1`, `K≤4→2`, `K≤16→4`, else 8 |
| Strip | exact `N×1` or `1×N`, 8-bit, filter 0, no metadata |
| Nearest tie-break | lowest palette index |
| Mapping | exact for ≤65,536 unique colors, else 6-bit LUT |
| Extraction histogram | 5 bits/channel, alpha-weighted |
| Default space | Oklab; sRGB selectable |
| QA metric | ΔE00 mean/p95/max + compliance |
| Determinism | seed + stable ordering + canonical hash |
| Byte equality | same browser/version only |
| Uploads | none, ever |
| Dependencies | zero |
| License | GPL-3.0-only |
