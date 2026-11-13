# Color Palette Extraction, Quantization, and Target-Palette Mapping

### A state-of-the-art review and product opportunity analysis, benchmarked against PaletteForge

**Version:** 1.0 · **Date:** 13 November 2026 · **Audience:** product, engineering, and design leadership
**Scope:** algorithmic foundations, dithering and fixed-palette mapping, tool landscape, domain requirements (game development / pixel art, UI-UX, print), and a concrete technical foundation for a new open-source tool.

**Contents:** [Executive Summary](#executive-summary) · [1. Algorithmic Approaches](#1-algorithmic-approaches) · [2. Dithering and Target-Palette Mapping](#2-dithering-and-target-palette-mapping) · [3. Scientific Literature Review](#3-scientific-literature-review) · [4. Landscape](#4-landscape) · [5. Domains](#5-domains) · [6. Technical Foundation](#6-technical-foundation) · [Appendix](#appendix-method-and-evidence-base) · [References](#references)

**Citations:** every bracketed citation number in the text is a clickable link that opens the source directly; full bibliographic details are in [References](#references).

---

## Executive Summary

### The one-sentence finding

**Color quantization is a solved commodity; the unmet need is the handoff** — turning an image into a *stable, reproducible, engine-ready indexed asset and palette artifact* under real constraints (fixed palettes, reserved indices, per-tile banks, batch builds, and perceptual sign-off).

PaletteForge is a well-executed example of the first half of that sentence and a clear illustration of the missing second half. It performs deterministic median-cut quantization in the browser, offers three dithering modes, exports HEX/CSS/JSON/.gpl/.ase plus a reduced PNG, and never uploads the image. Those are genuine strengths. But it has no fixed-palette mapping, no 1×N palette-strip export, no batch mode, no index-stability contract, no spatial constraints, and no perceptual QA report. For a hobbyist making one wallpaper, that is fine. For a game studio shipping 400 sprites across five console-inspired palettes, it is a dead end.

### Benchmark scorecard: PaletteForge

Scores are analyst judgment on a 0–5 scale (0 = absent, 5 = best-in-class among the tools reviewed). They are **not** measured benchmark results.

| # | Criterion | Score | Evidence / rationale |
|---|---|---:|---|
| 1 | Extraction algorithm breadth | 2 | Median cut only; no K-means, octree, Wu, or NeuQuant option. |
| 2 | Perceptual color science | 2 | Weighted-RGB distance; no CIELAB, Oklab, or ΔE<sub>00</sub>. |
| 3 | Dithering options | 3 | None, Floyd–Steinberg, Bayer 4×4; no strength control, blue noise, or palette-aware ordered dithering. |
| 4 | Fixed / target palette mapping | 0 | Cannot load a palette and map to it. |
| 5 | 1×N or N×1 palette-strip export | 0 | Not offered. |
| 6 | Indexed export and index stability | 1 | "Reduced PNG" reduces colors but exposes no index map or stability guarantee. |
| 7 | Batch processing | 0 | Single image per session. |
| 8 | Determinism and reproducibility | 4 | Deterministic median cut; no seed report, algorithm version, or output hash. |
| 9 | Spatial / region awareness | 1 | Error diffusion is spatial; no region, tile, or reserved-index constraints. |
| 10 | Format interoperability | 4 | `.hex`, `.css`, `.json`, `.gpl`, `.ase`; strong for a web tool. |
| 11 | Automation (CLI/API/CI) | 0 | Browser-only. |
| 12 | Perceptual QA and reporting | 0 | No ΔE map, worst-pixel report, or pass/fail budget. |
| 13 | Privacy and local processing | 5 | Client-side; no upload, no account. |
| 14 | UX quality of the tool itself | 4 | Clear before/after slider, low friction, no signup. |
| | **Total** | **26 / 70 (37%)** | Strong consumer utility; weak production handoff. |

### Ten findings that should shape the product

1. **Algorithm choice is no longer the moat.** Median cut, octree, Wu, K-means, and NeuQuant all produce acceptable results at 16–256 colors on photographic content. The 2023 Celebi survey covers four decades of methods, and its breadth is the point: the algorithmic core is well established [[8]](https://link.springer.com/article/10.1007/s10462-023-10406-6). Differentiation must come from constraints, workflow, and guarantees.
2. **K-means is worth offering, but only with a good initialization and a budget.** Celebi's fast variants show that well-initialized K-means is competitive with the best classical quantizers, at higher computational cost [[6]](https://arxiv.org/abs/1101.0395)[[7]](https://arxiv.org/abs/1011.0093). The practical design is: fast preview with median cut/Wu, final pass with K-means or a refinement step, and a hard time budget.
3. **Perceptual distance should be the default, not an option.** Weighted RGB is a 1990s compromise. Oklab gives better hue and lightness behavior for gradients and palette ramps [[22]](https://bottosson.github.io/posts/oklab/); CIEDE2000 remains the reference metric for *reporting* small-patch differences [[21]](https://hajim.rochester.edu/ece/sites/gsharma/ciede2000/)[[10]](https://arxiv.org/abs/2011.12652). Use Oklab to decide, CIEDE2000 to grade. **Caveat:** Maitra's 2026 study finds RGB wins in roughly half of VIF-tested cases [[9]](https://arxiv.org/abs/2601.19117), so the working space must be selectable and recorded, never hard-coded.
4. **Dithering is domain-specific and must be parameterized.** Error diffusion wins on photographs; ordered Bayer wins on pixel art and shader-friendly assets; blue noise wins on animation and gradients because it avoids both crosshatch structure and error-diffusion worms [[16]](https://arxiv.org/abs/2112.09629). A single "dithering: on" toggle is not a product.
5. **The 1×N PNG strip is a real interchange format, not a hack.** Aseprite's CLI accepts `--palette palette.png` and writes indexed sprites [[34]](https://www.aseprite.org/docs/cli/); Godot exposes `GradientTexture1D` with configurable width [[36]](https://docs.godotengine.org/en/stable/classes/class_gradienttexture1d.html); Unity textures can be point-filtered and clamp-sampled for palette lookup [[37]](https://docs.unity3d.com/ScriptReference/Texture2D.html). Shader-based palette swapping is an established technique [[48]](https://github.com/KoBeWi/Godot-Palette-Swap-Shader). Yet almost no web tool emits a strip with a pixel-exact round-trip guarantee.
6. **Fixed-palette mapping is the single biggest missing feature.** Every retro-console workflow, brand-system workflow, and "match this reference palette" workflow needs *map image → given palette*, not *extract palette from image*. PaletteForge cannot do it at all; desktop editors can do it but bury it in a modal and offer no index contract.
7. **Batch plus a manifest is the studio feature.** A palette tool that cannot process a folder, emit a manifest, and reproduce byte-identical output on CI is a toy for teams. The adjacent Tracelyx batch tool is a generic format/resize/EXIF/ZIP utility, not palette-aware, so it does not close this gap.
8. **Index stability is the invisible requirement.** If frame 2 of an animation re-orders palette indices relative to frame 1, the sprite flickers after a palette swap. Stability requires deterministic ordering, palette-aware reindexing, and a documented rule for ties and duplicates.
9. **Licensing constrains the architecture.** libimagequant — the engine behind pngquant and one of the highest-quality readily available quantizers — is GPLv3-or-commercial [[25]](https://github.com/ImageOptim/libimagequant)[[26]](https://github.com/kornelski/pngquant). An MIT/Apache-licensed tool cannot link it into the core. Implement the algorithms independently; offer GPL components only as an optional, clearly separated plugin.
10. **The winning product is a "palette compiler", not another palette extractor.** Inputs: images, target palette, constraints, build profile. Outputs: indexed PNG/atlas, 1×N strip, palette sidecars, ΔE report, manifest with hashes. Interface: web UI for exploration, CLI for CI. That combination does not exist today.

### Recommended product shape (summary)

| Layer | Recommendation |
|---|---|
| Core | Rust library: decode → color-manage → histogram → extract/refine → map → dither → index → encode; deterministic, no GPL. |
| Web | Same core compiled to WebAssembly via `wasm-bindgen`; local-only processing; preview at reduced resolution. |
| CLI | Headless batch, manifest, CI-friendly exit codes, golden-test mode. |
| Differentiators (MVP) | Fixed-palette mapping, 1×N/N×1 strip export with round-trip validation, index stability, batch + manifest, Oklab/ΔE<sub>00</sub> QA. |
| Deferred | Neural quantization, CMYK/spot-color separations, per-tile console banks, plugin SDK. |
| license | Apache-2.0 OR MIT for the core; optional GPL plugin boundary for libimagequant. |

**Bottom line:** build the tool that takes a folder of art and a locked palette and produces provably correct, reproducible, engine-ready assets — with a pretty extractor attached, not the other way round.

---

## 1. Algorithmic Approaches

### 1.0 The problem, stated precisely

Given an image $I$ with $N$ pixels in a color space $S$, and a budget $K$, color quantization seeks a palette $P = \{p_1,\dots,p_K\}$ and an assignment $a: I \rightarrow P$ minimizing a distortion functional:

$$
\min_{P,a} \; \sum_{x \in I} w(x)\, \Delta\big(I(x),\, p_{a(x)}\big)^2
$$

with three practical twists that the textbook formulation hides:

- **$w(x)$ is not uniform.** Alpha, saliency, region masks, and duplicate-pixel compression all change the effective histogram. pngquant, for example, builds a weighted histogram and adjusts it iteratively rather than treating every pixel equally [[26]](https://github.com/kornelski/pngquant).
- **$\Delta$ is not Euclidean RGB.** Perceptual non-uniformity means the optimal palette in RGB is not the optimal palette to a human (§1.3).
- **The objective is not the product requirement.** A game asset may need *index stability across frames*, a UI system may need *contrast guarantees*, and print may need *ink limits*. None of these appear in the equation.

The problem is NP-hard in general (it contains k-means as a special case), so every practical method is a heuristic. The interesting engineering question is therefore not "which heuristic is optimal" but "which heuristic is best under a given constraint set and time budget".

### 1.1 Classic Algorithms

#### 1.1.1 Popularity and uniform quantization

The simplest approach counts colors in a histogram and keeps the $K$ most frequent, optionally merging the remainder into a nearest neighbour. It is O(N), streaming-friendly, and deterministic. It is also visibly bad on photographs: rare but perceptually important colors (specular highlights, saturated accents) are discarded, and flat backgrounds dominate the budget. Uniform quantization — dividing each channel into equal bins — is worse still and is now mainly a teaching example. Both remain useful as fallbacks for extreme speed or for images with genuinely flat color distributions (UI mockups, pixel art).

#### 1.1.2 Median cut (Heckbert, 1982)

Median cut is the canonical splitting method [[1]](https://dl.acm.org/doi/10.1145/800064.801294). Start with one box containing all colors (or the occupied histogram cells). Repeatedly choose a box, sort its colors along its longest channel axis, and split at the median into two boxes, until $K$ boxes exist. Each box becomes a palette entry (usually the mean or the median of its members).

**Strengths:** simple, fast, deterministic, easy to explain, and good enough at 64–256 colors for many images. It adapts to the color distribution rather than a fixed grid.

**Weaknesses:**
- Boxes are axis-aligned in RGB, so correlated channels (skin tones, sky gradients) are split inefficiently.
- Splitting by *range* ignores population density; variants split by variance or by population × variance.
- The median split is greedy and irreversible; early bad splits cannot be repaired.
- Pure RGB median cut produces hue shifts in gradients and poor dark-tone separation.

**Production variants.** pngquant's "modified median cut" selects the box with the largest weighted variance, uses a perceptual histogram, performs a gradient-descent-like adjustment of the histogram, and finishes with a Voronoi/K-means-style correction pass [[26]](https://github.com/kornelski/pngquant). That final refinement is why pngquant output looks materially better than a naive median cut at the same $K$. Any new tool that offers "median cut" should offer this refinement too, or it is shipping a 1982 result in 2026.

#### 1.1.3 Octree quantization (Gervautz & Purgathofer, 1988)

Octree quantization inserts colors into an 8-level tree (one level per bit of each 8-bit channel), accumulating pixel counts at leaves, then reduces the tree by merging the least-populated leaves until $K$ remains [[2]](https://doi.org/10.1007/978-3-642-83492-9_20). It is incremental and streaming: pixels can be added one at a time, which makes it attractive for encoders and constrained-memory devices.

**Strengths:** O(N) with a bounded tree, no need to hold the full histogram, natural progressive refinement, good for GIF/PNG encoders and embedded targets.

**Weaknesses:** the fixed bit-depth geometry is not perceptually motivated; deep, sparse branches can waste budget; merging by population underestimates rare saturated colors; quality at low $K$ is generally below median cut with refinement and well below K-means. ImageMagick's historical default quantizer is octree-based, which is one reason its output can differ noticeably from pngquant's at the same color count [[33]](https://imagemagick.org/script/quantize.php).

#### 1.1.4 K-means, LBG, and sort-means

K-means treats the palette as $K$ centroids and alternates two steps: assign each color to its nearest centroid, then move each centroid to the mean of its members (Lloyd's algorithm). The vector-quantization literature knows the same procedure as the LBG algorithm [[4]](https://doi.org/10.1109/TCOM.1980.1094577). Initialization matters enormously; k-means++ is the standard fix, choosing seeds with probability proportional to squared distance from the current set [[5]](#references).

**Strengths:** directly minimizes the squared-error objective, so at a given $K$ it typically achieves the lowest distortion of the classical family; handles correlated color distributions; naturally supports weighted pixels and arbitrary color spaces.

**Weaknesses:** iterative cost (multiple passes over the histogram), sensitivity to initialization and outliers, empty-cluster handling, and non-determinism if seeds or tie-breaks are not fixed. Naive implementations are too slow for interactive web use on large images.

**The speed literature matters here.** Celebi's fast K-means variants combine data reduction (merging nearby histogram cells), sample weighting, and triangle-inequality bounds to avoid redundant distance computations; the 2011 paper reports that an efficient K-means with a good initialization is competitive with state-of-the-art quantizers in both quality and speed [[6]](https://arxiv.org/abs/1101.0395). The weighted sort-means variant sorts cluster members by distance to exploit bounds further [[7]](https://arxiv.org/abs/1011.0093). The practical recipe for a new tool is therefore: **histogram → reduced weighted sample → k-means++ seeds → Lloyd/sort-means with bounds → optional merge pass**, all under a deterministic seed and an iteration cap.

#### 1.1.5 Wu's moment-based quantizer (1991)

Wu's method builds a 3D histogram, precomputes cumulative moments (count, sum, sum of squares) so that the distortion of any axis-aligned box can be evaluated in O(1), and then recursively splits boxes to minimize the total squared error [[3]](https://doi.org/10.1016/B978-0-08-050754-5.50035-9). It is closer to a globally optimal solution than median cut, remains fast because the expensive statistics are precomputed, and is deterministic.

**Strengths:** near-optimal MSE for a greedy box-splitting scheme, very fast on histograms, no iteration, no seeds.

**Weaknesses:** still axis-aligned in RGB; the moment formulation assumes squared Euclidean error in the working space, so "perceptual Wu" requires computing moments in Oklab (which is possible but changes the arithmetic); no spatial awareness.

Wu is an excellent default for a **fast, deterministic, high-quality** path, and it is available in modern Rust (`quantette` includes a Wu quantizer alongside K-means) [[28]](https://github.com/IanManske/quantette).

#### 1.1.6 NeuQuant and self-organizing maps

NeuQuant (Dekker, 1994) trains a one-dimensional Kohonen network over the color cube: neurons are ordered along a line, and each pixel pulls the winning neuron and its neighbours toward it with a decaying learning rate [[11]](https://doi.org/10.1088/0954-898X_5_3_003). The result is a palette with a smooth one-dimensional ordering — useful for gradients and palette ramps — obtained in a single streaming pass.

**Strengths:** very fast, constant memory, streaming, produces an ordered palette (a real advantage for strip/gradient use), historically important for GIF encoders.

**Weaknesses:** stochastic unless the sampling order and learning schedule are fixed; quality below K-means and refined median cut at the same $K$; the 1D topology imposes an ordering that can hurt photographic accuracy. It is a good *optional* method, not a default.

#### 1.1.7 Agglomerative merging and other families

Pairwise/agglomerative merging starts with the occupied histogram cells and repeatedly merges the two closest clusters, using a priority queue. It produces high-quality palettes but is O(M² log M) in the number of initial cells and needs careful bookkeeping. Genetic algorithms, simulated annealing, particle-swarm optimization, and fuzzy c-means appear in the research literature and occasionally in high-quality offline tools (`rscolorq` uses simulated annealing with tree-structured clustering [[29]](https://github.com/okaneco/rscolorq)); they are too slow for interactive preview and too unpredictable for build pipelines.

#### 1.1.8 Comparison

| Method | Time (typical) | Memory | Quality at K=16–64 | Determinism | Streaming | Best role |
|---|---|---|---|---|---|---|
| Popularity | O(N) | O(bins) | Poor | Yes | Yes | Fallback, flat art |
| Median cut | O(N + K·M log M) | O(M) | Fair–good | Yes | No | Fast preview |
| Median cut + Voronoi refinement | + a few passes | O(M + K) | Good | Yes (fixed seeds) | No | Default fast path |
| Octree | O(N · depth) | O(tree) | Fair | Yes | Yes | Encoders, constrained memory |
| Wu | O(N + M + K·splits) | O(M) | Good | Yes | No | Fast deterministic quality |
| K-means (k-means++) | O(N·K·iters) | O(M + K) | Very good | Yes if seeded | No | Final quality pass |
| Sort-means + bounds | Lower constant than K-means | O(M + K) | Very good | Yes if seeded | No | Production K-means |
| NeuQuant | O(N) | O(K) | Fair | Yes if schedule fixed | Yes | Ordered palette, speed |
| Annealing / genetic | Seconds–minutes | O(M) | Very good (MSE) | Yes if seeded | No | Offline "max quality" |

*M = number of occupied histogram cells (≤ 32,768 at 5 bits/channel); N = pixel count. Quality ratings are qualitative summaries of the cited evaluations, not a single controlled experiment.*

**Design implication:** ship three extraction modes — **Fast (Wu or refined median cut)**, **Balanced (K-means++ with capped iterations)**, and **Max quality (K-means with multi-restart or annealing)** — and make the mode part of the output manifest. Do not expose ten algorithms as a dropdown; expose outcomes.

### 1.2 Neural and Spatial Approaches

#### 1.2.1 Why spatial awareness matters

Quantization error is spatially correlated. A smooth sky quantized to 16 colors produces visible bands; the same error near a high-contrast edge is masked. Human contrast sensitivity is band-limited, so the *perceived* error depends on local structure, not just per-pixel ΔE. Three families exploit this:

1. **Spatial error distribution** — dithering, which trades per-pixel accuracy for low-frequency accuracy (§2.1).
2. **Region-constrained palettes** — different palette subsets for different image regions, tiles, or sprites.
3. **Joint structure/color optimization** — learning or optimizing an index map with a smoothness or edge-preservation prior.

Most consumer tools implement only (1), and often only the simplest version of it.

#### 1.2.2 Learned quantization: ColorCNN and ColorCNN+

ColorCNN (Hou, Zheng, Gould, 2020) learns a soft assignment of each pixel to $K$ color channels, then discretizes the assignment into a palette and an index map, making the whole pipeline differentiable enough to train end-to-end for a fixed $K$ [[12]](https://arxiv.org/abs/2003.07848). ColorCNN+ (2022) extends the approach to improve structure preservation and scaling beyond very small palettes [[13]](https://arxiv.org/abs/2208.08438).

**What it buys:** at extremely small palettes (2–8 colors), learned methods can preserve semantic structure better than error-minimizing quantizers, because they optimize for recognizability rather than pixelwise MSE. That is genuinely useful for logos, icons, e-ink, and stylized art.

**What it does not buy:** exact palette compliance, index stability, determinism, or predictable runtime. The output palette is model-dependent, the method is trained per color count, and there is no mechanism for "map to this exact 16-color palette". For a build tool, these are disqualifying as a *default*. They are credible as an optional "stylize" mode or as a research plugin.

#### 1.2.3 Learned halftoning

Deep-learning halftoning has advanced rapidly: Jiang et al. (2023) formulate halftoning as a sequential decision problem, train a lightweight fully convolutional policy to place dots, and add an anisotropy-suppressing loss that yields a blue-noise character; the reported model is 15× faster than previous structure-aware methods [[17]](https://arxiv.org/abs/2304.12152). Related work uses GANs and diffusion models for stylized halftoning. The lesson for this product is not "ship a neural dither" — it is that **the evaluation metric for dithering must be perceptual and spatially aware**, because per-pixel MSE actively rewards the wrong thing. That principle applies to classical dithers too.

#### 1.2.4 Palette-based decomposition and recoloring

A parallel line of work decomposes an image into a small set of palette layers that can be independently recolored (Chang et al., *Palette-based photo recoloring*, SIGGRAPH 2015 [[57]](https://dl.acm.org/doi/10.1145/2766978)). This is adjacent to quantization but solves a different problem: *editable* palettes rather than compressed indices. It matters for UI/brand workflows, where the deliverable is a recolorable layer stack, not an indexed PNG. A future "palette-aware editing" mode could borrow these ideas, but it is out of scope for the MVP.

#### 1.2.5 Material Palette (premise correction)

*Material Palette* (Lopes, Pizzati, de Charette, 2023) extracts PBR materials — albedo, roughness, metallic, normal — from a single image using a neural pipeline [[14]](https://arxiv.org/abs/2311.17060). It is sometimes mis-cited as a palette-quantization paper because of its name. It is not: it outputs texture maps, not a color palette, and it does not address index mapping or dithering. It is relevant only as evidence that "palette" is an overloaded term and that the product's naming and documentation must be explicit about *color* palettes.

#### 1.2.6 Palette ordering as a first-class problem

Color Orchestra (Phan, Fu, Chan, 2017) learns to order colors within a palette so that interpolation and prediction behave sensibly [[15]](https://arxiv.org/abs/1703.06003). Ordering sounds cosmetic; it is not. It determines:

- whether a 1×N gradient strip produces a smooth ramp or a chaotic sequence;
- whether a palette-swap shader interpolates between two palettes without flashing;
- whether a UI ramp generated from the palette has monotonic lightness;
- whether index-based compression benefits from run-length coherence.

A production tool should therefore treat **palette order** as data, not as an accident of extraction order, and offer explicit orders: extraction order, hue, lightness, custom, and "optimized for interpolation".

#### 1.2.7 Region- and tile-constrained quantization

Real retro hardware does not have one global palette:

- NES: a master set of 54 usable colors, with background and sprite palettes of 3 colors plus transparency;
- Game Boy: 4 shades;
- Commodore 64: a fixed 16-color palette;
- ZX Spectrum: 15 colors (8 hues × 2 brightness levels, plus black);
- EGA: 16 fixed colors; VGA: 256.

A sprite that uses 5 colors across two 4-color sub-palettes is not representable by global quantization. The tool must support **palette banks**, **per-region palette assignment**, and **reserved indices** (index 0 = transparent, index 1 = outline, etc.). No web tool reviewed here does this. Desktop pixel editors approximate it through manual indexed-mode editing, which is exactly the toil a compiler should remove.

#### 1.2.8 Comparison of neural/spatial options

| Approach | Maturity | Determinism | Palette compliance | Runtime | Recommended status |
|---|---|---|---|---|---|
| Error diffusion (spatial) | Production | Yes (fixed scan) | Exact | Fast | MVP |
| Ordered / blue-noise dithering | Production | Yes | Exact | Very fast | MVP |
| Region/tile palettes | Production (manual) | Yes | Exact | Fast | MVP for game mode |
| ColorCNN / ColorCNN+ | Research | No (training, weights) | None | GPU | Deferred / plugin |
| RL halftoning | Research | No | Exact (dot placement) | GPU | Watchlist |
| Palette-based decomposition | Research/production hybrid | Partly | N/A | Medium | Post-MVP editing |
| Annealing index optimization | Production (offline) | Yes if seeded | Exact | Slow | "Max quality" option |

---

### 1.3 Perceptual Spaces & Delta-E

#### 1.3.1 The problem with RGB distance

sRGB values are gamma-encoded, device-referred, and wildly non-uniform [[56]](https://www.w3.org/Graphics/Color/sRGB): a difference of 10 in the green channel is not perceptually equal to a difference of 10 in blue, and Euclidean distance in gamma-encoded RGB over-weights bright regions and under-weights dark ones. Weighting channels ("redmean" or 2:4:3 weights) is a cheap patch, not a solution. Two consequences follow:

- **Palette extraction in RGB wastes entries** on hue regions where the eye is insensitive and under-serves dark tones and saturated blues.
- **Mapping in RGB produces visible errors** that a perceptual metric would have avoided, especially in skin tones and gradients.

The correct pipeline is: decode sRGB to linear light, composite/premultiply alpha explicitly, convert to a perceptual space, quantize there, then encode back. Doing the conversion once per unique color (the histogram), not per pixel, keeps the cost negligible.

#### 1.3.2 Candidate spaces

| Space | Year | Uniformity | Hue behavior | Cost | Strengths | Weaknesses |
|---|---|---:|---|---|---|---|
| sRGB (gamma) | 1996 | Poor | Poor | None | Universal, exact round-trip | Not perceptual |
| Linear RGB | — | Poor | Poor | Low | Physically correct blending | Worse for palette distance |
| CIELAB (L*a*b*) | 1976 | Good | Moderate (blue/purple issues) | Medium | Standard, well understood | Hue non-uniformity, especially blue |
| CIELUV | 1976 | Good | Better for additive light | Medium | Useful for displays | Less common in imaging |
| Oklab | 2020 | Very good | Good | Low–medium | Designed for gradients and interpolation; simple | Young; not an ISO standard |
| CAM16-UCS | 2016 | Very good | Good | High | Accounts for viewing conditions | Complex, slow, overkill |
| IPT | 2006 | Good | Good | Medium | Good for gamut mapping | Less tooling |
| Jzazbz | 2017 | Very good | Good | High | HDR/wide gamut | Overkill for SDR assets |
| HSL/HSV | — | Very poor | Intuitive | None | Human-friendly controls | Not perceptual; lightness lies |
| HSLuv | 2012 | Good | Good | Low | Perceptual HSL-like controls | Niche tooling |

**Recommendation:** **Oklab** as the internal working space [[22]](https://bottosson.github.io/posts/oklab/), with sRGB/linear-RGB available for exactness and CIELAB for compatibility with existing pipelines. Oklab's Cartesian form $(L, a, b)$ is trivial to cluster in, its polar form $(L, C, h)$ is excellent for ramps and hue operations, and its Euclidean distance is a credible perceptual metric for *decisions*. Do not expose the space as a primary UI choice; expose it as an "advanced" setting and record it in the manifest.

#### 1.3.3 ΔE metrics

| Metric | Formula basis | Range (typical) | Use | Cost | Notes |
|---|---|---|---:|---|---|
| ΔE<sub>76</sub> | Euclidean in CIELAB | 0–100+ | Legacy compatibility | Low | Overstates differences in saturated regions |
| ΔE<sub>94</sub> | Weighted L, C, H | 0–100+ | Textiles/legacy | Low | Graphic-arts weights are application-specific |
| ΔE<sub>00</sub> | Full CIEDE2000 with rotation term | 0–100+ | Reference grading | Medium | Best-validated small-patch metric; implementation traps documented by Sharma et al. [[21]](https://hajim.rochester.edu/ece/sites/gsharma/ciede2000/) |
| ΔE<sub>ITP</sub> | ICtCp-based | 0–100+ | HDR | Medium | Not needed for SDR |
| Oklab Euclidean | $\sqrt{\Delta L^2+\Delta a^2+\Delta b^2}$ | 0–1+ | Fast decisions, clustering | Low | Not a standardized ΔE; thresholds are empirical |
| CAM16-UCS ΔE | Full appearance model | 0–100+ | Cross-media | High | Only when viewing conditions are known |

**Practical thresholds (SDR, sRGB, ordinary viewing):**

- ΔE<sub>00</sub> ≈ 1: at or below the just-noticeable difference for many observers;
- 1–2: acceptable for most production work, visible on close inspection;
- 2–5: noticeable side by side, often acceptable in textured areas;
- >5: clearly wrong for a flat color, though potentially masked in high-frequency texture.

These are rules of thumb, not guarantees; Ramella's evaluation of quality measures for color quantization shows that metric rankings depend on the image database and that no single full-reference measure dominates [[10]](https://arxiv.org/abs/2011.12652). That is exactly why the tool should report **several** signals (ΔE<sub>00</sub> mean/p95/max, SSIM, and a spatial error map) rather than a single score.

#### 1.3.4 Alpha, transparency, and premultiplication

Alpha is where naive quantizers break:

- **Transparent pixels have undefined color.** Quantizing premultiplied values drags palette entries toward black; quantizing non-premultiplied values lets invisible RGB influence the histogram. The correct approach is to weight by alpha, ignore fully transparent pixels for palette selection, and preserve exact alpha in the index map (or reserve a transparent index).
- **Semi-transparent edges** need either straight-alpha preservation or a documented compositing background. pngquant's documentation explicitly discusses premultiplied alpha and its handling of edges [[26]](https://github.com/kornelski/pngquant).
- **Reserved transparency index.** Indexed PNG supports a `tRNS` chunk; game engines often expect index 0 to be transparent. The export contract must state which index is transparent and validate it.

#### 1.3.5 Histogram precision and weighted sampling

A 5-bit-per-channel histogram (32³ = 32,768 bins) is the standard compromise: it bounds memory at ~128 KB for 32-bit accumulators and merges imperceptible differences. 6-bit (262,144 bins) improves accuracy at the cost of memory and cache pressure. Two implementation details matter:

- **Bin representatives** should be the weighted mean of the colors in the bin, not the bin center, or dark tones drift.
- **Alpha weighting** and **duplicate-pixel compression** change the effective histogram; the report should state both the pixel count and the unique-color count.

#### 1.3.6 Recommended color-science defaults

| Task | Working space | Metric for decisions | Metric for reporting |
|---|---|---|---|
| Photo → 256 colors | Oklab | Oklab Euclidean | ΔE<sub>00</sub> mean/p95/max |
| Pixel art → 16 colors | Oklab (or sRGB for exact author intent) | Oklab Euclidean | ΔE<sub>00</sub> + exact index diff |
| Brand palette mapping | Oklab | Oklab Euclidean with hue weighting | ΔE<sub>00</sub> + WCAG/APCA contrast |
| Gradient/ramp generation | Oklab polar | ΔL and ΔC | ΔE<sub>00</sub> monotonicity check |
| Print separation | CIELAB / ICC PCS | ΔE<sub>00</sub> | ΔE<sub>00</sub> + ink coverage |

---

## 2. Dithering and Target-Palette Mapping

Dithering and mapping are often conflated. They are separable:

- **Mapping** decides *which palette entry* a pixel (or region) uses.
- **Dithering** decides *how the quantization error is distributed* in space (and time).

A tool can map without dithering (nearest color), dither without a fixed palette (quantize + diffuse), or do both (fixed palette + error diffusion / palette-aware ordered dither). The product must expose both axes independently.

### 2.1 Error Diffusion vs Ordered vs Blue Noise

#### 2.1.1 Error diffusion (ED)

Floyd–Steinberg (1976) is the canonical ED kernel [[18]](#references). For each pixel in scan order: find the nearest palette color, compute the error vector, and push fractions of that error to not-yet-processed neighbours:

```
             X   7/16
     3/16  5/16  1/16
```

Variants distribute error over larger neighbourhoods:

| Kernel | Support | Character | Typical use |
|---|---|---|---|
| Floyd–Steinberg | 2 rows, 4 taps | Sharp, fine-grained; classic | General purpose |
| Jarvis–Judice–Ninke | 3 rows, 12 taps | Smoother, slower, softer | Photographs |
| Stucki | 3 rows, 12 taps | Similar to Jarvis, faster arithmetic | Photographs |
| Burkes | 2 rows, 7 taps | Between FS and Stucki | General purpose |
| Sierra (2/3/4-row) | 2–3 rows | Reduced worm artifacts | Video/gradients |
| Atkinson | 2 rows, 6 taps, 6/8 error | Higher contrast, cleaner highlights | Pixel art, 1-bit |

**Strengths:** excellent low-frequency accuracy; breaks banding; adapts to local error; works with any palette.

**Weaknesses:** characteristic "worms" and structural artifacts; error propagates directionally; sensitive to scan order; can produce noisy flat areas; not trivially parallel; animation flicker unless error is carried across frames or the dither is stabilized.

**Production controls that matter:**
- **Serpentine scanning** (alternate direction per row) reduces directional bias.
- **Error clamping** (e.g., limit error magnitude) prevents runaway artifacts at hard edges.
- **Edge stopping**: reduce or skip diffusion across strong edges, which is what pngquant does by only diffusing in flat, non-edge areas [[26]](https://github.com/kornelski/pngquant).
- **Strength**: scale the diffused error (0–100%); 70–85% is often visually cleaner than 100%.
- **Deterministic jitter**: a fixed seed for randomized ED, recorded in the manifest.

#### 2.1.2 Ordered (Bayer) dithering

Bayer's 1973 construction produces a recursive threshold matrix [[19]](#references). The 4×4 matrix is:

```
 0  8  2 10
12  4 14  6
 3 11  1  9
15  7 13  5
```

For each pixel, compare the quantization error (or the source value) against `(M[y mod n][x mod n] + 0.5) / n²` and choose the lower or upper palette entry accordingly. Larger matrices (8×8) give finer gradation but more visible pattern; smaller matrices (2×2) are coarser but read as texture.

**Strengths:** deterministic, local, parallelizable, shader-friendly, temporally stable, no error propagation, exact palette compliance. It is the right default for pixel art where a visible pattern is acceptable or desirable.

**Weaknesses:** crosshatch/checkerboard structure; resolution-dependent; poor on photographic content unless the matrix is large and the palette rich; naive implementations only handle grayscale or two-level decisions.

**Palette-aware ordered dithering.** Yliluoma's method generalizes ordered dithering to an arbitrary palette: for each pixel, it searches for the pair (or small set) of palette colors whose mixture best approximates the source color at the current threshold, optionally using a sorted palette and a "dithering curve" [[23]](https://bisqwit.iki.fi/story/howto/dither/jy/). The result is dramatically better than naive thresholding for small palettes and is a strong candidate for the pixel-art mode.

#### 2.1.3 Blue-noise dithering

Blue-noise masks have most of their energy at high spatial frequencies, so they look like fine grain rather than crosshatch. The classic generation algorithm is void-and-cluster (Ulichney, 1993) [[20]](https://doi.org/10.1117/12.152707); modern work provides scalar, spatiotemporal, and tileable masks with controlled spectra [[16]](https://arxiv.org/abs/2112.09629).

**Strengths:** no low-frequency structure; excellent for gradients and large flat areas; temporally stable if the mask is static; good perceptual results at moderate palette sizes; tileable and GPU-friendly.

**Weaknesses:** mask generation is non-trivial (precompute and ship a set); naive blue-noise thresholding is still a two-level decision unless combined with palette-aware selection; very fine grain can disappear after texture compression or scaling.

#### 2.1.4 Comparison

| Property | Error diffusion | Ordered (Bayer) | Blue noise |
|---|---|---|---|
| Low-frequency accuracy | Excellent | Good | Very good |
| Visible structure | Worms, directional | Crosshatch | Fine grain |
| Temporal stability | Poor without carry | Excellent | Excellent (static mask) |
| Parallel/shaders | Hard | Trivial | Trivial |
| Pixel-art suitability | Fair (noisy) | Excellent | Good |
| Photographic suitability | Excellent | Fair | Very good |
| Palette compliance | Exact | Exact | Exact |
| Cost | Medium | Very low | Low (lookup) |
| Determinism | Yes (fixed scan/seed) | Yes | Yes |

#### 2.1.5 Evaluation: stop using MSE

MSE and PSNR are actively misleading for dithered images: a dither that looks better can have higher per-pixel error. Use:

- **Low-pass filtered ΔE<sub>00</sub>** (blur at the viewing distance, then compare) — captures the low-frequency accuracy dithering is designed to achieve;
- **SSIM / MS-SSIM** for structure;
- **Banding metrics** (gradient smoothness, false-contour detection);
- **Subjective pairwise tests** for the final calibration, especially for pixel art;
- **Temporal metrics** for animation (flicker energy across frames).

The tool should ship a "QA view" that shows the error map and the blurred error, not just a side-by-side.

#### 2.1.6 Recommended presets

| Domain | Default | Alternatives | Notes |
|---|---|---|---|
| Photograph → PNG | ED (FS or Stucki), serpentine, strength 80%, edge-stopped | Blue noise | Offer "no dither" for flat art |
| Pixel art / sprite | None or Bayer 4×4 | Bayer 8×8, palette-aware ordered | Preserve hard edges; no ED unless requested |
| Gradient / UI | Blue noise (subtle) | Ordered 8×8 at low strength | Avoid banding without texture |
| Animation | Static blue noise or ordered | ED with temporal error carry | Never re-seed per frame |
| 1-bit / e-ink | Atkinson or Bayer 4×4 | Blue noise | Contrast and legibility over accuracy |
| Print | ED in CMYK with dot-gain compensation | AM/FM halftone screens | Different pipeline (§5.3) |

### 2.2 Target-Palette Mapping

#### 2.2.1 The operation

Given an image $I$ and a **fixed** palette $P$ (from a file, a brand system, a console, or a previous extraction), produce an index map $a(x) \in \{1..K\}$ and, optionally, an indexed image. This is the operation that PaletteForge lacks and that every production workflow needs.

Three sub-problems must be separated:

1. **color matching** — which palette color is closest to this pixel?
2. **Error distribution** — do we dither, and with which method?
3. **Index assignment** — which numeric index does each color get, and is that assignment stable across assets?

Most tools conflate all three, which is why their output is hard to automate.

#### 2.2.2 Nearest-color search

For $K \le 256$, brute force is $O(NK)$ and usually fast enough after histogram reduction: 256 distance evaluations per unique color, not per pixel. Optimizations:

- **3D lookup table**: precompute nearest palette index for a 32³ or 64³ grid in Oklab (or sRGB), then trilinear or nearest lookup per pixel. A 32³ table is 32,768 bytes at 1 byte per entry; 64³ is 262,144 bytes. This is the right approach for real-time preview and shader-side mapping.
- **k-d tree / VP tree** for large palettes or high-dimensional metrics; less useful at K ≤ 256.
- **GPU**: a small palette fits in constant/uniform memory; a fragment shader can do the search per pixel, but determinism across GPUs is not guaranteed for floating-point ties. Do the authoritative mapping on the CPU and use the GPU only for preview.

**Tie-breaking must be specified.** Two palette entries can be equidistant (especially with duplicates or symmetric colors). The rule should be "lowest index wins" (or "highest", but documented), because otherwise output depends on iteration order.

#### 2.2.3 Dithering under a fixed palette

- **ED with fixed palette:** identical to normal ED, but the nearest-color step is constrained to $P$. Error is computed in the perceptual space, not RGB.
- **Ordered with fixed palette:** choose between the two nearest palette colors (or a small candidate set) based on the threshold and the error; Yliluoma's method generalizes this [[23]](https://bisqwit.iki.fi/story/howto/dither/jy/).
- **Blue noise with fixed palette:** same candidate logic, with the mask value as the threshold.
- **Constraint-aware:** forbid certain palette entries in certain regions (e.g., no transparency color in the background, no index 0 in sprite pixels), and re-normalize the candidate set.

#### 2.2.4 Index stability

This is the least discussed and most damaging failure mode in production.

Consider a 12-frame walk cycle quantized independently. Frame 1 assigns index 3 to the skin tone; frame 2 assigns index 4 because a tie broke differently or the palette was re-sorted. A shader that swaps palette A for palette B now recolors the skin differently per frame — visible flicker. The same problem appears in UI theming and in atlas generation.

**Mitigations:**

1. **Global palette, per-asset mapping.** Extract or load one palette for the whole asset set, then map each frame to it. Never re-extract per frame unless explicitly requested.
2. **Deterministic ordering.** Sort the palette by a documented key (lightness, then hue, then chroma, then original index) before assigning indices. Preserve the source order when the palette comes from a file and the user asks for it.
3. **Palette-to-palette reindexing.** When the palette changes slightly (one color added), compute an assignment between old and new palettes that minimizes index churn — a linear-assignment problem solvable with the Hungarian algorithm for K ≤ 256, or a greedy match with a distance threshold.
4. **Duplicate handling.** Merge exact duplicates before indexing; if duplicates are intentional (e.g., two entries that must remain distinct for palette cycling), mark them as aliases and keep both indices.
5. **Index map as the source of truth.** Export the index map (or indexed PNG) plus a JSON sidecar listing index → color, so downstream tools never have to re-derive it.
6. **Hash the result.** `sha256(index_map || palette || params)` in the manifest makes regressions detectable in CI.

#### 2.2.5 Constrained mapping

Real briefs include constraints that a nearest-color pass cannot express:

| Constraint | Example | Implementation |
|---|---|---|
| Reserved indices | Index 0 = transparent, index 1 = outline | Pin indices; exclude from matching; validate |
| Per-region palettes | NES background vs sprite banks | Region mask → palette bank → match within bank |
| Max colors per tile | 4 colors per 8×8 tile | Tile-level palette selection + assignment (NP-hard; greedy/ILP for small tiles) |
| Forbidden colors | Brand guidelines exclude a hue | Remove from candidate set; report ΔE impact |
| Contrast requirements | UI text ≥ 4.5:1 | WCAG/APCA check after mapping; adjust role assignment |
| Ink limits | Print TAC ≤ 300% | CMYK separation stage, not RGB quantization |
| Palette cycling | Animated water/lava | Ordered index ranges reserved for cycle frames |

Tile-constrained palette selection is a genuinely hard combinatorial problem. For an 8×8 tile with 4 colors from a 54-color master, exhaustive search is infeasible; a practical approach is to cluster tile colors, score candidate 4-color subsets by ΔE, and use a greedy or beam search with a per-tile budget. This is a strong differentiator for a game-focused tool, but it should be a later milestone, not MVP.

#### 2.2.6 Mapping strategies compared

| Strategy | Quality | Speed | Determinism | Palette compliance | Best use |
|---|---|---|---|---|---|
| Nearest in sRGB | Fair | Very fast | Yes | Exact | Legacy compatibility |
| Nearest in Oklab | Good | Fast | Yes | Exact | Default |
| Nearest + ED | Very good (low-frequency) | Medium | Yes | Exact | Photos, gradients |
| Nearest + ordered/blue noise | Good | Fast | Yes | Exact | Pixel art, shaders |
| Yliluoma ordered | Very good at small K | Medium | Yes | Exact | Restricted palettes |
| MRF/annealing index optimization | Excellent (metric) | Slow | Yes if seeded | Exact | Offline max quality |
| Learned (ColorCNN) | Good for structure | GPU | No | None | Stylization only |

#### 2.2.7 The 1×N / N×1 palette strip contract

A palette strip is an image where each pixel is one palette color. It is the lingua franca between palette tools, pixel editors, and engines. The contract should be explicit:

| Property | Requirement | Rationale |
|---|---|---|
| Dimensions | Exactly `N × 1` or `1 × N` | One pixel per color; no padding, no borders |
| color values | Exact 8-bit sRGB, no color profile, no gamma chunk | Round-trip must be byte-exact |
| Alpha | Opaque unless transparency is explicitly part of the palette | Avoids premultiplication surprises |
| Format | PNG, 8-bit RGB/RGBA (indexed optional) | Universal; lossless |
| Filtering | None | No resampling, no palette bleed |
| Metadata | Optional sidecar `.json` with names/roles | Human and machine readable |
| Order | Documented (source / hue / lightness / custom) | Index stability and gradient behavior |
| Validation | Decode → compare every pixel to the source palette | Catches engine/profile drift |

**Why it matters:** Aseprite's CLI accepts a PNG palette (`--palette pal1.png`), supports indexed color mode and ordered/none dithering, and can batch-process [[34]](https://www.aseprite.org/docs/cli/). Godot's `GradientTexture1D` is a 1D texture with configurable width, ideal for palette lookup [[36]](https://docs.godotengine.org/en/stable/classes/class_gradienttexture1d.html). Unity's `Texture2D` supports point filtering and clamp wrapping, the correct import settings for a palette texture [[37]](https://docs.unity3d.com/ScriptReference/Texture2D.html). Palette-swap shaders sample such a texture by index [[48]](https://github.com/KoBeWi/Godot-Palette-Swap-Shader). The strip is not a convenience; it is the interface.

#### 2.2.8 Export semantics that prevent bugs

- **color space tag**: write sRGB, do not embed a monitor profile.
- **Bit depth**: 8-bit per channel for the strip; indexed 1/2/4/8-bit for sprites, chosen by $K$.
- **`tRNS`**: only when a transparent index is declared; document it [[47]](https://www.w3.org/TR/png-3/).
- **No interlace, no ancillary chunks** that could confuse importers.
- **Deterministic zlib settings** if byte-identical output is a goal (compression level fixed; note that zlib versions can differ).
- **Manifest**: palette hash, params, tool version, source hash, output hash.

---

## 3. Scientific Literature Review

Five papers were selected to cover the foundations, the empirical case for modern clustering, the state of the field, the perceptual-space question, and the neural frontier. Each entry states what the paper actually shows and what it does **not** justify.

### 3.1 Heckbert (1982) — the median-cut foundation

**Citation:** Paul S. Heckbert, *Color Image Quantization for Frame Buffer Display*, SIGGRAPH '82 [[1]](https://dl.acm.org/doi/10.1145/800064.801294).

**Question.** How can a continuous-tone image be displayed on a frame buffer with a small number of colors per pixel, given limited memory and no floating-point hardware?

**Method.** Median cut: recursively split the color space into boxes along the channel with the largest range, at the median of the pixel distribution, until the desired number of boxes is reached; each box contributes one palette entry. Heckbert also discusses popularity and uniform quantization, and evaluates the trade-offs between them.

**Findings.** Median cut adapts to the image's color distribution and substantially outperforms uniform quantization at the same palette size, at low computational cost. The paper established the vocabulary (splitting, box, representative color) that later work still uses.

**Relevance.** It is the algorithm PaletteForge ships, and it remains a credible fast path. It is also the baseline against which every newer method must justify its cost.

**Limitations.** The method is greedy, axis-aligned, and RGB-based; it has no perceptual model, no spatial awareness, and no refinement. Modern variants (variance-based splitting, perceptual histograms, Voronoi post-pass) close much of the quality gap, but those are additions, not the 1982 algorithm.

### 3.2 Celebi (2011) — K-means is competitive if you engineer it

**Citation:** M. Emre Celebi, *Improving the Performance of K-Means for Color Quantization*, arXiv:1101.0395; Image and Vision Computing 29 (2011) 260–271 [[6]](https://arxiv.org/abs/1101.0395).

**Question.** K-means is often dismissed for color quantization because it is slow and initialization-sensitive. Can careful engineering make it competitive with dedicated quantizers?

**Method.** The paper implements fast, exact K-means variants with several initialization schemes, plus data reduction, sample weighting, and triangle-inequality bounds, and compares them against popular quantizers on a diverse image set.

**Findings.** An efficient K-means with an appropriate initialization is competitive with state-of-the-art quantizers in both effectiveness and efficiency. The companion sort-means paper [[7]](https://arxiv.org/abs/1011.0093) pushes the same idea further with weighted sorting and bounds.

**Relevance.** This is the empirical license to offer K-means as a production mode rather than a research curiosity. It also tells you *how*: histogram reduction, weighted samples, good seeds, and bounds — not naive Lloyd over every pixel.

**Limitations.** Results are metric-dependent (typically MSE/PSNR), and the method still has more parameters and more runtime variance than median cut. It does not address palette stability, fixed palettes, or spatial constraints.

### 3.3 Celebi (2023) — forty years, and the algorithmic core is mature

**Citation:** M. Emre Celebi, *Forty years of color quantization: a modern, algorithmic survey*, Artificial Intelligence Review (2023) [[8]](https://link.springer.com/article/10.1007/s10462-023-10406-6).

**Question.** What has the field produced in four decades, and what remains open?

**Method.** A comprehensive survey covering color spaces, color-difference equations, data structures, data reduction, image-independent and image-dependent algorithms, pixel mapping, and fidelity assessment.

**Findings.** The literature contains a large family of clustering, splitting, merging, and neural methods; the survey organizes them and concludes with open problems. Two of its emphases are directly relevant here: **pixel mapping** is treated as a distinct stage, and **fidelity assessment** is treated as a first-class concern rather than an afterthought.

**Relevance.** It is the strongest evidence that the core algorithms are well documented and widely implemented. It also validates the product thesis: the survey's own structure separates palette generation from mapping and evaluation — the exact boundary where existing tools are weakest.

**Limitations.** A survey cannot tell you which method wins on *your* content; that requires a benchmark on representative assets. It is also algorithm-centric, with little coverage of asset-pipeline integration, index stability, or engine formats.

### 3.4 Maitra (2026) — perceptual spaces are not automatically better

**Citation:** Ranjan Maitra, *Optimized k-means color quantization of digital images in machine-based and human perception-based colorspaces*, arXiv:2601.19117 (January 2026) [[9]](https://arxiv.org/abs/2601.19117).

**Question.** Does K-means quantization improve when performed in human-perception spaces (CIE-XYZ, CIE-LUV/CIE-HCL) rather than RGB?

**Method.** K-means at four quantization levels on 148 varied images, in RGB, CIE-XYZ, and CIE-LUV/CIE-HCL, evaluated with Visual Information Fidelity (VIF), plus analysis of hue, chromaticity, and luminance distributions.

**Findings.** The answer is nuanced: in about half the cases RGB is best; at higher $k$, CIE-XYZ often wins; at lower $k$, CIE-LUV sometimes wins. The best space depends on image content and palette size.

**Relevance.** This is a necessary correction to the marketing claim that "perceptual = better". It supports a design in which the working space is **selectable and recorded**, with a sensible default (Oklab for gradient behavior and UI work) and an automatic "try 2–3 spaces, pick the best by a perceptual metric" mode for maximum quality. It also reinforces the need for per-asset QA rather than a global dogma.

**Limitations.** VIF is one metric; the study does not test Oklab/CAM16, does not include fixed-palette mapping, and does not measure subjective preference. Treat it as evidence for *content dependence*, not as a ranking of spaces.

### 3.5 Hou, Zheng & Gould (2020) — learning to quantize with few colors

**Citation:** Yunzhong Hou, Liang Zheng, Stephen Gould, *Learning to Structure an Image with Few Colors*, CVPR 2020, arXiv:2003.07848 [[12]](https://arxiv.org/abs/2003.07848); extended in *…and Beyond*, arXiv:2208.08438 [[13]](https://arxiv.org/abs/2208.08438).

**Question.** Can a neural network choose a palette and assignment that preserves *structure* at extremely small color counts, where MSE-driven methods fail?

**Method.** ColorCNN learns a soft assignment of pixels to $K$ color channels, discretizes it into a palette, and trains end-to-end with a reconstruction objective; the follow-up improves structure preservation and scaling [[13]](https://arxiv.org/abs/2208.08438).

**Findings.** At 2–8 colors, learned quantization can preserve semantic structure (objects, text, faces) better than error-minimizing baselines, because the objective is perceptual/structural rather than pixelwise.

**Relevance.** It defines the credible niche for neural methods: stylization and extreme quantization, not compliant asset production. It also suggests a useful product feature — a "structure-preserving" preview mode — without making it the default pipeline.

**Limitations.** No exact palette compliance, no index stability, no determinism guarantee, per-$K$ training, GPU cost, and model licensing/provenance questions. It cannot answer "map this sprite to the NES palette".

### 3.6 What the literature does not cover

Across these papers, four production concerns are essentially absent:

1. **Fixed-palette mapping under constraints** (reserved indices, banks, per-tile limits).
2. **Index stability across a batch or animation.**
3. **Palette artifact interoperability** (strips, `.gpl`, `.pal`, `.ase`, engine import).
4. **Reproducible builds** (seeds, versions, hashes).

That absence is the product opportunity. The algorithms are documented; the *contract* is not.

---

## 4. Landscape

### 4.1 PaletteForge

**What it is.** A browser-based, single-image palette extractor at [tracelyx.com/tools/paletteforge/](https://tracelyx.com/tools/paletteforge/) [[24]](https://tracelyx.com/tools/paletteforge/). The workflow is deliberately narrow: load an image, choose a color count (2–256), choose a dithering mode (None, Floyd–Steinberg, Bayer 4×4), inspect a before/after slider, export.

**What it does well:**

- **Zero friction.** No account, no upload, no server round-trip. Images are processed locally in the browser.
- **Deterministic output.** The same image and settings produce the same palette, which is more than many competitors can claim.
- **Useful export set.** HEX, CSS, JSON, GIMP `.gpl`, Aseprite `.ase`, and a reduced PNG. The `.ase` and `.gpl` exports are genuinely practical for artists.
- **Clear preview.** The before/after comparison is the right primary interaction for a palette tool.
- **Sensible defaults.** Median cut plus optional Floyd–Steinberg is a reasonable starting point for photographic content.

**What it does not do (verified):**

| Capability | Status | Consequence |
|---|---|---|
| K-means / octree / Wu selection | Absent | No quality/performance trade-off control |
| CIELAB / Oklab / ΔE<sub>00</sub> | Absent | Weighted-RGB matching; hue and dark-tone errors |
| Fixed target palette | Absent | Cannot map to a brand, console, or reference palette |
| 1×N / N×1 strip export | Absent | Manual workaround in an image editor |
| Indexed PNG with index contract | Partial/absent | "Reduced PNG" is not a documented index map |
| Batch processing | Absent | One image at a time |
| Manifest / hashes / seeds | Absent | No reproducible build artifact |
| Spatial or region constraints | Absent | No tile/bank/reserved-index support |
| Perceptual QA report | Absent | No ΔE map or pass/fail budget |
| CLI / API / CI | Absent | Browser-only |
| Palette ordering control | Absent | Order is an artifact of extraction |
| Dither strength / kernel choice | Absent | On/off plus one ordered matrix |

**Assessment.** PaletteForge is a strong *consumer utility* and a weak *production tool*. Its privacy stance and UX are assets worth matching. Its algorithmic and workflow ceiling is low, and the ceiling is not a matter of polish — it is architectural. Adding a fixed-palette mode, a batch queue, and a strip exporter to a single-image median-cut web app is a rewrite of the pipeline, not a feature toggle.

**Competitive lesson.** Do not compete on "extract a palette from a photo". That race is over and the incumbents are free. Compete on "produce the artifacts a production pipeline needs, provably".

### 4.2 Web and Desktop Tools

The landscape splits into four groups: palette *generators* (Coolors, Adobe Color, Huemint), curated *palette libraries* (Lospec), general-purpose *image processors* (ImageMagick, Photoshop, GIMP), and *pixel-art editors* (Aseprite, Pixelorama, Pro Motion NG, Krita).

| Tool | Type | Extraction | Fixed palette | Strip export | Indexed output | Batch | Perceptual metrics | Automation | Notes |
|---|---|---|---|---|---|---|---|---|---|
| **PaletteForge** [[24]](https://tracelyx.com/tools/paletteforge/) | Web | Median cut | — | — | Partial | — | — | — | Local, deterministic, good exports |
| **Coolors** [[43]](https://coolors.co) | Web | — (generator) | — | — | — | — | — | — | Palette ideation, not image quantization |
| **Adobe Color** [[44]](https://color.adobe.com) | Web | Theme extraction | — | — | — | — | — | — | 5-color themes, creative workflow |
| **Huemint** [[45]](https://huemint.com) | Web | — (generative) | — | — | — | — | — | — | Brand/UI palette generation with context preview |
| **Lospec Palette List** [[42]](https://lospec.com/palette-list) | Web | — (library) | Reference | Downloads | — | — | — | — | Curated retro/console palettes |
| **ImageMagick** [[33]](https://imagemagick.org/script/quantize.php) | CLI/library | Many (`-colors`, `-remap`) | Yes (`-remap`) | Manual | Yes | Yes (shell) | Limited | Excellent | Powerful, unfriendly, no strip contract |
| **Aseprite** [[34]](https://www.aseprite.org/docs/cli/)[[35]](https://www.aseprite.org/) | Desktop | From sprite | Yes (`--palette`) | Partial (palette PNG) | Yes | Yes (`-b`) | — | Good (CLI) | Closest to the target workflow |
| **GIMP** [[50]](https://www.gimp.org) | Desktop | Indexed conversion | Yes (palette import) | Manual | Yes | Script-Fu | — | Limited | General-purpose |
| **Krita** [[51]](https://krita.org) | Desktop | Palette docker | Partial | Manual | Partial | — | — | Limited | Painting-first, not asset compilation |
| **Pixelorama** [[52]](https://github.com/Orama-Interactive/Pixelorama) | Desktop | Palette support | Partial | Manual | Partial | — | — | Limited | Open-source pixel editor |
| **Pro Motion NG** [[53]](https://www.cosmigo.com/promotion/index.php) | Desktop | Palette tools | Yes | Manual | Yes | Limited | — | Limited | Strong retro/tile features |
| **Photoshop** | Desktop | Indexed mode | Yes | Manual | Yes | Actions | — | Scripting | Industry standard, expensive |

Legend: **Yes** = documented first-class capability; **Partial** = possible with manual steps or limited scope; **—** = not a documented capability; blank = not assessed.

**Reading the table.** Only Aseprite combines fixed-palette mapping, palette-PNG input, indexed output, and batch CLI. It is a pixel editor, not a palette compiler: it does not do perceptual QA, batch manifests, palette-strip generation as a first-class export, or target-palette optimization across an asset set. ImageMagick is the most automatable, but its interface is a bag of flags and its output contracts are implicit. The web tools are strong at ideation and weak at production. **No tool occupies the "compiler" position.**

---

### 4.3 Libraries

| Library | Language | license | What it provides | What it lacks for this product |
|---|---|---|---|---|
| **libimagequant** [[25]](https://github.com/ImageOptim/libimagequant) | C | **GPLv3 or commercial** | High-quality quantization, alpha handling, dithering, palette generation; the engine behind pngquant | GPL incompatible with MIT/Apache core; no strip/manifest/batch contract; C API |
| **pngquant** [[26]](https://github.com/kornelski/pngquant) | C/CLI | GPLv3 | Production CLI, quality results, indexed PNG | No batch manifest, no fixed-palette-first workflow, no QA report |
| **image-q** [[27]](https://github.com/ibezkrovnyi/image-quantization) | TypeScript | MIT | Wu, NeuQuant, RGBQuant, Riemersma ED, Euclidean/Manhattan/CIEDE2000 | Browser/Node only; no indexed-PNG authoring, no palette contract, no batch |
| **quantette** [[28]](https://github.com/IanManske/quantette) | Rust | Apache-2.0 OR MIT | Fast Wu and K-means, Oklab-native | Quantization only; no dithering, strip, or engine formats |
| **rscolorq** [[29]](https://github.com/okaneco/rscolorq) | Rust | Apache-2.0 | Simulated-annealing quantization with high perceptual quality | Slow; not a pipeline tool |
| **palette** [[30]](https://github.com/Ogeon/palette) | Rust | Apache-2.0 OR MIT | color spaces, conversions, gradients, chromatic adaptation | No quantization |
| **image-rs** [[31]](https://github.com/image-rs/image) | Rust | MIT OR Apache-2.0 | Decoding/encoding, PNG, pixel buffers | No quantization or palette logic |
| **wasm-bindgen** [[32]](https://github.com/rustwasm/wasm-bindgen) | Rust/JS | MIT OR Apache-2.0 | Rust↔JS/WASM bindings | Not a palette tool |
| **Pillow** [[55]](https://pillow.readthedocs.io/en/stable/reference/Image.html) | Python | HPND (MIT-like) | `Image.quantize` (median cut; optional libimagequant), FS dithering | Limited algorithms, no palette contract |
| **scikit-learn** [[46]](https://scikit-learn.org/stable/modules/generated/sklearn.cluster.KMeans.html) | Python | BSD-3-Clause | General KMeans | Not color-aware; per-pixel cost; no palette output |
| **OpenCV** [[54]](https://docs.opencv.org/4.x/d1/d5c/tutorial_py_kmeans_opencv.html) | C++/Python | Apache-2.0 | `kmeans`, image I/O | No palette workflow, no dithering presets |
| **ImageMagick** [[33]](https://imagemagick.org/script/quantize.php) | C/CLI | ImageMagick license (Apache-2.0-like) | Many quantizers, `-remap`, dithering, indexed PNG | Implicit contracts, no QA, shell-only automation |

**Licensing analysis.** This is an architectural constraint, not a footnote:

- **libimagequant is GPLv3-or-commercial.** Linking it into an MIT/Apache binary makes the whole binary GPLv3. For an open-source tool intended for commercial game studios, that is an adoption blocker. The correct options are (a) implement the algorithms independently, (b) ship libimagequant as an optional dynamically-loaded plugin with a clear license boundary and user consent, or (c) dual-license the product. Option (a) is recommended for the core; (b) is acceptable for a "max quality" mode if the packaging is honest.
- **The GPL boundary is legally delicate.** A WASM build statically links everything; there is no dynamic-linking escape hatch in the browser. Do not ship a GPL quantizer inside the WASM bundle unless the whole bundle is GPL.
- **Rust ecosystem is permissive.** `quantette`, `rscolorq`, `palette`, `image`, and `wasm-bindgen` are all Apache/MIT-compatible, which makes a permissive core feasible without writing every algorithm from scratch.
- **Patent risk is low but non-zero.** Classical algorithms are decades old; neural methods carry model-license and training-data provenance risk. Keep neural features out of the core.

**Build-vs-buy recommendation:**

| Component | Decision | Rationale |
|---|---|---|
| Decode/encode PNG | Use `image`/`png` | Mature, permissive, handles indexed output |
| color spaces | Use `palette` | Correct conversions, permissive |
| Wu / K-means | Use `quantette` or port its approach | Permissive, fast, Oklab-aware |
| Median cut | Implement (small) | Needed for compatibility and pedagogy; trivial |
| Dithering | Implement | Kernels are small; need palette-aware and deterministic variants |
| Indexed authoring | Implement | This is the differentiator; no library provides the contract |
| QA metrics | Implement | ΔE<sub>00</sub>, SSIM, error maps; no library fits the UX |
| libimagequant | Optional plugin only | license isolation |

### 4.4 Gap analysis

The gaps below are ranked by **user impact × differentiation × feasibility**. Evidence is drawn from the tool matrix, the PaletteForge audit, and the workflow requirements in §5.

#### G1. No 1×N / N×1 palette-strip export with a round-trip guarantee

**Evidence.** PaletteForge does not offer it. Aseprite accepts a palette PNG but does not generate a standalone strip as a build artifact. ImageMagick can create one with a tortured command line but offers no validation. No web tool reviewed provides "export strip, re-import, assert pixel equality".

**Impact.** Very high. The strip is the handoff format for engine palette lookup, shader swapping, and palette libraries. Manual strip creation is error-prone (wrong dimensions, color profile, filtering, off-by-one).

**Differentiation.** High. A one-click, validated strip with a sidecar is a visible, demoable feature that immediately separates the product.

**Effort.** Low–medium. The hard part is the contract and validation, not the pixels.

#### G2. No fixed target-palette mapping with perceptual matching

**Evidence.** PaletteForge: absent. Web generators: absent. Aseprite/ImageMagick: present but buried, with no quality report or index-stability guarantees.

**Impact.** Very high. Every console/brand/reference workflow needs it.

**Differentiation.** High. "Load your palette, get compliant assets" is the core promise.

**Effort.** Medium. Nearest-color plus dithering is straightforward; index stability and constraints add complexity.

#### G3. No batch processing with a manifest

**Evidence.** PaletteForge is single-image. The adjacent Tracelyx batch tool is a generic format/resize/EXIF/ZIP utility, not palette-aware. ImageMagick can batch via shell, but produces no manifest and no per-file QA.

**Impact.** High for teams, low for hobbyists. Teams are the paying segment.

**Differentiation.** High. Batch + manifest + hashes is the "production" signal.

**Effort.** Medium. Concurrency, error handling, deterministic ordering, and reporting are the work.

#### G4. No spatial, regional, or tile-aware palette constraints

**Evidence.** No consumer tool exposes per-region palettes or reserved indices. Desktop pixel editors allow manual indexed editing, which does not scale.

**Impact.** High for retro/console art, medium for general pixel art.

**Differentiation.** Very high in the game niche; low outside it.

**Effort.** High. Tile-constrained palette selection is combinatorial; start with region masks and reserved indices, defer per-tile optimization.

#### G5. No perceptual QA or pass/fail reporting

**Evidence.** No consumer tool reports ΔE<sub>00</sub>, worst-pixel locations, banding scores, or contrast checks. The literature treats fidelity assessment as a first-class stage [[8]](https://link.springer.com/article/10.1007/s10462-023-10406-6)[[10]](https://arxiv.org/abs/2011.12652); the tools do not.

**Impact.** Medium–high. Studios need sign-off; "looks fine" is not a review artifact.

**Differentiation.** High. A QA report is a credible reason to adopt a new tool even if the quantization is equivalent.

**Effort.** Low–medium. Metrics are well documented; the UX and thresholds are the work.

#### G6. No indexed-workflow fidelity (reserved indices, banks, cycling, aliases)

**Evidence.** Indexed PNG export exists in editors, but the *contract* (which index is transparent, which indices cycle, which are aliases) lives in artists' heads. No tool emits it as machine-readable metadata.

**Impact.** High for game pipelines; medium for UI.

**Differentiation.** High. This is the "boring" feature competitors will not build.

**Effort.** Medium. Data model and validation; the algorithms are easy.

#### G7. No determinism contract or reproducible builds

**Evidence.** PaletteForge is deterministic in practice but publishes no seed, algorithm version, or hash. Most tools do not either. Cross-platform floating-point differences can silently change output.

**Impact.** Medium today, high as soon as assets are generated in CI.

**Differentiation.** Medium–high. "Byte-identical rebuild" is a strong engineering selling point.

**Effort.** Medium. Requires discipline: fixed seeds, stable sorts, documented tie-breaks, golden tests, versioned algorithms.

#### G8. No automation surface (CLI, API, CI, engine plugins)

**Evidence.** PaletteForge is browser-only. Aseprite has a CLI but is an editor. ImageMagick is scriptable but contract-poor.

**Impact.** High for teams.

**Differentiation.** High. A CLI is table stakes for "production tool" positioning.

**Effort.** Low–medium with a Rust core; the CLI is a thin layer over the library.

#### Priority matrix

| Gap | Impact | Differentiation | Effort | Priority |
|---|---:|---:|---:|---|
| G1 Strip + validation | 5 | 5 | 2 | **P0** |
| G2 Fixed-palette mapping | 5 | 5 | 3 | **P0** |
| G3 Batch + manifest | 4 | 4 | 3 | **P0** |
| G7 Determinism contract | 3 | 3 | 3 | **P1** |
| G5 Perceptual QA | 4 | 4 | 2 | **P1** |
| G6 Indexed fidelity | 4 | 4 | 3 | **P1** |
| G8 CLI/CI | 4 | 3 | 2 | **P1** |
| G4 Spatial/tile constraints | 4 | 5 | 5 | **P2** |

**Why now.** Three trends converge: (a) the indie/retro game market keeps growing, and engines make palette-swap shaders easy; (b) design systems need token-ready palettes with contrast guarantees; (c) WASM makes local, private, high-performance image processing viable in the browser. The algorithms are free; the workflow is not.

---

## 5. Domains

### 5.1 Game Development and Pixel Art (incl. 1×N PNG)

#### 5.1.1 The workflow the tool must fit

A typical sprite pipeline looks like this:

1. **Concept / reference** — mood board, existing palette, or console target.
2. **Palette lock** — choose or author the palette; freeze it for the asset set.
3. **Sprite authoring** — draw in indexed mode or in RGB against the palette.
4. **Quantization / cleanup** — map imported art to the palette; remove stray colors.
5. **Validation** — check color count, transparency, index roles, contrast/readability.
6. **Atlas / export** — pack frames, emit PNG + index metadata + palette.
7. **Engine import** — point filtering, no mipmaps, lossless compression, palette texture.
8. **Runtime** — palette swap, recolor, cycling, team colors.

Steps 2, 4, 5, 6, and 8 are where existing tools fail. The compiler should own 2–6 and emit artifacts that make 7–8 trivial.

#### 5.1.2 Hardware and palette constraints

These are the constraints that make generic quantization insufficient. Values are the commonly cited hardware limits; verify against the target platform's documentation before shipping a compliance claim.

| Platform | Master colors | Simultaneous / structural constraint | Implication for the tool |
|---|---|---:|---|
| NES | 54 usable (from a 64-entry master) | 4 background palettes × 3 colors + backdrop; 4 sprite palettes × 3 colors + transparent | Palette banks, reserved transparent index, per-region assignment |
| Game Boy (DMG) | 4 shades | 4 simultaneous | 4-color mapping, ordered dithering for tone |
| Game Boy Color | 32,768 | 8 background palettes × 4; 8 sprite palettes × 4 (index 0 transparent) | Bank-aware mapping, per-tile palette selection |
| Commodore 64 | 16 fixed | 16 simultaneous | Fixed-palette compliance, no dithering in flat art |
| ZX Spectrum | 15 | 8 hues × 2 brightness + black; attribute clash per 8×8 cell | Per-cell color limits, attribute-aware mapping |
| EGA | 16 fixed (from 64) | 16 simultaneous | Fixed palette, index stability |
| VGA mode 13h | 262,144 | 256 simultaneous | 256-color palette, cycling ranges |
| PICO-8 | 16 fixed | 16 simultaneous | Exact palette, index roles |
| Amstrad CPC | 27 | 16 inks in mode 0 (4 in mode 1, 2 in mode 2) | Per-mode constraints |
| MSX | 16 fixed | 16 simultaneous | Fixed palette |
| Modern engines | Unlimited | Target 16–256 for style and memory | Style palettes, atlas consistency |

**Design consequence:** the data model needs **palette banks**, **per-region bank assignment**, **reserved indices**, and **per-tile color budgets** — not just a flat list of $K$ colors. Even if the MVP ships only flat palettes, the internal model must not preclude banks.

#### 5.1.3 The 1×N PNG strip in detail

**Format.** `N × 1` (horizontal) or `1 × N` (vertical), 8-bit RGB or RGBA, one pixel per palette entry, no filtering, no embedded profile, no ancillary chunks beyond what the engine needs.

**Why horizontal by default.** Most engines and shaders index a 1D texture along U; a horizontal strip maps naturally to `u = (i + 0.5) / N`. Vertical strips are useful for `GradientTexture1D`-style vertical gradients and for tools that expect a column. Offer both, default horizontal, and make the orientation explicit in the filename (`palette_16x1.png`, `palette_1x16.png`).

**Generation algorithm.** Trivial but easy to get wrong:

```
for i in 0..N:
    pixel[i] = palette[i]        # exact 8-bit values, no interpolation
write PNG(width=N, height=1, color_type=RGB/RGBA, bit_depth=8)
```

The hard parts are the surrounding guarantees:

- **Exactness:** no color management, no gamma chunk, no quantization of the strip itself.
- **Order:** documented and reproducible; expose `source`, `hue`, `lightness`, `custom`.
- **Alpha:** opaque by default; if the palette includes transparency, write RGBA and document the alpha semantics.
- **Validation:** decode the written file and compare each pixel to the source palette; fail the build on mismatch.
- **Sidecar:** `palette.json` with `{name, index, hex, role, aliases}`; optional `.gpl`, `.pal`, `.ase`.

**Engine notes.**

- **Aseprite** accepts a PNG palette directly: `--palette palette.png`, combined with `--color-mode indexed`, `--dithering-algorithm ordered|none|old`, `--dithering-matrix bayer2x2|bayer4x4|bayer8x8`, and `-b` for batch [[34]](https://www.aseprite.org/docs/cli/). A single-file invocation:

  ```
  aseprite -b sprite.png \
    --palette palette_16x1.png \
    --color-mode indexed \
    --dithering-algorithm ordered \
    --dithering-matrix bayer4x4 \
    --save-as sprite_indexed.png
  ```

  (Line continuations shown for readability; use the platform's shell syntax.)

- **Godot** exposes `GradientTexture1D` with a `gradient` and a `width` property (default 256), which is a natural palette lookup texture [[36]](https://docs.godotengine.org/en/stable/classes/class_gradienttexture1d.html). Import the strip with filter **off**, mipmaps **off**, and lossless compression. In a shader, sample at `vec2((float(index) + 0.5) / float(N), 0.5)` to avoid bleeding between entries.
- **Unity** `Texture2D` supports `FilterMode.Point`, `TextureWrapMode.Clamp`, and `mipmapEnabled = false`; these are the correct settings for a palette texture [[37]](https://docs.unity3d.com/ScriptReference/Texture2D.html). Ensure the texture is not sRGB-converted twice: palette lookup is a data fetch, not a color blend.
- **Shader palette swap** is a well-established pattern: store an index map, sample the palette texture by index, and swap the palette texture to recolor [[48]](https://github.com/KoBeWi/Godot-Palette-Swap-Shader).

**Pitfalls checklist:**

| Pitfall | Symptom | Fix |
|---|---|---|
| Bilinear filtering | colors blend at index boundaries | Point/nearest filtering; half-texel offset |
| Mipmaps | Distant sprites sample averaged palette colors | Disable mipmaps for the palette texture |
| sRGB decode | Palette colors shift after import | Treat as data; document color space |
| Compression | Index values drift (especially BC/DXT) | Lossless/uncompressed |
| Wrong dimensions | Off-by-one sampling | Assert `width == N`, `height == 1` |
| color profile | Engine applies a profile | Strip ICC chunks; write sRGB |
| Premultiplied alpha | Transparent entries darken | Opaque strip; handle alpha in the sprite |
| Row padding | Extra pixels at the end | No padding; exact dimensions |

#### 5.1.4 Index stability across frames and assets

The failure mode is concrete: a 10-frame animation, each frame quantized independently, produces palettes in different orders. A palette-swap shader that maps index 5 to "team red" now hits a different material in each frame. The sprite flickers.

**The contract:**

- One palette per asset set (or per bank), extracted once and locked.
- A deterministic index order, recorded in the manifest.
- A per-frame index map that is validated against the locked palette.
- A palette-diff report when the palette changes: added, removed, moved indices, and the affected pixels.

**Implementation:** keep the palette as an ordered list with stable IDs; map colors to IDs, not to positions; derive positions only at export. When a palette entry is inserted, compute a minimum-churn reindex (Hungarian for small $K$) and write both the old→new mapping and a compatibility flag.

#### 5.1.5 Batch, atlases, and CI

A studio batch looks like: 300 sprites, 5 palettes, 3 platforms, 2 resolutions. The tool should accept a job file:

```yaml
palette: palettes/nes.png
space: oklab
dither: bayer4
constraints:
  transparent_index: 0
  max_colors_per_tile: 4
outputs:
  - format: indexed_png
    path: build/{platform}/{name}.png
  - format: palette_strip
    path: build/{platform}/palette_{n}x1.png
  - format: manifest
    path: build/manifest.json
```

and produce a manifest with per-file hashes, ΔE statistics, palette hash, tool version, and a pass/fail status. Exit non-zero on contract violations (wrong color count, missing transparent index, ΔE over budget). That is what makes it usable in CI.

#### 5.1.6 Acceptance tests for the game mode

1. **Exact palette compliance:** every pixel of the output is in the target palette.
2. **Index round-trip:** decode the indexed PNG, compare indices to the generated index map; equality required.
3. **Strip round-trip:** decode the strip, compare pixel values to the palette; equality required.
4. **Transparency:** index 0 (or the declared index) is transparent; no other index is.
5. **Stability:** re-running with the same inputs and seed produces byte-identical outputs (or a documented, hash-equal exception).
6. **Animation consistency:** all frames share the palette hash and index semantics.
7. **Engine import:** Godot/Unity import with the documented settings yields the expected colors (manual or automated smoke test).

### 5.2 UI/UX

#### 5.2.1 What is different from image quantization

UI palettes are small (5–20 colors), semantic (surface, on-surface, primary, accent, error, success), and constrained by accessibility. Dithering is almost always wrong: it adds texture to flat panels and breaks at different pixel densities. The hard problems are **role assignment**, **contrast**, **dark-mode derivation**, and **token export**, not color reduction.

#### 5.2.2 Pipeline

1. **Ingest** — screenshot, brand board, or existing CSS/JSON.
2. **Extract** — quantize in Oklab with a small $K$ (6–12), weighting large flat regions; optionally seed with known brand colors.
3. **Assign roles** — cluster by lightness and chroma; map to semantic roles; let the user override.
4. **Repair contrast** — adjust lightness/chroma minimally to meet WCAG 2.2 (4.5:1 for normal text, 3:1 for large text and UI components) [[38]](https://www.w3.org/TR/WCAG22/); report APCA Lc as a second opinion [[39]](https://github.com/Myndex/SAPC-APCA).
5. **Generate scales** — 50–900 ramps in Oklab with monotonic lightness; avoid the "muddy middle" produced by naive RGB interpolation [[22]](https://bottosson.github.io/posts/oklab/).
6. **Export** — DTCG JSON [[40]](https://tr.designtokens.org/format/), CSS custom properties, Tailwind config [[41]](https://tailwindcss.com/docs/colors), and a human-readable sheet.
7. **Validate** — contrast matrix, color-blind simulation, dark-mode parity.

#### 5.2.3 Role assignment and contrast repair

A practical algorithm:

- Sort clusters by lightness; identify the lightest and darkest as background/foreground candidates.
- Assign the most chromatic cluster to `primary`; the second to `accent`.
- Compute contrast for each text-on-surface pair; if below target, move the text color along the lightness axis in Oklab until it passes, then reduce chroma only if necessary.
- Preserve hue: naive clamping in RGB shifts hue and looks wrong; Oklab's lightness/chroma separation makes minimal repairs possible.
- Report the repair: "on-primary changed from #FFF to #F2F2F2 to reach 4.6:1; ΔE<sub>00</sub> = 1.8".

**Warning:** WCAG 2.x contrast is luminance-based and known to be imperfect for dark colors and saturated hues; APCA is the proposed successor but is not yet a normative standard. Ship both, label them, and do not claim "accessible" on the basis of a single number.

#### 5.2.4 Tokens and ordering

Design-token formats are converging on the DTCG specification [[40]](https://tr.designtokens.org/format/). A palette export should be role-based, not index-based:

```json
{
  "color": {
    "surface":  { "$value": "#0B0D10", "$type": "color" },
    "on-surface": { "$value": "#F5F7FA", "$type": "color" },
    "primary":  { "$value": "#3B82F6", "$type": "color" }
  }
}
```

Keep the raw palette as a separate artifact (`palette.hex`, `palette.json`) so designers can use it without the semantic layer.

#### 5.2.5 Recommended settings

| Setting | UI recommendation | Why |
|---|---|---|
| color count | 6–12 | Enough for roles, few enough to govern |
| Working space | Oklab | Smooth ramps, predictable lightness |
| Dithering | None (blue noise only for large gradients, ≤20% strength) | Texture is undesirable in flat UI |
| Ordering | Lightness, then hue | Predictable scales and dark mode |
| QA | WCAG 2.2 + APCA + ΔE<sub>00</sub> | Legal, perceptual, and brand checks |
| Export | DTCG JSON, CSS vars, Tailwind | Fits existing toolchains |

### 5.3 Print

#### 5.3.1 Why RGB quantization is the wrong model

Print is subtractive, device-dependent, and ink-limited. A 16-color RGB palette is meaningless on a press: the press has CMYK inks (plus optional spots), a gamut smaller than sRGB in some regions and larger in others, dot gain, and a total-area-coverage limit. The correct pipeline is:

1. **color-manage** the source into a working space (typically CIELAB or the ICC profile connection space).
2. **Convert to the output CMYK profile** with an explicit rendering intent (perceptual for images, relative colorimetric for logos) and black point compensation [[49]](https://www.color.org).
3. **Limit total area coverage** (commonly 240–300% depending on stock/process).
4. **Separate spot colors** if the design uses them (1–4 is typical; Pantone is the common reference).
5. **Halftone** with AM or FM screens, accounting for dot gain.
6. **Proof** (soft proof with the output profile; hard proof where color is critical).

#### 5.3.2 What "palette" means in print

- **Process palette:** the CMYK channels; "quantization" is really separation and black generation (GCR/UCR).
- **Spot palette:** a small set of premixed inks; the design constraint is "use at most N spots", which is a palette problem with an ink-cost objective.
- **Brand palette:** specified in a color system (Pantone, RAL, custom); conversion to CMYK is profile-dependent and must be documented.

A print-aware tool would extract a **spot-color set** from artwork, estimate coverage, and warn about out-of-gamut colors. That is a different product from RGB quantization; it belongs in a later milestone.

#### 5.3.3 Dithering vs halftoning

Do not apply screen-space error diffusion to a 300 DPI print image and call it halftoning. Print halftoning is a rendering step performed by the RIP, at the device resolution, with dot gain compensation. If the tool dithers before separation, it can create moiré and unreasonable ink coverage. The correct division of labor:

- Tool: color separation, gamut mapping, spot assignment, TAC check.
- RIP: halftone screening, dot gain, registration.

#### 5.3.4 Recommended settings

| Setting | Print recommendation |
|---|---|
| Working space | CIELAB / ICC PCS |
| Output | CMYK profile for the target stock/process |
| Intent | Perceptual (images), relative colorimetric (logos) |
| Black point compensation | On (unless the profile says otherwise) |
| TAC limit | Configure per process (e.g., 300% coated, 240% newsprint) |
| Spots | Explicit list with alternates |
| Dithering | None in the tool; halftone at the RIP |
| Proof | Soft proof + hard proof for brand colors |
| QA | ΔE<sub>00</sub> against the proof, ink coverage, out-of-gamut report |

**MVP decision:** ship RGB/indexed workflows first. Print is a separate product surface with different color science, file formats (PDF/X, TIFF), and validation. Promising print support without a color-managed pipeline would be worse than not offering it.

---

## 6. Technical Foundation

### 6.1 Architecture principles

1. **One deterministic core, many thin surfaces.** The Rust library owns every decision; the web UI and CLI are adapters. No algorithm lives in TypeScript.
2. **Local-first.** No uploads, no accounts, no telemetry by default. The WASM build must be fully functional offline after load.
3. **Contracts over options.** Every output has a documented, validated contract (dimensions, color space, index semantics, hashes). Options are fewer and better explained.
4. **Permissive by default.** Apache-2.0 OR MIT core; GPL components only behind an explicit, optional plugin boundary.
5. **Reproducible.** Seeds, versions, stable ordering, and hashes are part of the output, not an afterthought.

```
┌──────────────────────────── surfaces ────────────────────────────┐
│  Web UI (TypeScript)   │   CLI (clap)   │   CI / API   │ Plugins │
└───────────┬────────────┴────────┬───────┴──────┬───────┴────┬────┘
            │                     │              │            │
            └─────────────────────▼──────────────▼────────────┘
                             palette-core (Rust)
  decode → normalize → analyze → palette → map → dither → index → encode → report
                                      │
                    ┌─────────────────┼──────────────────┐
                    ▼                 ▼                  ▼
              extractors         constraints         metrics
         (median/Wu/k-means)  (banks, reserved)   (ΔE00, SSIM, maps)
```

### 6.2 Pipeline stages

| Stage | Input | Output | Key decisions | Failure modes |
|---|---|---|---|---|
| Decode | PNG/JPEG/WebP | RGBA8 + metadata | Bit depth, ICC, EXIF orientation | Corrupt files, decompression bombs |
| Normalize | RGBA8 | Linear RGBA + Oklab | Profile → sRGB, premultiply policy | Double gamma, alpha fringes |
| Analyze | Pixels | Weighted histogram | 5/6-bit bins, alpha weights, region masks | Bin drift, transparent-pixel pollution |
| Palette | Histogram | Ordered palette | Algorithm, $K$, space, seeds, refinement | Local minima, duplicate entries |
| Map | Image + palette | Index map | Metric, tie-break, constraints | Ties, out-of-gamut colors |
| Dither | Image + palette + map | Dithered index map | Kernel, strength, scan, mask | Worms, flicker, palette violation |
| Index | Palette + map | Indexed image | Bit depth, reserved indices, `tRNS` | Wrong transparent index |
| Encode | Indexed image | PNG + sidecars | Compression, chunks, deterministic zlib | Profile/metadata leakage |
| Report | Everything | JSON + previews | Metrics, thresholds, hashes | Metric mismatch vs perception |

### 6.3 Data model (Rust sketch)

```rust
pub struct Rgba8 { pub r: u8, pub g: u8, pub b: u8, pub a: u8 }

pub struct Oklab { pub l: f32, pub a: f32, pub b: f32 }

pub struct PaletteEntry {
    pub id: u32,              // stable identity, survives reordering
    pub index: u8,            // export position, 0..=255
    pub color: Rgba8,
    pub oklab: Oklab,
    pub name: Option<String>,
    pub role: Option<Role>,   // Surface, Text, Primary, Accent, ...
    pub aliases: Vec<u8>,     // duplicate/cycling indices
}

pub struct Palette {
    pub entries: Vec<PaletteEntry>,
    pub order: PaletteOrder,  // Source | Hue | Lightness | Custom
    pub space: Space,         // Oklab | Srgb | Lab
}

pub struct IndexMap {
    pub width: u32,
    pub height: u32,
    pub indices: Vec<u8>,     // row-major, one byte per pixel
}

pub struct QuantizeParams {
    pub colors: u16,
    pub method: Method,       // MedianCut | Wu | KMeans | NeuQuant
    pub space: Space,
    pub seed: u64,
    pub max_iters: u16,
    pub refine: bool,
}

pub struct Report {
    pub palette_hash: String,
    pub output_hash: String,
    pub delta_e_mean: f32,
    pub delta_e_p95: f32,
    pub delta_e_max: f32,
    pub worst_pixels: Vec<(u32, u32)>,
    pub warnings: Vec<Warning>,
}
```

**Why stable IDs.** Palette entries are reordered for export, merged, split, and compared across builds. Indexing by position makes every operation fragile; a monotonic `id` plus an explicit `index` separates identity from presentation.

### 6.4 Determinism rules

Determinism is a feature with a spec:

- **Seeds:** every stochastic step takes an explicit `u64` seed (default 0), recorded in the manifest.
- **Ordering:** all sorts use a total order with a documented tie-break (e.g., lightness, hue, chroma, original index). Never rely on unstable sort or hash-map iteration.
- **Numeric:** prefer `f32` for speed but avoid fast-math and FMA contraction in decisions that affect ties; if cross-platform bit-exactness is required, quantize distances or use `f64` for comparisons. Document the guarantee level: *same-platform byte-identical* vs *cross-platform perceptual-equal*.
- **Iteration:** K-means uses a fixed iteration cap and a convergence epsilon; no wall-clock-dependent stopping.
- **Parallelism:** parallel reductions must be order-independent (sum in a fixed tree, not atomic float adds).
- **Versions:** the manifest records `core_version`, `algorithm_version`, and `params_hash`. A change in tie-breaking bumps the algorithm version.
- **Tests:** golden outputs per platform; a hash mismatch fails CI.

### 6.5 Performance targets

These are **engineering targets**, not measured results. They assume a modern laptop, a warm cache, and release builds.

| Workload | Native target | WASM target | Notes |
|---|---:|---:|---|
| Decode 1024² PNG | 25 ms | 50 ms | `image`/`png`, no color management |
| Histogram 1024² | 15 ms | 30 ms | 5-bit bins, alpha-weighted |
| Wu, K=16 | 8 ms | 15 ms | Moment precompute dominates |
| K-means, K=16, 10 iters | 40 ms | 80 ms | 32k bins, bounds |
| Map 1024², K=16 | 10 ms | 20 ms | LUT |
| Floyd–Steinberg 1024² | 60 ms | 120 ms | Sequential, cache-friendly |
| Encode indexed PNG 1024² | 30 ms | 60 ms | zlib level fixed |
| **End-to-end 1024², K=16** | **~200 ms** | **~400 ms** | Interactive |
| **End-to-end 4096², K=64** | **~2.5 s** | **~5 s** | Use preview downscale in UI |

**UI strategy:** preview at ≤1024 px on the long edge with a fast method; run the final pass at full resolution on demand, in a worker, with progress. Never block the main thread; never silently downscale the final output.

### 6.6 CLI and API surface

```
# Extract a palette
palettec extract photo.png -k 24 --space oklab --method kmeans --seed 42 -o palette.json

# Map to a fixed palette and write an indexed PNG
palettec map sprite.png --palette nes.png --dither bayer4 --format indexed-png -o sprite_idx.png

# Generate and validate a 1xN strip
palettec strip palette.json --layout 1xN -o palette_16x1.png --validate

# Batch with a manifest and a QA budget
palettec batch art/ --palette pico8.gpl --manifest build/manifest.json --fail-on-deltae 5

# Verify an existing build
palettec check build/ --palette pico8.gpl --strict
```

**Exit codes:** `0` success, `2` invalid input, `3` contract violation (palette mismatch, wrong index), `4` QA budget exceeded, `5` internal error. Stable exit codes make CI integration trivial.

**API shape:** a small number of verbs (`extract`, `map`, `strip`, `batch`, `check`), each with explicit inputs/outputs and a `--json` report. Avoid a flag for every algorithm; use presets plus advanced overrides.

### 6.7 File formats

| Format | Direction | Purpose | Notes |
|---|---|---|---|
| PNG (indexed 1/2/4/8-bit) | Out | Engine-ready sprites | `PLTE`, optional `tRNS`, no profile [[47]](https://www.w3.org/TR/png-3/) |
| PNG (RGB/RGBA) | Out | Strip, previews | Exact 8-bit values |
| `.gpl` | In/Out | GIMP, Krita, Inkscape | Text, widely supported |
| `.pal` (JASC) | In/Out | Paint Shop Pro, editors | Text, simple |
| `.hex` | In/Out | Lospec-style lists | One color per line |
| `.ase` | Out | Aseprite palette | Binary; verify with Aseprite |
| `.json` (native) | Out | Manifest + palette | Stable schema, versioned |
| `.json` (DTCG) | Out | Design tokens | Roles, `$type: color` [[40]](https://tr.designtokens.org/format/) |
| `.css` | Out | Custom properties | `--color-primary: #...` |
| Tailwind config | Out | Utility classes | Palette scales [[41]](https://tailwindcss.com/docs/colors) |

### 6.8 Testing strategy

| Layer | What | How |
|---|---|---|
| Unit | color conversions, ΔE<sub>00</sub> reference pairs, kernel weights | Known-answer tests from Sharma et al. [[21]](https://hajim.rochester.edu/ece/sites/gsharma/ciede2000/) |
| Property | Round-trip sRGB↔Oklab, index map ↔ indexed PNG | `proptest` |
| Golden | End-to-end outputs for a fixed corpus | Hash + perceptual hash; review on change |
| Fuzz | Decoders, malformed PNG/JPEG | `cargo-fuzz`, sandboxed |
| Cross-platform | Determinism | CI matrix (Linux/macOS/Windows), compare hashes |
| Visual | Dithering and banding | ΔE maps, SSIM, human review |
| Engine smoke | Godot/Unity import | Headless projects with pixel assertions |
| Performance | Regression budgets | Criterion benchmarks, fail on >15% regression |

### 6.9 Privacy and security

- **No uploads.** The web build runs entirely in the browser; the CLI makes no network calls.
- **No telemetry by default.** If added later, it must be opt-in and documented.
- **WASM sandbox.** Memory limits, no filesystem access beyond explicit user gestures.
- **Decompression bombs.** Cap dimensions and pixel count; reject pathological PNGs before allocation.
- **Metadata hygiene.** Strip EXIF, ICC (unless explicitly preserved), and comments from outputs by default.
- **Supply chain.** `cargo-deny` for licenses and advisories; pinned dependencies; reproducible builds.

### 6.10 Licensing

| Component | license | Compatible with Apache/MIT core? |
|---|---|---|
| Core (original code) | Apache-2.0 OR MIT | Yes |
| `quantette` | Apache-2.0 OR MIT | Yes |
| `rscolorq` | Apache-2.0 | Yes |
| `palette`, `image`, `wasm-bindgen` | Apache-2.0 OR MIT | Yes |
| `image-q` (if ported) | MIT | Yes (with attribution) |
| libimagequant | GPLv3 or commercial | **No** — optional plugin only |
| Neural model weights | Varies | **No** — keep out of core |

**Recommendation:** dual-license the core as Apache-2.0 OR MIT, document the GPL boundary, and publish a license FAQ aimed at studio legal teams. The FAQ is a sales asset, not paperwork.

### 6.11 MVP scope (MoSCoW)

| Priority | Feature | Acceptance criterion |
|---|---|---|
| **Must** | Extract: median cut, Wu, K-means (seeded) | Three modes produce valid palettes; deterministic |
| **Must** | Oklab working space + sRGB fallback | Conversions match reference within tolerance |
| **Must** | Fixed-palette mapping | 100% of output pixels in palette; ties documented |
| **Must** | Dither: none, FS, Bayer 4×4, strength | Visual presets; deterministic |
| **Must** | Indexed PNG export with reserved index | Round-trip index equality |
| **Must** | 1×N / N×1 strip + validation | Pixel-exact round-trip |
| **Must** | Batch + manifest + hashes | 1,000 files with per-file report |
| **Must** | CLI + exit codes | CI example passes |
| **Should** | ΔE<sub>00</sub> QA report + error map | Mean/p95/max, worst pixels |
| **Should** | Palette ordering (hue/lightness/custom) | Strip and ramp reflect order |
| **Should** | DTCG/CSS/Tailwind export | Valid files, documented roles |
| **Should** | Blue noise + Yliluoma dithering | Presets for pixel art and gradients |
| **Could** | Palette banks / per-region palettes | NES-style fixture passes |
| **Could** | Palette cycling metadata | Manifest describes ranges |
| **Could** | Annealing "max quality" mode | Offline, seeded |
| **Won't (v1)** | Neural quantization | Deferred |
| **Won't (v1)** | CMYK/spot/print | Separate product surface |
| **Won't (v1)** | Cloud sync/accounts | Contradicts local-first |

### 6.12 Roadmap

| Milestone | Duration | Deliverable | Exit criterion |
|---|---:|---|---|
| **M0 — Core proof** | 3 weeks | Rust library: decode, histogram, Wu, K-means, Oklab, indexed PNG | CLI produces compliant output on 20 test images |
| **M1 — Handoff** | 3 weeks | Fixed-palette mapping, strip export, validation, manifest | Round-trip tests green; strip loads in Aseprite/Godot |
| **M2 — Batch + QA** | 3 weeks | Batch runner, ΔE<sub>00</sub> report, exit codes, golden tests | 1,000-file batch reproducible in CI |
| **M3 — Web** | 4 weeks | WASM UI: drop image, preview, palette load, export | 1024² interactive < 1 s |
| **M4 — Differentiation** | 4 weeks | Blue noise, Yliluoma, palette banks, token export | NES fixture + UI token demo |

### 6.13 Risks and mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Floating-point non-determinism across platforms | Medium | High | Define guarantee level; hash tests; fixed arithmetic where needed |
| Scope creep into a full image editor | High | High | Keep the compiler metaphor; reject features that do not serve the handoff |
| GPL contamination | Low | High | license gate in CI; plugin boundary; legal review |
| Engine color-management surprises | Medium | Medium | Document import settings; smoke tests in Godot/Unity |
| Performance in WASM | Medium | Medium | Preview downscale; workers; SIMD; avoid per-pixel allocations |
| Palette quality perception vs competitors | Medium | Medium | Benchmark corpus; publish honest comparisons; offer max-quality mode |
| Users expect "AI" | Medium | Low | Explain outcomes, not algorithms; add a structure-preserving preview later |

### 6.14 Success metrics

- **Time to first compliant asset:** < 60 seconds from dropping an image to downloading an indexed PNG + strip.
- **Round-trip correctness:** 100% of strip and index tests pass on the release corpus.
- **Batch throughput:** 1,000 sprites (256², K=16) in < 2 minutes on a laptop.
- **Reproducibility:** byte-identical output for the same platform/version/seed; documented cross-platform behavior.
- **Adoption signals:** 30% of surveyed users use batch within 30 days; 20% use fixed-palette mapping; > 3 engine integrations community-contributed in 6 months.
- **Quality:** ΔE<sub>00</sub> p95 within 10% of a reference high-quality quantizer on the benchmark corpus, with faster runtime.

---

## Appendix: Method and Evidence Base

This report is deliberately conservative about numbers. No independent head-to-head benchmark of commercial tools was run for this study; where quantitative claims appear, they are either taken from the cited publication or explicitly labeled as **analyst estimate** or **target**. Tool capability claims were verified against live product pages, documentation, and source repositories in November 2026.

Two method notes matter for reproducibility:

1. **Search API unavailability.** The general web-search endpoint returned HTTP 403 throughout the research window. Research therefore used the arXiv API, the GitHub REST API, and direct HTTP fetches of documentation and product pages. This biases source selection toward projects with machine-readable metadata (arXiv, GitHub) and away from closed-source tools whose feature lists live only in marketing pages. The bias is acceptable for this report because the closed-source tools are used only as landscape context, not as algorithm evidence.
2. **Premise correction.** An earlier brief referred to a "CVPR Material Palette" paper on color-palette quantization. The verified paper is *Material Palette: Extraction of Materials from a Single Image* (arXiv:2311.17060), a 2023 work on PBR material extraction. It is **not** a color-quantization method and is not used here as evidence for palette algorithms. It is cited only in §1.2 as an example of adjacent neural decomposition work.

Every URL in the References section was fetched or API-verified during this study unless marked *(canonical DOI; bot-blocked in this environment)*.

---

## References

All links were accessed or API-verified in November 2026. Entries marked *print* are canonical publications without a stable, directly verifiable public URL; they are cited for attribution, not as online resources, and their inline citations link back to this list. Entries marked *bot-blocked* resolve in a browser but returned HTTP 403 to automated fetches in this environment.

1. Heckbert, P. S. (1982). *Color Image Quantization for Frame Buffer Display.* SIGGRAPH '82, 297–307. [https://dl.acm.org/doi/10.1145/800064.801294](https://dl.acm.org/doi/10.1145/800064.801294) *(bot-blocked)*
2. Gervautz, M., & Purgathofer, W. (1988). *A Simple Method for Color Quantization: Octree Quantization.* In New Trends in Computer Graphics, Springer. [https://doi.org/10.1007/978-3-642-83492-9_20](https://doi.org/10.1007/978-3-642-83492-9_20)
3. Wu, X. (1991). *Efficient Statistical Computations for Optimal Color Quantization.* In Graphics Gems II, Academic Press. [https://doi.org/10.1016/B978-0-08-050754-5.50035-9](https://doi.org/10.1016/B978-0-08-050754-5.50035-9)
4. Linde, Y., Buzo, A., & Gray, R. M. (1980). *An Algorithm for Vector Quantizer Design.* IEEE Transactions on Communications, 28(1), 84–95. [https://doi.org/10.1109/TCOM.1980.1094577](https://doi.org/10.1109/TCOM.1980.1094577)
5. Arthur, D., & Vassilvitskii, S. (2007). *k-means++: The Advantages of Careful Seeding.* SODA '07. *(print)*
6. Celebi, M. E. (2011). *Improving the Performance of K-Means for Color Quantization.* arXiv:1101.0395. [https://arxiv.org/abs/1101.0395](https://arxiv.org/abs/1101.0395)
7. Celebi, M. E. (2010). *Fast Color Quantization Using Weighted Sort-Means Clustering.* arXiv:1011.0093. [https://arxiv.org/abs/1011.0093](https://arxiv.org/abs/1011.0093)
8. Celebi, M. E. (2023). *Forty years of color quantization: a modern, algorithmic survey.* Artificial Intelligence Review. [https://link.springer.com/article/10.1007/s10462-023-10406-6](https://link.springer.com/article/10.1007/s10462-023-10406-6)
9. Maitra, R. (2026). *Optimized k-means color quantization of digital images in machine-based and human perception-based colorspaces.* arXiv:2601.19117. [https://arxiv.org/abs/2601.19117](https://arxiv.org/abs/2601.19117)
10. Ramella, G. (2021). *Evaluation of quality measures for color quantization.* arXiv:2011.12652. [https://arxiv.org/abs/2011.12652](https://arxiv.org/abs/2011.12652)
11. Dekker, A. H. (1994). *Kohonen Neural Networks for Optimal Colour Quantization.* Network: Computation in Neural Systems, 5(3), 351–367. [https://doi.org/10.1088/0954-898X_5_3_003](https://doi.org/10.1088/0954-898X_5_3_003)
12. Hou, Y., Zheng, L., & Gould, S. (2020). *Learning to Structure an Image with Few Colors.* CVPR 2020. [https://arxiv.org/abs/2003.07848](https://arxiv.org/abs/2003.07848)
13. Hou, Y., Zheng, L., & Gould, S. (2022). *Learning to Structure an Image with Few Colors and Beyond.* arXiv:2208.08438. [https://arxiv.org/abs/2208.08438](https://arxiv.org/abs/2208.08438)
14. Lopes, I., Pizzati, F., & de Charette, R. (2023). *Material Palette: Extraction of Materials from a Single Image.* arXiv:2311.17060. [https://arxiv.org/abs/2311.17060](https://arxiv.org/abs/2311.17060)
15. Phan, H. Q., Fu, H., & Chan, A. B. (2017). *Color Orchestra: Ordering Color Palettes for Interpolation and Prediction.* arXiv:1703.06003. [https://arxiv.org/abs/1703.06003](https://arxiv.org/abs/1703.06003)
16. Wolfe, A., Morrical, N., Akenine-Möller, T., & Ramamoorthi, R. (2021). *Scalar Spatiotemporal Blue Noise Masks.* arXiv:2112.09629. [https://arxiv.org/abs/2112.09629](https://arxiv.org/abs/2112.09629)
17. Jiang, H., Xiong, D., Jiang, X., Ding, L., Chen, L., & Huang, K. (2023). *Efficient Halftoning via Deep Reinforcement Learning.* arXiv:2304.12152. [https://arxiv.org/abs/2304.12152](https://arxiv.org/abs/2304.12152)
18. Floyd, R. W., & Steinberg, L. (1976). *An Adaptive Algorithm for Spatial Greyscale.* Proceedings of the SID, 17(2), 75–77. *(print)*
19. Bayer, B. E. (1973). *An Optimum Method for Two-Level Rendition of Continuous-Tone Pictures.* IEEE International Conference on Communications. *(print)*
20. Ulichney, R. (1993). *The Void-and-Cluster Method for Dither Array Generation.* Proc. SPIE 1913. [https://doi.org/10.1117/12.152707](https://doi.org/10.1117/12.152707)
21. Sharma, G., Wu, W., & Dalal, E. N. (2005). *The CIEDE2000 Color-Difference Formula: Implementation Notes, Supplementary Test Data, and Mathematical Observations.* Color Research & Application, 30(1), 21–30. [https://hajim.rochester.edu/ece/sites/gsharma/ciede2000/](https://hajim.rochester.edu/ece/sites/gsharma/ciede2000/)
22. Ottosson, B. (2020). *A perceptual color space for image processing (Oklab).* [https://bottosson.github.io/posts/oklab/](https://bottosson.github.io/posts/oklab/)
23. Yliluoma, J. *Arbitrary-palette positional dithering algorithm.* [https://bisqwit.iki.fi/story/howto/dither/jy/](https://bisqwit.iki.fi/story/howto/dither/jy/)
24. Tracelyx. *PaletteForge.* [https://tracelyx.com/tools/paletteforge/](https://tracelyx.com/tools/paletteforge/)
25. ImageOptim. *libimagequant.* [https://github.com/ImageOptim/libimagequant](https://github.com/ImageOptim/libimagequant)
26. Lesiński, K. (Kornelski). *pngquant.* [https://github.com/kornelski/pngquant](https://github.com/kornelski/pngquant)
27. Ibezkrovnyi. *image-quantization (image-q).* [https://github.com/ibezkrovnyi/image-quantization](https://github.com/ibezkrovnyi/image-quantization)
28. Manske, I. *quantette.* [https://github.com/IanManske/quantette](https://github.com/IanManske/quantette)
29. Okaneco. *rscolorq.* [https://github.com/okaneco/rscolorq](https://github.com/okaneco/rscolorq)
30. Ogeon. *palette.* [https://github.com/Ogeon/palette](https://github.com/Ogeon/palette)
31. image-rs. *image.* [https://github.com/image-rs/image](https://github.com/image-rs/image)
32. RustWASM. *wasm-bindgen.* [https://github.com/rustwasm/wasm-bindgen](https://github.com/rustwasm/wasm-bindgen)
33. ImageMagick. *Color Quantization.* [https://imagemagick.org/script/quantize.php](https://imagemagick.org/script/quantize.php)
34. Aseprite. *Command Line Interface.* [https://www.aseprite.org/docs/cli/](https://www.aseprite.org/docs/cli/)
35. Aseprite. [https://www.aseprite.org/](https://www.aseprite.org/)
36. Godot Engine. *GradientTexture1D.* [https://docs.godotengine.org/en/stable/classes/class_gradienttexture1d.html](https://docs.godotengine.org/en/stable/classes/class_gradienttexture1d.html)
37. Unity. *Texture2D.* [https://docs.unity3d.com/ScriptReference/Texture2D.html](https://docs.unity3d.com/ScriptReference/Texture2D.html)
38. W3C. *Web Content Accessibility Guidelines (WCAG) 2.2.* [https://www.w3.org/TR/WCAG22/](https://www.w3.org/TR/WCAG22/)
39. Myndex. *SAPC / APCA (Accessible Perceptual Contrast Algorithm).* [https://github.com/Myndex/SAPC-APCA](https://github.com/Myndex/SAPC-APCA)
40. Design Tokens Community Group. *Design Tokens Format Module.* [https://tr.designtokens.org/format/](https://tr.designtokens.org/format/)
41. Tailwind CSS. *Colors.* [https://tailwindcss.com/docs/colors](https://tailwindcss.com/docs/colors)
42. Lospec. *Palette List.* [https://lospec.com/palette-list](https://lospec.com/palette-list)
43. Coolors. [https://coolors.co](https://coolors.co)
44. Adobe. *Adobe Color.* [https://color.adobe.com](https://color.adobe.com)
45. Huemint. [https://huemint.com](https://huemint.com)
46. scikit-learn. *KMeans.* [https://scikit-learn.org/stable/modules/generated/sklearn.cluster.KMeans.html](https://scikit-learn.org/stable/modules/generated/sklearn.cluster.KMeans.html)
47. W3C. *Portable Network Graphics (PNG) Specification, Third Edition.* [https://www.w3.org/TR/png-3/](https://www.w3.org/TR/png-3/)
48. KoBeWi. *Godot Palette Swap Shader.* [https://github.com/KoBeWi/Godot-Palette-Swap-Shader](https://github.com/KoBeWi/Godot-Palette-Swap-Shader)
49. International Color Consortium. [https://www.color.org](https://www.color.org)
50. GIMP. [https://www.gimp.org](https://www.gimp.org)
51. Krita. [https://krita.org](https://krita.org)
52. Orama Interactive. *Pixelorama.* [https://github.com/Orama-Interactive/Pixelorama](https://github.com/Orama-Interactive/Pixelorama)
53. Cosmigo. *Pro Motion NG.* [https://www.cosmigo.com/promotion/index.php](https://www.cosmigo.com/promotion/index.php)
54. OpenCV. *K-Means Clustering in OpenCV.* [https://docs.opencv.org/4.x/d1/d5c/tutorial_py_kmeans_opencv.html](https://docs.opencv.org/4.x/d1/d5c/tutorial_py_kmeans_opencv.html) *(bot-blocked)*
55. Pillow. *Image.quantize.* [https://pillow.readthedocs.io/en/stable/reference/Image.html](https://pillow.readthedocs.io/en/stable/reference/Image.html)
56. W3C. *A Standard Default Color Space for the Internet — sRGB.* [https://www.w3.org/Graphics/Color/sRGB](https://www.w3.org/Graphics/Color/sRGB)
57. Chang, H., Fried, O., Liu, Y., DiVerdi, S., & Finkelstein, A. (2015). *Palette-based Photo Recoloring.* ACM Transactions on Graphics (SIGGRAPH 2015). [https://dl.acm.org/doi/10.1145/2766978](https://dl.acm.org/doi/10.1145/2766978) *(bot-blocked)*

---

*Prepared as a research input for a PRD and technical architecture. Algorithmic recommendations are evidence-based but should be validated on the target asset corpus before being frozen into product defaults.*

