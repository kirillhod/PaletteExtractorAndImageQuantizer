# PEIQ — algorithms spec

Part of the [implementation plan](../../IMPLEMENTATION_PLAN.md). Section numbers are the
original single-file plan's and never renumber, so an existing reference such as
`plan §6.5` still resolves. `node tools/spec.mjs plan <section>` searches every spec
file. Normative keywords (**MUST**, **MUST NOT**, **SHOULD**, **SHOULD NOT**, **MAY**,
RFC 2119) are defined in the plan.

Sections: §5, §6, §7.

---

## 5. Color science (normative)

`js/core/color.js` is the only implementation. Constants below are frozen.

### 5.1 Transfer function

sRGB → linear:
`c ≤ 0.04045 ? c/12.92 : ((c+0.055)/1.055)^2.4`

linear → sRGB:
`c ≤ 0.0031308 ? 12.92c : 1.055c^(1/2.4) − 0.055`

### 5.2 Oklab matrices

Linear sRGB → LMS:

```
l = 0.4122214708 r + 0.5363325363 g + 0.0514459929 b
m = 0.2119034982 r + 0.6806995451 g + 0.1073969566 b
s = 0.0883024619 r + 0.2817188376 g + 0.6299787005 b
```

LMS′ → Oklab:

```
L = 0.2104542553 l′ + 0.7936177850 m′ − 0.0040720468 s′
a = 1.9779984951 l′ − 2.4285922050 m′ + 0.4505937099 s′
b = 0.0259040371 l′ + 0.7827717662 m′ − 0.8086757660 s′
```

Inverse:

```
l′ = L + 0.3963377774 a + 0.2158037573 b
m′ = L − 0.1055613458 a − 0.0638541728 b
s′ = L − 0.0894841775 a − 1.2914855480 b
l,m,s = l′³,m′³,s′³

r =  4.0767416621 l − 3.3077115913 m + 0.2309699292 s
g = −1.2684380046 l + 2.6097574011 m − 0.3413193965 s
b = −0.0041960863 l − 0.7034186147 m + 1.7076147010 s
```

### 5.3 CIELAB (D65) and ΔE

sRGB → XYZ (D65):

```
X = 0.4124564 r + 0.3575761 g + 0.1804375 b
Y = 0.2126729 r + 0.7151522 g + 0.0721750 b
Z = 0.0193339 r + 0.1191920 g + 0.9503041 b
```

`f(t) = t > (6/29)³ ? ∛t : (κt + 16)/116`, `κ = 24389/27`.
`L = 116 f(Y/Yn) − 16`, `a = 500(f(X/Xn) − f(Y/Yn))`,
`b = 200(f(Y/Yn) − f(Z/Zn))`, white D65 `(0.95047, 1, 1.08883)`.

- **Oklab is the working space for color-assignment decisions:** extraction
  (histogram cells, Wu moments, median-cut axes, K-means centroids, refinement),
  nearest-color mapping, and dithering. It is a vector space with meaningful
  centroids, error vectors, and fast Euclidean distances.
- **CIEDE2000 is the metric for palette ordering and reporting.** Ordering a fixed
  palette of 1–256 colors is a one-off pairwise comparison and can afford `deltaE00`;
  QA reports mean/p95/max ΔE00, the error map, and worst pixels.
- **Nearest-color assignment still uses Oklab**, even when the palette order was
  produced with CIEDE2000. Ordering changes export indices; it does not change the
  mapping metric.
- CIEDE2000 is not a working space: it is a difference formula over CIELAB pairs.
  Do not replace Oklab centroids, Wu moments, or error-diffusion vectors with it.
- `deltaE76` exists for legacy/QA comparison only.

### 5.4 Alpha policy

- Palette extraction weights pixels by `alpha/255`; fully transparent pixels contribute
  nothing.
- Palette colors are stored as RGB with alpha 255. Alpha is **not** part of a palette
  entry except when importing a palette that explicitly has alpha.
- Mapping uses the pixel's RGB as-is (no compositing over a background).
- Pixels with `alpha < alphaThreshold` become transparent in indexed output.
- Semi-transparent pixels in `(0, 255)` are reported as a warning; indexed PNG has only
  binary transparency (`tRNS`). RGBA PNG export preserves alpha exactly.
- The preview keeps the source alpha in both the nearest-color and the dithered path:
  fully transparent pixels stay invisible and semi-transparent pixels keep their
  coverage. An index map carries no alpha, so a dithered preview is composed from the
  source buffer rather than from the palette alone; the reserved index is always
  transparent. Export validation still expects the binary `tRNS` result.
- A reserved transparent index removes one usable opaque slot: `colors` includes it.
- When the user has not chosen a transparent index and the image has pixels below the alpha
  threshold, indexed export reserves the cheapest entry automatically (see §6.5.2) and
  reports the choice in the export result.

### 5.5 Distances and precision

- Clustering, mapping, and dithering distances in Oklab with `f64`.
- Palette ordering uses pairwise CIEDE2000 distances; every ordering has a total
  tie-break (§6.7). Oklab remains the metric for nearest-color assignment.
- sRGB→linear LUT of 256 entries is allowed.
- Oklab is computed per histogram bin / unique color, never per pixel.
- Nearest-color ties: **lowest palette index wins**.
- Out-of-gamut Oklab results are clamped to 0..255 only at 8-bit materialization.

### 5.6 Reporting thresholds (defaults, user-overridable)

| Metric | Pass | Warn |
|---|---:|---:|
| ΔE00 mean | ≤ 2 | > 2 |
| ΔE00 p95 | ≤ 5 | > 5 |
| ΔE00 max | ≤ 10 | > 10 |
| Palette compliance | 100% | any violation = fail |

Thresholds are displayed, never used to hide raw values.

---

## 6. Pipeline and algorithms

### 6.1 Stage contract

| Stage | Input | Output | Invariants |
|---|---|---|---|
| Decode | File/Blob | `ImageDataLite` | sRGB 8-bit, orientation applied, dimensions capped |
| Histogram | pixels | `Histogram` | 5-bit bins, alpha-weighted |
| Extract | histogram, params | `Palette` | 1..min(K, unique) entries; deterministic |
| Order | palette, order | reindexed palette | ID stable; index is a permutation |
| Map | pixels, palette | `IndexMap` | every opaque pixel index < entries.length |
| Dither | pixels, palette, map | `IndexMap` | palette compliance preserved |
| Index | map, palette | indexed image model | bit depth rule, transparent index valid |
| Encode | indexed model | PNG bytes | required chunks only |
| Report | inputs/outputs | `Report` | metrics recomputable from artifacts |

### 6.2 Histogram (`core/histogram.js`)

- 5 bits/channel → `32×32×32 = 32768` bins. Bin id: `(r5 << 10) | (g5 << 5) | b5`,
  `r5 = r >> 3`.
- Per bin store: `weight` (sum of alpha/255), `sumR`, `sumG`, `sumB` (alpha-weighted).
- Bin representative: weighted mean of sRGB, rounded; then converted to the working space.
- Occupied bins = unique 5-bit colors. Report this count as “unique colors (5-bit)”.
- Iterate pixels once; skip `alpha === 0`.
- Memory: `Float64Array` per accumulator (6 × 32768 × 8 B ≈ 1.5 MB).
- Alpha weighting is normative; unweighted histograms are a bug.

API:

```js
buildHistogram(pixels, { bits: 5 }) -> { bits, weight, sumR, sumG, sumB, occupied }
```

### 6.3 Extraction common contract

```js
extract(hist, params) -> { colors: RGBA8[], weights: number[], stats }
```

- Return at most `params.colors` entries.
- If occupied bins < requested, return the occupied colors (no padding); UI warns.
- Deduplicate exact RGB results; if dedupe reduces below K, continue splitting the next
  best box/cluster until K unique colors or no candidate remains.
- Then run `refine` passes (Voronoi/Lloyd) when `params.refine` is true: 2 passes for
  median cut/Wu, 0 for popularity/octree (their modes are explicitly “fast”).
- Weights are the sum of bin weights assigned to each entry (for ordering/QA).

### 6.4 Extraction algorithms

#### 6.4.1 Popularity (`popularity`)

- Sort occupied bins by `weight` descending, then bin id ascending.
- Take top K, dedupe exact colors, representatives = bin means.
- O(M log M). Quality: poor on photos, good on flat/pixel art. Label in UI:
  “Fast — keeps dominant colors”.

#### 6.4.2 Median cut (`median-cut`)

- Box = list of occupied bin ids.
- Box score = weighted SSE = `Σ w·||c − mean||²` in the working space.
- Pick the splittable box with the largest score; tie → lowest box id.
- Axis = largest weighted variance; tie → L, then a, then b.
- Split at the weighted median (first cumulative weight ≥ half); if either side is empty,
  split at the median index; if the box has one bin, mark unsplittable.
- Representative = weighted mean in the working space.
- Continue until K boxes or no splittable box.
- Complexity ~O(K·M log M). Deterministic.

#### 6.4.3 Wu (`wu`)

- Build a 33³ cumulative moment grid over the 5-bit histogram:
  `w, sL, sa, sb, sLL, saa, sbb, sLa, sLb, sab` (10 × `Float64Array(33³)`).
- Populate from bin representatives, then 3D prefix sums in `x→y→z` order.
- Box moments via inclusion–exclusion over 8 corners.
- Box variance = `Σsq − Σ²/w`; weight 0 boxes are skipped.
- sRGB maps each 5-bit bin to one cell, so the grid already matches the histogram.
  Oklab normalizes the occupied L, a, b ranges onto the 32 steps, because the fixed
  full-gamut range collapses a narrow hue or lightness range into a handful of cells and
  stops the split early; a degenerate span is grown around its center.
- A second occupancy prefix counts the bins per cell. A box with no occupied cell is
  empty, so an inclusion–exclusion residual from non-binary alpha weights can neither
  become a representative nor block the split loop.
- Choose the box with the largest weighted variance.
- For each axis, try every cut 1..31; choose the cut minimizing `var(left)+var(right)`
  (maximizing reduction). Tie → lowest axis, then lowest cut.
- Repeat until K boxes or no cut reduces variance.
- Representative = weighted mean.
- This is the default “Balanced” method for photos.
- A brute-force MSE comparison on small fixtures is a required test.

#### 6.4.4 Octree (`octree`)

- Depth 5 (the histogram is already 5-bit).
- Insert occupied bins into an 8-ary tree; leaves accumulate weight and weighted sums.
- Reduce by merging the least-weight leaf into its parent until ≤K leaves.
- Merge order: lowest weight, then lowest node id. Internal nodes keep accumulated sums.
- Representative = weighted mean.
- Label: “Fast — streaming-style, lower quality”.
- Complexity O(M·depth + merges). Deterministic.

#### 6.4.5 K-means++ (`kmeans`)

- Input: occupied bins with weights (M ≤ 32768).
- First centroid: highest weight, tie lowest bin id (deterministic, no RNG).
- Remaining seeds: k-means++ sampling with probability proportional to
  `weight · D²`, using `splitmix64(seed)`. Zero-total-weight edge case → pick the
  highest-weight unseeded bin.
- Lloyd iterations:
  - assign each bin to the nearest centroid in the working space;
  - recompute weighted means; empty cluster → reassign the centroid to the bin with the
    largest `weight · D²`, then continue;
  - stop when max centroid movement < `1e-4` or `maxIters` reached (default 10 preview,
    30 final).
- Representative = centroid converted to 8-bit sRGB; dedupe exact duplicates.
- Complexity O(M·K·iters). For K=256 and M=32768, cap iterations by a work budget
  (`M·K·iters ≤ 60,000,000`), but never stop based on wall-clock time.
- Label: “Max quality”.

### 6.5 Mapping (`core/map.js`)

#### 6.5.1 Mapper build

```js
buildMapper(palette, { space, bits: 6 }) -> {
  nearest: (r,g,b) -> number,
  candidates: (r,g,b) -> { first, second, probSecond },
  mode: 'exact' | 'lut',
  stats
}
```

- Exact mode: collect exact unique RGB colors while iterating pixels, up to 65,536
  unique colors. If within the cap, map each unique color once by brute force over the
  palette; per-pixel lookup via `Map<packedRgb, index>`. This is the path for pixel art.
- LUT mode: 6 bits/channel → `64³ = 262,144` entries.
  - `nearest: Uint8Array` (palette index).
  - `second: Uint8Array` (second-nearest index, for ordered dithering).
  - `probSecond: Uint8Array` (0..255, `d1/(d1+d2)` scaled).
  - Cell representative = `(v << 2) | 2` (cell center); compute Oklab once per cell.
  - Build in chunks with progress; memory ≈ 0.75 MB.
- Distance in the selected space; tie-break lowest index.
- The mapper stores Oklab for every palette entry once.

#### 6.5.2 Per-pixel mapping

- `alpha < alphaThreshold` → `transparentIndex` (if configured) and skip color mapping.
- Otherwise `index = nearest(r,g,b)`.
- If no transparent index is configured and transparency exists, indexed export MUST reserve
  one instead of blocking: choose the lowest palette index that no opaque pixel uses,
  otherwise the least-used index (ties go to the lowest index). The export result names the
  reserved index, its color, and how many opaque pixels it makes transparent. An explicit
  index always wins.
- Mapping stats: `mode`, per-index counts, build ms.
- QA measures the actual error of the mapped result, including LUT approximation.

### 6.6 Dithering (`core/dither/`)

#### 6.6.1 Shared rules

- Palette compliance is absolute: only palette indices may be emitted.
- Fully transparent pixels are not processed and do not receive error.
- All error math is in the working space (Oklab by default).
- `strength` scales the deviation from the nearest color: 0 = nearest only, 1 = full.
- Strength defaults: Photo 0.8; Pixel Art 0 (none); Retro 16 1.0 (ordered); UI 0.
- Serpentine reverses the x direction on odd rows; mirror kernel x offsets.
- Edge stop reduces diffusion where the local lightness gradient is high:
  `g = max(|L(x+1)−L(x)|, |L(x,y+1)−L(x,y)|)`;
  `factor = 1 − edgeStop · clamp01(g / 0.10)`. Default `edgeStop = 0.5` for photos,
  0 otherwise.
- Error clamp: if `|error| > 0.5` in Oklab, scale the vector to 0.5. This prevents
  runaway artifacts at hard edges.

#### 6.6.2 Error diffusion (`floyd-steinberg`, `atkinson`, `stucki`, `jarvis`, `burkes`, `sierra`)

Kernels (denominator, offsets `(dx,dy): weight`), current pixel at `(0,0)`:

| Kernel | Denominator | Taps |
|---|---:|---|
| Floyd–Steinberg | 16 | (1,0):7, (-1,1):3, (0,1):5, (1,1):1 |
| Atkinson | 8 | (1,0):1, (2,0):1, (-1,1):1, (0,1):1, (1,1):1, (0,2):1 |
| Stucki | 42 | (1,0):8, (2,0):4, (-2,1):2, (-1,1):4, (0,1):8, (1,1):4, (2,1):2, (-2,2):1, (-1,2):2, (0,2):4, (1,2):2, (2,2):1 |
| Jarvis | 48 | (1,0):7, (2,0):5, (-2,1):3, (-1,1):5, (0,1):7, (1,1):5, (2,1):3, (-2,2):1, (-1,2):3, (0,2):5, (1,2):3, (2,2):1 |
| Burkes | 32 | (1,0):8, (2,0):4, (-2,1):2, (-1,1):4, (0,1):8, (1,1):4, (2,1):2 |
| Sierra | 32 | (1,0):5, (2,0):3, (-2,1):2, (-1,1):4, (0,1):5, (1,1):4, (2,1):2, (-1,2):2, (0,2):3, (1,2):2 |

Algorithm:

```
source = Oklab(pixel)
corrected = source + accumulatedError
index = mapper.nearestOklab(corrected)
paletteColor = Oklab(palette[index])
error = (corrected − paletteColor) · strength · edgeFactor
clamp error
for each tap: accumulatedError[next] += error · weight / denominator
```

- Atkinson intentionally diffuses only 6/8 of the error (higher contrast).
- Two error rows are kept (`Float32Array(width·3)` each); rotate per row.
- Default: serpentine on, strength 0.8, edgeStop 0.5 for photos.
- Implementation notes, all of which preserve the algorithm above:
  - `mapper.nearestOklab(corrected)` is a nearest-color cell grid over the working space,
    filled on demand. Oklab uses 128 steps per axis (finer than one sRGB level), sRGB
    reuses the mapper's 6-bit grid. A cell always resolves from its own center, so the
    result does not depend on visit order.
  - Source coordinates come from a 6-bit RGB table per space, built once and cached. A
    per-pixel `rgb8ToOklab` costs three cube roots and gains nothing over the 5-bit
    histogram and 6-bit lookup cells already in use.
  - The error clamp compares squared magnitude and takes one `sqrt` only when it clamps;
    `Math.hypot` costs the same work on every pixel.
  - `strength = 0` returns the plain mapping directly, because no error can leave a pixel.

#### 6.6.3 Ordered (Bayer 2/4/8)

- Bayer matrices are generated recursively:
  `B₁ = [[0]]`;
  `B₂ₙ = [[4Bₙ+0, 4Bₙ+2], [4Bₙ+3, 4Bₙ+1]]`.
- For each pixel, the mapper returns `first`, `second`, `probSecond`.
- Threshold `t = (M[y mod n][x mod n] + 0.5) / n²`.
- Emit `second` when `t < probSecond · strength`, else `first`.
- This is palette-aware and preserves compliance. It is not Yliluoma (deferred).
- Default matrix: 4×4. Pixel-art preset uses Bayer 4×4 at strength 1.

#### 6.6.4 Blue noise

- Mask: `assets/blue-noise-64.bin`, 64×64 bytes, values 0..255, generated by
  `tools/gen-blue-noise.mjs` (void-and-cluster) and committed with a checksum.
- Tile the mask with offset `(x mod 64, y mod 64)`.
- Use the same two-candidate logic as ordered: threshold `mask/255`.
- Mask generation is not a runtime operation.

#### 6.6.5 Defaults (presets are post-1.0)

The table below is a design reference for future presets; v1.0.0 ships the individual
controls only, with no preset picker. The current UI default is **Wu, K=16, Oklab, no
dither, source order, no transparent index**.

| Preset | Method | K | Space | Dither | Strength | Order | Transparent index |
|---|---|---:|---|---|---:|---|---:|
| Photo | Wu | 64 | Oklab | Floyd–Steinberg | 0.8 | lightness | none |
| Pixel Art | Popularity | 16 | sRGB | none | 0 | source | 0 |
| Retro 16 | fixed PICO-8 | 16 | sRGB | Bayer 4×4 | 1.0 | source | 0 |
| Game Sprite | fixed imported | 16 | Oklab | none | 0 | source | 0 |
| UI / Brand | Median cut | 10 | Oklab | none | 0 | lightness | none |

Presets set controls; they do not lock them.

### 6.7 Palette model (`core/palette.js`)

- `createPalette(colors)` assigns stable IDs 1..N and indices 0..N-1 in extraction order.
- `addPaletteEntry`, `updatePaletteEntry`, `removePaletteEntry`, `setPaletteLock`, and
  `movePaletteEntry` return new palettes; IDs survive, indices are reassigned, and exact
  duplicate colors are rejected in the editor.
- Locks pin an entry to its current display slot. Unlocked entries fill the remaining
  slots in the requested order, so a locked color never moves. Locked colors cannot be
  removed; HEX edits keep the lock.
- `sortPalette(palette, order)` returns a new palette; IDs survive, indices are reassigned.
  The strip export and HEX list use this order.
- Perceptual ordering uses pairwise **CIEDE2000** distances and a deterministic path/2-opt
  search. Oklab `L/C/h` remain the keys for `hue-*` and `lightness-*`; the ordering metric
  changes indices, not the nearest-color metric.
- Sort keys:
  - `source`: ID ascending, restoring extraction order after any other sort.
  - `manual`: keep the current array order; the editor’s ← / → buttons move an unlocked
    entry one slot and switch the sort to Manual. A locked entry keeps its slot, so a move
    that would cross it is refused.
  - `lightness-asc` / `lightness-desc`: Oklab L, then hue, then C descending, then ID.
  - `hue-asc` / `hue-desc`: achromatic (`C < 0.02`) first by L in the requested
    direction; chromatic entries form **circular hue bands** and each band is sorted by L
    in the requested direction, then C descending, ID. The sequence starts after the
    largest hue gap, so reds near 0°/360° stay together. A band wider than 30° is split at
    the internal gap that best balances the two halves, with a bias toward wider gaps, so
    a continuous blue-purple region becomes several ramps instead of one L sweep. Both
    modes use the same bands and differ only in the ramp direction.
  - `hue-perceptual-asc` / `hue-perceptual-desc`: the same bands, refined per band by
    deterministic CIEDE2000 2-opt with fixed L seed endpoints. A small DP then chooses
    each band's direction (forward/reverse) to minimize the Delta E at the joins; a band
    may run light-to-dark even in the ascending mode when that keeps the strip continuous.
    The descending mode uses the opposite seed and its own DP.
  - `perceptual`: start from `lightness-asc`, then 2-opt with fixed first/last entries.
    Keeps the Oklab dark-to-light flow and removes local CIEDE2000 jumps.
  - `perceptual-path`: nearest-neighbor path from the darkest to the lightest Oklab L
    entry, then 2-opt with fixed ends. Both directions are tried; the lower total cost
    wins. The fixed-endpoint idea follows
    [colorsort](https://github.com/rowland-208/colorsort).
  - `perceptual-flow`: all-start nearest-neighbor cycle, 2-opt, cut at the largest
    CIEDE2000 edge, then orient dark-to-light by Oklab L. This is DCCW single-palette
    sorting ([Kim & Choi 2021](https://doi.org/10.1145/3450626.3459776)) with
    deterministic 2-opt instead of LKH.
- The sort select shows one row per family: `source`, `manual`, `hue`,
  `hue-perceptual`, `lightness`, `perceptual`, `perceptual-path`, `perceptual-flow`.
  A direction button maps the three directional families to their `-asc`/`-desc` keys
  and is disabled for fixed-direction orders. URLs, sessions, and exports keep the full
  key, so existing links and saved sessions still load.
- `dedupePalette` folds exact RGB duplicates into the first entry and records aliases;
  a “keep duplicates” option is out of scope for v1.
- `paletteHash` covers canonical `{order, space, entries:[{index,rgb,alpha}]}`.
- Locked entries cannot be removed; removing an entry renumbers indices deterministically.

### 6.8 Indexing (`core/map.js`, `core/png/encode.js`)

- Bit depth: `K ≤ 2 → 1`, `K ≤ 4 → 2`, `K ≤ 16 → 4`, `K ≤ 256 → 8`.
- Indices are packed MSB-first within each byte, per the PNG specification.
- `transparentIndex` is validated against `0..K-1`; `-1` means none.
- `tRNS` contains one alpha byte per palette entry: 0 at the transparent index, 255
  elsewhere. No other alpha.
- Index map length MUST equal `width * height`.
- Every index MUST be `< K`.

### 6.9 QA (`core/metrics/`)

Implemented in v1.1 on the preview.

- `computeQuality(original, mapped)` compares source preview RGB with mapped preview RGB
  using CIEDE2000 and skips fully transparent source or mapped pixels.
- Mean is exact; p95 uses a fixed histogram of 0.1-wide buckets from 0 to 200; max is exact.
- Worst pixels: top 20 by ΔE00, tie-break `(y, x)` ascending. The canvas shows them as
  numbered markers matching the list order when the error map is on.
- Error map: RGBA heatmap with a fixed 256-entry ramp, clamped at 20 ΔE00; transparent
  pixels stay transparent. It is drawn on the right half of the workspace canvas, not in a
  separate rail thumbnail.
- The UI measures the preview, not the full-resolution export. Contrast matrices remain
  out of v1.1.

### 6.10 Palette swap preview

- Requires a second palette with the same entry count; otherwise the UI disables the
  preview with an explanatory message.
- Render `newColor = swapPalette[oldIndex].color`; transparent index stays transparent.
- No file export in v1; preview only.

---

## 7. Determinism and reproducibility

### 7.1 Rules

- Seeds: every stochastic step takes `seed` (default `0`), recorded.
- PRNG: `splitmix64` in `core/rng.js`; `Math.random` is forbidden.
- Time: `Date.now()` is forbidden in decisions; timestamps only in metadata, and excluded
  from hashes.
- Sorts: total order with the documented tie-breaks in §6.7 and §6.4.
- Color-assignment decisions (extraction, mapping, dithering) use Oklab; palette
  ordering and QA use CIEDE2000. Both are deterministic and use documented ties.
- Nearest-color ties: lowest palette index.
- K-means: fixed iteration cap and epsilon; no wall-clock stop.
- Float comparisons use `f64`; stored palette values are exact 8-bit.
- Canonical JSON: object keys sorted recursively; no insignificant whitespace.
- Hash: SHA-256 via `crypto.subtle`; fallback FNV-1a 64-bit with a flag.
- `ALGORITHM_VERSION = 3`; bump it when a decision-affecting rule changes.

### 7.2 Guarantee levels

| Scope | Guarantee |
|---|---|
| Same engine, same version, same params/seed | Identical palette, index map, decoded pixels; PNG bytes identical |
| Different engines/versions | Pixel-identical where IEEE-754 math agrees; rare tie flips may occur -> perceptual-equal |
| PNG bytes across browsers | **Not** guaranteed (`CompressionStream` settings are implementation-defined) |

The manifest states the guarantee level. CI golden tests run on one Node version; golden
hashes are reviewed when intentional changes occur.
