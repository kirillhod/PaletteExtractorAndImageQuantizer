# DESIGN.md

> The Blender design language applied to a precision tool: charcoal UI, one blue
> interaction accent, an orange brand mark, Inter, and editorial type that never gets in
> the way of the pixels.

**Product:** PaletteExtractorAndImageQuantizer (short mark **PEIQ**)
**Reference:** [blender.org](https://www.blender.org/) — specifically the saved
`5.3 — Blender` release page and its `style.css` (`bthree` theme).
**Scope:** single-page browser tool: app shell, empty state, working panels, Help drawer.
**Constraints:** zero dependencies, no build step, no runtime external/CDN assets
(Inter is self-hosted), offline-first, GPL-3.0.
**Interaction tier:** **L1 — precise static** for the app; the site’s editorial reveal is
used only in the empty state and Guide.
**Dependencies:** CSS + a small vanilla `IntersectionObserver`. No GSAP, Lenis, WebGL,
video backgrounds, or scroll-jacking.
**Source of truth:** visual values and component CSS live here; behavior lives in
[`IMPLEMENTATION_PLAN.md`](IMPLEMENTATION_PLAN.md). If they disagree on a visual value,
this file wins; if they disagree on behavior, the plan wins.

> **Exactness note.** The site is a light-theme-first WordPress theme with a dark override.
> PEIQ uses the **dark theme** as its primary surface (better for image work) and keeps
> the exact dark-theme tokens. The light-theme tokens are included for the optional light
> mode. The site’s UI accent is **blue** (`hsl(204 100% 50%)`); **orange** (`#ed8f31`) is
> the brand/logo color. We preserve that split instead of turning everything orange.

---

## 1. Visual Theme & Atmosphere

**Style:** Blender UI / Editorial Dark.

**Keywords:** charcoal, blue accent, orange brand, Inter, precise, editorial, dense,
technical, calm, matte.

**Tone:** confident and utilitarian — **NOT** corporate SaaS, neon gaming, glassmorphism,
or playful illustration. It is a workshop interface with an editorial voice.

**Feel:** the Blender release page’s dark theme, compressed into a tool: the image is the
hero, the panels are matte charcoal blocks, the blue accent marks the active path, and the
orange brand appears only where the product signs its name.

**Interaction tier:** **L1** for the working UI. State changes only: hover, focus, active,
drawer, progress. The site’s `in-viewport-fade fade-up` reveal is allowed **only** in the
empty state and Guide sections, because it is editorial, not functional.

**Reference notes**

- Exact source: saved `5.3 — Blender.html` + `style.css` from the `bthree` theme.
- Adopt: `#1c1e22` / `#25282d` / `#30353b` charcoal stack, blue `hsl(204 100% 50%)`
  interaction accent, orange `#ed8f31` brand, Inter variable font, 6/12 px radii,
  4/8/16/24/48/96 px spacing, light-300 section headings with 800 `<strong>` words,
  150 ms state transitions, and the 1 s / 0.5 s / 60 px editorial reveal.
- Do not copy: Blender’s logo, wordmark, artwork, screenshots, CSS, or theme files.
  Use the design language, not the assets.
- The tool is the hero: the empty state shows a live canvas/palette preview or a
  canvas-generated palette mosaic, not a 3D render or video.
- The working UI is denser than the marketing site: editorial type belongs to the empty
  state, Guide, and footer; controls stay compact and scannable.

---

## 2. Color Palette & Roles

All colors are CSS variables. Components must never contain hard-coded hex values.
`--peiq-` is the required prefix. The values below are taken from the site’s dark theme
and light-theme variables.

### Dark theme (primary)

```css
:root {
  color-scheme: dark;

  /* Surfaces */
  --peiq-bg: #1c1e22;                 /* shell, header, canvas chrome */
  --peiq-bg-secondary: #25282d;       /* page body, inputs, secondary nav */
  --peiq-bg-tertiary: #202327;        /* wells, dropdowns, canvas checker */
  --peiq-surface: #30353b;            /* cards, boxes, panels */
  --peiq-surface-hover: #454c54;      /* button/row hover */

  /* Text */
  --peiq-text: #c7cbd1;               /* body */
  --peiq-text-strong: #f9fafa;        /* headings, key values */
  --peiq-text-secondary: #89939f;     /* secondary labels */
  --peiq-text-tertiary: #6e7987;      /* metadata, muted */

  /* Borders */
  --peiq-border: rgba(199, 203, 209, 0.15);
  --peiq-border-strong: #40474f;

  /* Interaction accent — blue, as on blender.org */
  --peiq-accent: hsl(204, 100%, 50%);
  --peiq-accent-hover: hsl(204, 100%, 62%);
  --peiq-accent-pressed: hsl(204, 100%, 42%);
  --peiq-accent-bg: hsla(204, 100%, 50%, 0.10);
  --peiq-accent-bg-hover: hsla(204, 100%, 50%, 0.20);
  --peiq-accent-text: var(--peiq-accent);
  --peiq-accent-rgb: 0, 153, 255;
  --peiq-text-on-accent: #0b1220;     /* contrast fix; site uses #fff */

  /* Brand — orange, as the Blender mark */
  --peiq-brand: #ed8f31;
  --peiq-brand-rgb: 237, 143, 49;
  --peiq-brand-soft: rgba(237, 143, 49, 0.16);
  --peiq-brand-ink: #b35c00;          /* on light surfaces */

  /* Buttons (site dark theme) */
  --peiq-btn-color: #bec6d0;
  --peiq-btn-bg: #40474f;
  --peiq-btn-bg-hover: #454c54;
  --peiq-btn-accent-bg: linear-gradient(350deg, #6183ff, #47aaf5);
  --peiq-btn-accent-bg-hover: linear-gradient(350deg, #708fff, #5ab3f6);
  --peiq-btn-accent-shadow:
    2px 4px 4px rgba(0, 82, 255, 0.102),
    1px 8px 24px rgba(0, 82, 255, 0.102),
    2px 8px 48px rgba(0, 82, 255, 0.549);

  /* Inputs (site dark theme) */
  --peiq-input-bg: #25282d;
  --peiq-input-bg-hover: #202327;
  --peiq-input-border: var(--peiq-input-bg);

  /* Code */
  --peiq-code: #d6b6d8;
  --peiq-code-bg: rgba(208, 38, 217, 0.08);

  /* Semantic (site dark theme) */
  --peiq-success: #5c9325;
  --peiq-success-bg: #404f30;
  --peiq-success-text: #99b77b;
  --peiq-warning: #e4a511;
  --peiq-warning-bg: rgba(234, 185, 72, 0.40);
  --peiq-warning-text: #f4dca4;
  --peiq-danger: #ee5353;
  --peiq-danger-bg: #4d2e2e;
  --peiq-danger-text: #e96363;
  --peiq-info: #51aefb;
  --peiq-info-bg: rgba(76, 153, 240, 0.20);
  --peiq-info-text: #4c99f0;
  --peiq-focus: var(--peiq-accent);

  /* Canvas checkerboard */
  --peiq-checker-a: #202327;
  --peiq-checker-b: #25282d;

  /* Shadows (site values) */
  --peiq-shadow-card: 0 2px 4px rgba(0, 0, 0, 0.05);
  --peiq-shadow-card-lg: rgba(5, 5, 6, 0.20) 0 8px 24px;
  --peiq-shadow-popover: 0 16px 40px rgba(5, 5, 6, 0.32);
  --peiq-shadow-drawer: -24px 0 64px rgba(5, 5, 6, 0.32);

  /* Geometry (site: .6rem / 1.2rem at a 10px root) */
  --peiq-radius: 6px;
  --peiq-radius-lg: 12px;
  --peiq-radius-pill: 999px;

  /* Spacing (site: --spacer = 1.6rem at a 10px root) */
  --peiq-space-1: 4px;
  --peiq-space-2: 8px;
  --peiq-space-3: 16px;
  --peiq-space-4: 24px;
  --peiq-space-5: 48px;
  --peiq-space-6: 96px;
  --peiq-space-7: 192px;
}
```

### Light theme (optional, exact site variables)

```css
[data-theme="light"] {
  color-scheme: light;

  --peiq-bg: hsl(210, 4%, 95%);
  --peiq-bg-secondary: hsl(210, 4%, 92%);
  --peiq-bg-tertiary: hsl(210, 4%, 89%);
  --peiq-surface: hsl(210, 4%, 98%);
  --peiq-surface-hover: hsl(210, 4%, 99%);

  --peiq-text: hsl(230, 4%, 31%);
  --peiq-text-strong: hsl(230, 4%, 27%);
  --peiq-text-secondary: hsl(230, 4%, 57%);
  --peiq-text-tertiary: hsl(230, 4%, 71%);

  --peiq-border: hsl(210, 4%, 89%);
  --peiq-border-strong: #d3d9df;

  --peiq-btn-color: #677a8e;
  --peiq-btn-bg: #eaedf0;
  --peiq-btn-bg-hover: #f3f5f6;
  --peiq-input-bg: #eaedf0;
  --peiq-input-bg-hover: #f3f5f6;
  --peiq-input-border: #d3d9df;

  --peiq-code: #903d94;
  --peiq-code-bg: rgba(121, 0, 128, 0.04);

  --peiq-success: #6bb125;
  --peiq-success-bg: #dbf4c2;
  --peiq-success-text: #4d8118;
  --peiq-warning: #e4a511;
  --peiq-warning-bg: #faeed1;
  --peiq-warning-text: #896510;
  --peiq-danger: #ee5353;
  --peiq-danger-bg: #fce4e4;
  --peiq-danger-text: #df5353;
  --peiq-info: #13bde7;
  --peiq-info-bg: #d9f5fc;
  --peiq-info-text: #10a2c6;

  --peiq-shadow-card: 0 2px 4px rgba(0, 0, 0, 0.05);
  --peiq-shadow-card-lg: rgba(149, 157, 165, 0.20) 0 8px 24px;

  --peiq-checker-a: #e9ecef;
  --peiq-checker-b: #f8f9fa;

  --peiq-text-on-accent: #0b1220;
  --peiq-brand-ink: #a84800;
}
```

**Color rules**

- **Blue is interaction.** Primary buttons, links, active tabs, focus rings, selected
  swatches, and progress use `--peiq-accent`.
- **Orange is brand.** Use `--peiq-brand` only for the wordmark/mark, a brand eyebrow, or
  one editorial highlight. Never use it for primary buttons or body links.
- Body text is `--peiq-text` on `--peiq-bg`; headings and key values are
  `--peiq-text-strong`.
- Cards use `--peiq-surface` with no border; structure comes from the surface step and
  shadow. Borders are for inputs, dividers, and the header.
- The site uses white text on the blue gradient; PEIQ uses
  `--peiq-text-on-accent` for 4.5:1 contrast. This is a deliberate accessibility fix.
- One accent per view. Do not import the release page’s per-feature pastel colors
  (pink/purple/green) into the tool; keep blue + orange brand.
- Use `rgba(var(--peiq-accent-rgb), α)` for tints if needed; do not invent new hex values.
  (Add `--peiq-accent-rgb: 0, 153, 255` if a component needs it.)
- Semantic colors are exact site tokens; they are for status only, never decoration.

**Key contrast pairs (dark theme, approximate)**

| Pair | Ratio | Use |
|---|---:|---|
| `--peiq-text` on `--peiq-bg` | ≈ 8.8:1 | body |
| `--peiq-text-strong` on `--peiq-bg` | ≈ 15:1 | headings |
| `--peiq-text-secondary` on `--peiq-bg` | ≈ 5.4:1 | secondary labels |
| `--peiq-text-tertiary` on `--peiq-bg` | ≈ 3.7:1 | metadata only |
| `--peiq-accent` on `--peiq-bg` | ≈ 5.8:1 | links/icons |
| `--peiq-text-on-accent` on `#47aaf5` | ≈ 7:1 | primary button |
| `#ffffff` on `#47aaf5` | ≈ 2.9:1 | **not** used |
| `--peiq-text` on `--peiq-surface` | ≈ 7.2:1 | card body |
| `--peiq-brand` on `--peiq-bg` | ≈ 6.5:1 | brand mark |

---

## 3. Typography Rules

The site uses **Inter Variable** (`Inter-VariableFont_slnt,wght.ttf`) with a long
system/emoji fallback. PEIQ self-hosts the Latin variable subset
(`assets/fonts/InterVariable-latin.woff2`, ~48 KB) plus `assets/fonts/OFL.txt`, and keeps
the exact fallback. No Google Fonts, no CDN, no external request.

```css
@font-face {
  font-family: "Inter";
  src: url("../assets/fonts/InterVariable-latin.woff2") format("woff2");
  font-weight: 100 900;
  font-style: normal;
  font-display: swap;
}

:root {
  --peiq-font-ui: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
    "Helvetica Neue", Oxygen, Ubuntu, Cantarell, "Open Sans", Arial, sans-serif,
    "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji";
  --peiq-font-mono: ui-monospace, Menlo, Monaco, "Cascadia Mono", "Segoe UI Mono",
    "Roboto Mono", "Oxygen Mono", "Ubuntu Monospace", "Source Code Pro", "Fira Mono",
    "Droid Sans Mono", "Courier New", monospace;
}
```

> The site sets `html { font-size: 62.5% }` and expresses sizes in rem. PEIQ uses a
> 16 px root with equivalent rem values (e.g. site `1.8rem` → `1.125rem`) to avoid the
> 62.5% accessibility hack. The rendered sizes are the same.

| Role | Font | Size | Weight | Line Height | Letter Spacing |
|---|---|---|---|---|---|
| Hero / empty-state H1 | UI | `clamp(2.25rem, 5vw, 3.25rem)` (36–52 px; release-page override) | 800 | 1.00 | 0 |
| Section H2 (editorial) | UI | `1.5rem` → `1.75rem` ≥ 900 px | 300 (strong: 800) | 1.00 | 0 |
| App page title / H1 | UI | `1.75rem` (28 px) → `2rem` (32 px) ≥ 900 px | 600 | 1.00 | 0 |
| H3 / panel title | UI | `1.125rem` (18 px) | 600 | 1.00 | 0 |
| H4 | UI | `1.125rem` (18 px) → `1.3125rem` (21 px) ≥ 900 px | 600 | 1.00 | 0 |
| H5 | UI | `1rem` (16 px) → `1.125rem` (18 px) ≥ 900 px | 600 | 1.00 | 0 |
| Body (editorial) | UI | `0.875rem` → `1rem` ≥ 900 px → `1.125rem` ≥ 1220 px | 400 | 1.43 | 0 |
| Body (app controls) | UI | `0.875rem` (14 px) | 400 | 1.43 | 0 |
| Small / metadata | UI | `0.75rem` (12 px) → `0.875rem` (14 px) ≥ 900 px | 400 | 1.43 | 0 |
| Label / eyebrow | UI | `0.75rem` (12 px) | 600 | 1.00 | 0.04em, uppercase |
| Badge | UI | `0.8em` | 400 | 1.00 | 0 |
| Mono / hex / index | Mono | `0.8125rem` (13 px) | 400 | 1.40 | 0 |
| Button | UI | `0.875rem` (14 px) → `1rem` ≥ 900 px | 500 | 1.50rem / 2rem | 0 |

> The release page sets `body.type-release { --fs-hero-title: 5.2rem }` (52 px). PEIQ uses
> that override for the empty state and clamps it down to 36 px on small screens. The
> general site hero scale (3.6/5.5/7.2 rem) is intentionally not used: it would push the
> tool below the fold.

**Typography rules**

- The site’s signature: section headings are **weight 300** with **`<strong>` at weight
  800**. Use it in the empty state and Guide: e.g. “Map to your **palette**”.
- Hero H1 is weight 800, line-height 1. No letter-spacing beyond the font’s own metrics.
- Headings use `text-wrap: balance`; paragraphs use `text-wrap: pretty`.
- Margins: headings `margin-bottom: 0.5rem`; paragraphs `margin-bottom: 1rem`.
- App controls use 14 px body for density; editorial surfaces use the site’s 16/18 px
  scale. Do not use 18 px in dense control panels.
- Uppercase only for labels/eyebrows. No uppercase body.
- Numbers in QA/timings use `font-variant-numeric: tabular-nums`; hex uses mono.
- No gradient text, no text-shadow, no decorative outlines. The site’s hero text-shadow
  exists only because it sits on a photo; PEIQ has no photo hero.
- **NEVER use:** Comic Sans, Papyrus, Brush Script, decorative display fonts, script
  fonts, or a serif for UI controls.

**Text decoration decisions**

| Element | Gradient | Shadow | Decision |
|---|---|---|---|
| Hero / empty-state H1 | No | No | Solid `--peiq-text-strong` |
| Section H2 | No | No | Weight 300, `<strong>` 800 |
| H3 / panel title | No | No | Solid |
| Body | No | No | Plain |
| Links | No | No | Blue + underline offset |
| Eyebrow / brand | No | No | Orange uppercase brand label |

---

## 4. Component Stylings

All components use the variables from §2. States are mandatory: default, hover, active,
focus-visible, disabled. The only allowed inline style is a dynamic swatch color via
`--swatch`.

### Global focus

```css
:where(a, button, input, select, textarea, [tabindex]):focus-visible {
  outline: 2px solid var(--peiq-focus);
  outline-offset: 2px;
}
```

The site uses a 4 px accent outline on accent buttons. PEIQ uses 2 px for dense controls
and 4 px on primary buttons; both are visible on charcoal and light surfaces.

### Buttons

```css
.peiq-btn {
  display: inline-block;
  min-height: 32px;
  padding: 0.25rem 1rem;
  border: 0;
  border-radius: var(--peiq-radius);
  background: var(--peiq-btn-bg);
  color: var(--peiq-btn-color);
  font: 500 0.875rem/1.5rem var(--peiq-font-ui);
  text-align: center;
  text-decoration: none;
  cursor: pointer;
  transition:
    background-color 150ms ease-out,
    color 150ms ease-out,
    transform 80ms ease-out;
}
@media (min-width: 900px) {
  .peiq-btn { font-size: 1rem; line-height: 2rem; }
}
.peiq-btn:hover { background: var(--peiq-btn-bg-hover); }
.peiq-btn:active { transform: scale(0.95); }
.peiq-btn:focus-visible {
  outline: 4px solid var(--peiq-accent);
  outline-offset: 0;
}
.peiq-btn:disabled,
.peiq-btn[aria-disabled="true"] {
  opacity: 0.55;
  cursor: not-allowed;
  transform: none;
}

.peiq-btn--primary {
  background-color: transparent;
  background-image: var(--peiq-btn-accent-bg);
  box-shadow: var(--peiq-btn-accent-shadow);
  color: var(--peiq-text-on-accent);
}
.peiq-btn--primary:hover {
  background-color: transparent;
  background-image: var(--peiq-btn-accent-bg-hover);
  color: var(--peiq-text-on-accent);
}
.peiq-btn--primary:active {
  background-color: transparent;
  transform: scale(0.95);
}

.peiq-btn--ghost {
  background: transparent;
  color: var(--peiq-text);
}
.peiq-btn--ghost:hover {
  background: var(--peiq-accent-bg);
  color: var(--peiq-accent-hover);
}

.peiq-btn--icon { width: 32px; padding: 0; }
.peiq-btn--danger { color: var(--peiq-danger); }
.peiq-btn--danger:hover { background: var(--peiq-danger-bg); }
```

### Cards and boxes

The site’s `.box` is the reference: surface `#30353b`, radius 12 px, padding 24 px,
subtle shadow, no border.

```css
.peiq-card {
  padding: var(--peiq-space-4);
  border: 0;
  border-radius: var(--peiq-radius-lg);
  background: var(--peiq-surface);
  box-shadow: var(--peiq-shadow-card);
  color: var(--peiq-text);
}
.peiq-card--interactive {
  transition:
    box-shadow 150ms ease-out,
    transform 150ms ease-out;
}
.peiq-card--interactive:hover {
  box-shadow: var(--peiq-shadow-card-lg);
  transform: translateY(-2px);
}
.peiq-card:focus-within {
  outline: 2px solid var(--peiq-accent);
  outline-offset: 2px;
}
.peiq-card--flat { box-shadow: none; }
.peiq-card--elevated { box-shadow: var(--peiq-shadow-card-lg); }
```

### Empty state / hero

The site’s `.hero` is 480–560 px tall (30–35 spacers), sits under the 64 px navbar, and
uses white text. PEIQ uses the same metrics **only when no image is loaded**; after load,
the hero collapses into a compact drop bar so the tool stays above the fold. No photo
background: use a canvas-generated palette mosaic or the CSS gradients below.

```css
.peiq-hero {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: calc(100dvh - 112px);
  min-height: 480px;
  max-height: 560px;
  padding: var(--peiq-space-5) var(--peiq-space-3);
  text-align: center;
  color: var(--peiq-text-strong);
  background:
    radial-gradient(1200px 600px at 50% 0%, var(--peiq-brand-soft), transparent 60%),
    radial-gradient(900px 500px at 20% 100%, var(--peiq-accent-bg), transparent 60%),
    var(--peiq-bg);
  border-bottom: 1px solid var(--peiq-border-strong);
}
.peiq-hero__title {
  margin: 0 0 var(--peiq-space-2);
  font: 800 clamp(2.25rem, 5vw, 3.25rem) / 1 var(--peiq-font-ui);
  text-wrap: balance;
}
.peiq-hero__subtitle {
  max-width: 62rem;
  margin: 0 auto var(--peiq-space-4);
  color: var(--peiq-text);
  font-size: 1.3125rem;
  line-height: 1.33;
}
@media (min-width: 900px) {
  .peiq-hero__subtitle { font-size: 1.5rem; line-height: 1.17; }
}
.peiq-hero__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--peiq-space-3);
  justify-content: center;
}
```

### Header and navigation

The site has a 64 px primary navbar and a secondary nav with its own surface. PEIQ maps
that to a 64 px header + 48 px mode/status subbar.

```css
.peiq-header {
  position: sticky;
  top: 0;
  z-index: 40;
  display: flex;
  align-items: center;
  gap: var(--peiq-space-3);
  height: 64px;
  padding: 0 var(--peiq-space-3);
  background: var(--peiq-bg);
  border-bottom: 1px solid var(--peiq-border-strong);
}
.peiq-header--scrolled { box-shadow: var(--peiq-shadow-card); }

.peiq-subbar {
  display: flex;
  align-items: center;
  gap: var(--peiq-space-2);
  min-height: 48px;
  padding: 0 var(--peiq-space-3);
  background: var(--peiq-bg-tertiary);
  border-bottom: 1px solid var(--peiq-border-strong);
}

.peiq-nav { display: flex; align-items: center; gap: 0; }
.peiq-nav__link {
  display: inline-flex;
  align-items: center;
  height: 100%;
  padding: 0 var(--peiq-space-3);
  color: var(--peiq-text-secondary);
  font: 500 0.875rem/1 var(--peiq-font-ui);
  text-decoration: none;
  transition: color 150ms ease-out, background-color 150ms ease-out;
}
.peiq-nav__link:hover {
  color: var(--peiq-accent);
}
.peiq-nav__link[aria-current="page"] {
  color: var(--peiq-text-strong);
  background: var(--peiq-accent-bg);
}
.peiq-nav__link:focus-visible {
  outline: 2px solid var(--peiq-focus);
  outline-offset: -2px;
}
```

### Links

```css
.peiq-link {
  color: var(--peiq-accent);
  text-decoration: underline;
  text-decoration-thickness: 1px;
  text-underline-offset: 3px;
  transition: color 150ms ease-out;
}
.peiq-link:hover { color: var(--peiq-accent-hover); }
.peiq-link:focus-visible {
  outline: 2px solid var(--peiq-focus);
  outline-offset: 2px;
}
.peiq-link--brand { color: var(--peiq-brand); }
.peiq-link--brand:hover { color: var(--peiq-brand); filter: brightness(1.1); }
```

### Badges

```css
.peiq-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  max-width: 100%;
  padding: 0.35em 0.5em;
  border: 1px solid var(--peiq-bg-secondary);
  border-radius: var(--peiq-radius);
  background: var(--peiq-bg-secondary);
  color: var(--peiq-text);
  font: 400 0.8em/1 var(--peiq-font-ui);
  white-space: nowrap;
}
.peiq-badge--accent {
  color: var(--peiq-accent-text);
  background: var(--peiq-accent-bg);
  border-color: var(--peiq-accent-bg-hover);
}
.peiq-badge--success {
  color: var(--peiq-success-text);
  background: var(--peiq-success-bg);
  border-color: var(--peiq-success-bg);
}
.peiq-badge--warning {
  color: var(--peiq-warning-text);
  background: var(--peiq-warning-bg);
  border-color: var(--peiq-warning-bg);
}
.peiq-badge--danger {
  color: var(--peiq-danger-text);
  background: var(--peiq-danger-bg);
  border-color: var(--peiq-danger-bg);
}
```

### Inputs and selects

The site’s form control: 2 px border in the input background, radius 6 px, subtle focus
ring. PEIQ keeps that and uses readable text (the site’s base style hard-codes a dark text
color that is wrong in dark mode).

```css
.peiq-field { display: grid; gap: var(--peiq-space-2); }

.peiq-label {
  color: var(--peiq-text-tertiary);
  font: 600 0.75rem/1 var(--peiq-font-ui);
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.peiq-input,
.peiq-select {
  width: 100%;
  min-height: 40px;
  padding: 0.375rem 0.75rem;
  border: 2px solid var(--peiq-input-border);
  border-radius: var(--peiq-radius);
  background: var(--peiq-input-bg);
  color: var(--peiq-text);
  font: 400 0.875rem/1.5 var(--peiq-font-ui);
  transition: border-color 150ms ease-in-out, box-shadow 150ms ease-in-out;
}
.peiq-input:hover,
.peiq-select:hover {
  border-color: var(--peiq-input-bg-hover);
  background: var(--peiq-input-bg-hover);
}
.peiq-input:focus-visible,
.peiq-select:focus-visible {
  outline: 0;
  border-color: var(--peiq-accent);
  box-shadow: 0 0 0 2px var(--peiq-accent-bg-hover);
}
.peiq-input:disabled,
.peiq-select:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.peiq-range {
  width: 100%;
  min-height: 32px;
  accent-color: var(--peiq-accent);
}
.peiq-range:focus-visible {
  outline: 2px solid var(--peiq-focus);
  outline-offset: 4px;
}
.peiq-check {
  width: 18px;
  height: 18px;
  accent-color: var(--peiq-accent);
}
```

### Tabs / pills

The site’s active pill is a solid accent fill with white text. PEIQ uses the same shape and
blue fill, with dark text for contrast.

```css
.peiq-tabs {
  display: inline-flex;
  gap: 2px;
  padding: 4px;
  border-radius: var(--peiq-radius);
  background: var(--peiq-bg-tertiary);
}
.peiq-tab {
  min-height: 32px;
  padding: 0 var(--peiq-space-3);
  border: 0;
  border-radius: var(--peiq-radius);
  background: transparent;
  color: var(--peiq-text-secondary);
  font: 500 0.875rem/1 var(--peiq-font-ui);
  cursor: pointer;
  transition: color 150ms ease-out, background-color 150ms ease-out;
}
.peiq-tab:hover {
  color: var(--peiq-text-strong);
  background: var(--peiq-accent-bg);
}
.peiq-tab[aria-selected="true"] {
  color: var(--peiq-text-on-accent);
  background: var(--peiq-accent);
}
.peiq-tab:focus-visible {
  outline: 2px solid var(--peiq-focus);
  outline-offset: 2px;
}
.peiq-tab:disabled { opacity: 0.55; cursor: not-allowed; }
```

### Palette swatches

```css
.peiq-swatch {
  position: relative;
  width: 32px;
  height: 32px;
  border: 1px solid var(--peiq-border-strong);
  border-radius: var(--peiq-radius);
  background: var(--swatch, var(--peiq-surface-hover));
  cursor: pointer;
  transition:
    transform 150ms ease-out,
    box-shadow 150ms ease-out,
    border-color 150ms ease-out;
}
.peiq-swatch:hover {
  transform: scale(1.06);
  border-color: var(--peiq-text-strong);
}
.peiq-swatch:active { transform: scale(0.98); }
.peiq-swatch:focus-visible {
  outline: 2px solid var(--peiq-focus);
  outline-offset: 2px;
}
.peiq-swatch[aria-pressed="true"],
.peiq-swatch--selected {
  box-shadow:
    0 0 0 2px var(--peiq-bg),
    0 0 0 4px var(--peiq-accent);
}
.peiq-swatch:disabled { opacity: 0.55; cursor: not-allowed; }
```

> Dynamic swatch color: `element.style.setProperty('--swatch', hex)`. This is the only
> permitted inline style. Never write a color literal into a component stylesheet.

### Drawer and popover

The site’s dark theme boxes are matte and shadowed; the Help drawer follows that, not a
light “paper” sheet.

```css
.peiq-drawer {
  position: fixed;
  inset: 0 0 0 auto;
  z-index: 60;
  width: min(360px, 92vw);
  overflow: auto;
  background: var(--peiq-bg);
  color: var(--peiq-text);
  border-left: 1px solid var(--peiq-border-strong);
  box-shadow: var(--peiq-shadow-drawer);
  transform: translateX(100%);
  transition: transform 250ms ease-out;
}
.peiq-drawer[data-open="true"] { transform: translateX(0); }
.peiq-drawer a { color: var(--peiq-accent); }

.peiq-popover {
  z-index: 50;
  max-width: 320px;
  padding: var(--peiq-space-3);
  background: var(--peiq-surface);
  color: var(--peiq-text);
  border: 1px solid var(--peiq-border-strong);
  border-radius: var(--peiq-radius-lg);
  box-shadow: var(--peiq-shadow-popover);
  font: 400 0.875rem/1.5 var(--peiq-font-ui);
}
```

### QA stats, status, toasts

```css
.peiq-stat { display: grid; gap: 2px; }
.peiq-stat__value {
  color: var(--peiq-text-strong);
  font: 600 1.25rem/1.1 var(--peiq-font-ui);
  font-variant-numeric: tabular-nums;
}
.peiq-stat__label {
  color: var(--peiq-text-tertiary);
  font: 600 0.75rem/1 var(--peiq-font-ui);
  letter-spacing: 0.04em;
  text-transform: uppercase;
}
.peiq-stat--warning .peiq-stat__value { color: var(--peiq-warning-text); }
.peiq-stat--error .peiq-stat__value { color: var(--peiq-danger-text); }

.peiq-toast {
  display: flex;
  align-items: center;
  gap: var(--peiq-space-2);
  padding: var(--peiq-space-2) var(--peiq-space-3);
  background: var(--peiq-surface);
  color: var(--peiq-text);
  border: 1px solid var(--peiq-border-strong);
  border-radius: var(--peiq-radius);
  box-shadow: var(--peiq-shadow-card-lg);
  font: 400 0.875rem/1.43 var(--peiq-font-ui);
}
.peiq-toast--success { border-color: var(--peiq-success); }
.peiq-toast--warning { border-color: var(--peiq-warning); }
.peiq-toast--error { border-color: var(--peiq-danger); }
```

### Table

```css
.peiq-table {
  width: 100%;
  border-collapse: collapse;
  background: var(--peiq-surface);
  font: 400 0.875rem/1.43 var(--peiq-font-ui);
}
.peiq-table th {
  padding: var(--peiq-space-2);
  color: var(--peiq-text-tertiary);
  border-bottom: 1px solid var(--peiq-bg-secondary);
  font: 600 0.75rem/1 var(--peiq-font-ui);
  letter-spacing: 0.04em;
  text-align: left;
  text-transform: uppercase;
}
.peiq-table td {
  padding: var(--peiq-space-2);
  border-bottom: 1px solid var(--peiq-bg-secondary);
}
.peiq-table tbody tr:hover td { background: var(--peiq-bg); }
```

### Canvas frame

```css
.peiq-canvas-frame {
  position: relative;
  min-height: 320px;
  overflow: hidden;
  border: 1px solid var(--peiq-border-strong);
  border-radius: var(--peiq-radius-lg);
  background-color: var(--peiq-checker-a);
  background-image: repeating-conic-gradient(
    var(--peiq-checker-b) 0% 25%,
    var(--peiq-checker-a) 0% 50%
  );
  background-size: 24px 24px;
}
.peiq-canvas-frame canvas {
  display: block;
  width: 100%;
  height: 100%;
}
.peiq-canvas-frame--pixelated canvas { image-rendering: pixelated; }
```

### Footer

```css
.peiq-footer {
  padding: var(--peiq-space-5) var(--peiq-space-3);
  border-top: 1px solid var(--peiq-border-strong);
  background: var(--peiq-bg);
  color: var(--peiq-text-tertiary);
  font: 400 0.875rem/1.43 var(--peiq-font-ui);
}
.peiq-footer a { color: var(--peiq-text-secondary); }
.peiq-footer a:hover { color: var(--peiq-accent); }
```

### Keyboard hint

```css
.peiq-kbd {
  display: inline-block;
  padding: 2px 6px;
  background: var(--peiq-bg-tertiary);
  color: var(--peiq-text-secondary);
  border: 1px solid var(--peiq-border-strong);
  border-bottom-width: 2px;
  border-radius: 4px;
  font: 600 0.75rem/1 var(--peiq-font-mono);
}
```

---

## 5. Layout Principles

**Container**

- Max width: **1600 px** (the site’s largest container).
- Page padding: **16 px** mobile, **24 px** ≥ 980 px.
- Editorial reading width: **840 px** for Guide sections; **62rem (620 px)** for hero
  subtitles.
- Header: **64 px**; subbar: **48 px**.
- App grid: `320px / minmax(0, 1fr) / 360px` at ≥ 1380 px.

```css
.peiq-shell {
  width: min(100%, 1600px);
  margin-inline: auto;
  padding-inline: 16px;
}
@media (min-width: 980px) {
  .peiq-shell { padding-inline: 24px; }
}

.peiq-app {
  display: grid;
  grid-template-columns: 320px minmax(0, 1fr) 360px;
  gap: var(--peiq-space-3);
  align-items: start;
  min-height: calc(100dvh - 112px); /* header + subbar */
}
.peiq-panel {
  min-width: 0;
  display: grid;
  gap: var(--peiq-space-3);
  align-content: start;
}
.peiq-panel--scroll {
  max-height: calc(100dvh - 144px);
  overflow: auto;
  padding-right: 4px;
}
.peiq-reading { max-width: 840px; }
```

**Spacing scale (exact site values)**

| Token | Value |
|---|---:|
| `--peiq-space-1` | 4 px |
| `--peiq-space-2` | 8 px |
| `--peiq-space-3` | 16 px |
| `--peiq-space-4` | 24 px |
| `--peiq-space-5` | 48 px |
| `--peiq-space-6` | 96 px |
| `--peiq-space-7` | 192 px |

| Context | Value |
|---|---|
| App panel gap | 16 px |
| Card padding | 24 px |
| Editorial section padding | 96 px desktop / 48 px tablet / 24 px mobile |
| Control vertical rhythm | 8–16 px |
| Button padding | 4 px 16 px |

**Grid**

- Editorial sections use a 12-column grid with 24 px gaps; cards span 3/4/6/12.
- App panels are single-column stacks; never nest complex grids in the left panel.
- The palette list scrolls independently; max 256 rows, no virtualization.
- The canvas takes remaining width; grid children use `min-width: 0`.

---

## 6. Depth & Elevation

The site’s depth is mostly surface steps + subtle shadows, not borders on everything.

| Level | Treatment | Use |
|---|---|---|
| Flat | No shadow; surface step | App panels, tables, inline groups |
| Standard | `0 2px 4px rgba(0,0,0,.05)` | Cards, boxes |
| Large | `rgba(5,5,6,.20) 0 8px 24px` | Elevated cards, toasts, popovers |
| Popover | `0 16px 40px rgba(5,5,6,.32)` | Info popovers, menus |
| Drawer | `-24px 0 64px rgba(5,5,6,.32)` | Help drawer |
| Accent button | Site’s blue triple shadow | Primary CTA only |
| Focus | 2 px blue ring; 4 px on primary buttons | All interactive elements |

Rules:

- Cards use `--peiq-surface` with **no border**; do not add a 1 px outline to every box.
- Hover feedback is a surface/background change or a shadow step; not a neon glow.
- Borders are reserved for inputs, dividers, header, and canvas edges.
- Do not put the large shadow on every card; it is for elevated/floating surfaces.

---

## 7. Animation & Interaction

**Motion philosophy:** state changes, not decoration. Animate opacity, transform, color,
and border. Never animate layout. The canvas is the only spectacle.

**Tier:** **L1** for the app. Editorial reveal is allowed only in the empty state and
Guide.

**Exact site timings**

```css
:root {
  --peiq-ease: ease-out;
  --peiq-dur-fast: 80ms;    /* site --transition-speed-fast */
  --peiq-dur: 150ms;        /* site --transition-speed */
  --peiq-dur-slow: 250ms;   /* site --transition-speed-slow */
}
```

### Entrance and reveal

The site uses `in-viewport-fade fade-up`:

```css
.peiq-reveal {
  opacity: 0;
  transform: translateY(60px);
  transition: opacity 1s, transform 0.5s;
}
.peiq-reveal.is-visible {
  opacity: 1;
  transform: translateY(0);
}
```

Use it only on the empty-state sections and Guide blocks. Never on the working panels,
the canvas, or the palette list. The app shell may fade in once:

```css
@keyframes peiq-fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}
.peiq-app { animation: peiq-fade-in 250ms ease-out both; }
```

```js
const io = new IntersectionObserver((entries) => {
  for (const entry of entries) {
    if (!entry.isIntersecting) continue;
    entry.target.classList.add('is-visible');
    io.unobserve(entry.target);
  }
}, { rootMargin: '0px 0px -10% 0px', threshold: 0.1 });

document.querySelectorAll('[data-reveal]').forEach((el) => {
  el.classList.add('peiq-reveal');
  io.observe(el);
});
```

### Hover and focus

- Buttons: background 150 ms; active `scale(0.95)`; focus-visible 4 px blue.
- Cards: shadow step + 2 px lift in 150 ms.
- Links: color 150 ms; underline offset 3 px.
- Swatches: scale 1.06 hover, 0.98 active; selected ring.
- Tabs: color/background 150 ms; selected solid blue.
- Drawer: transform 250 ms; no backdrop blur.
- Inputs: border/background 150 ms; focus ring via box-shadow.

### Processing state

- Fixed 2 px progress track with `transform: scaleX()`; no full-screen spinner.
- Keep the last result visible; overlay a subtle scrim and a status line.
- Throttle progress updates to ~10 Hz; cancel stays reachable.

### Reduced motion

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
  .peiq-reveal { opacity: 1; transform: none; }
}
```

### Performance rules

- Animate only `transform` and `opacity`; color/border transitions are cheap but ≤ 250 ms.
- No `filter: blur()` on moving elements; no large `backdrop-filter` areas.
- No video backgrounds, parallax, pinning, or scroll-jacking in the tool.
- `pointermove` listeners, if ever added, must be rAF-throttled.

---

## 8. Do's and Don'ts

### Do

- Use **blue** for interaction, **orange** only for the brand mark and one editorial
  highlight.
- Use Inter; fall back to the exact system stack if the self-hosted file is unavailable.
- Use the site’s charcoal stack: `#1c1e22` shell, `#25282d` body, `#30353b` boxes.
- Use 6 px radii for controls, 12 px for cards/boxes.
- Use 4/8/16/24/48/96 spacing; 24 px card padding.
- Use weight 300 section headings with weight 800 `<strong>` words.
- Use `text-wrap: balance` on headings and `pretty` on paragraphs.
- Keep the tool above the fold; editorial scale belongs to the empty state and Guide.
- Use tabular numbers for metrics and mono for hex/index values.
- Verify light-theme tokens when the light theme ships.
- Respect `prefers-reduced-motion`; keep every interaction keyboard-operable.

### Don't

- ❌ Copy Blender’s logo, wordmark, artwork, screenshots, CSS, or theme files.
- ❌ Use external images, videos, icon packs, Google Fonts, or any CDN asset.
- ❌ Turn the whole UI orange; orange is the brand mark, not the interaction color.
- ❌ Use white text on the bright blue gradient; use `--peiq-text-on-accent`.
- ❌ Use the release page’s per-feature pastel colors (pink/purple/green) in the tool.
- ❌ Put a marketing hero above the tool or push the canvas below the fold.
- ❌ Use glassmorphism, gradient text, neon glows, text shadows, or heavy shadows.
- ❌ Use scroll-jacking, parallax, pinned sections, GSAP/Lenis, or a custom cursor.
- ❌ Animate `width`, `height`, `top`, or `left`; animate transforms instead.
- ❌ Use `filter: blur()` on moving elements or large `backdrop-filter` surfaces.
- ❌ Use emoji as UI icons.
- ❌ Hard-code hex values in components or JS; use CSS variables.
- ❌ Add a border to every card; the site uses surface steps and shadow.
- ❌ Use color alone to communicate state; pair it with text or an icon.

---

## 9. Responsive Behavior

**Breakpoints (site values)**

| Name | Width | App behavior |
|---|---|---|
| Desktop | ≥ 1380 px | 3 columns: 320 / 1fr / 360; full header |
| Laptop | 1220–1379 px | 3 columns: 280 / 1fr / 320 |
| Tablet | 980–1219 px | 2 columns: 280 / 1fr; palette + QA become a tab below |
| Mobile | < 980 px | Stacked; sticky canvas; tabs: Controls / Palette / QA / Export |
| Small | < 600 px | Single column; 44 px targets; `PEIQ` header mark |

The site also uses 900/1680 px breakpoints; PEIQ keeps 900 px for type-scale changes and
1680 px as a wide-container cap.

**Touch targets:** minimum **44 × 44 px** on mobile; 32–36 px on desktop for dense
controls.

**Collapsing strategy**

- Header: full public name ≥ 980 px; `PEIQ` below. Help stays visible.
- Mode tabs move into the 48 px subbar; Export becomes an icon+label button.
- Left panel scrolls independently; sections collapse into `<details>` below 640 px.
- Palette panel becomes a tab; the palette list keeps its own scroll.
- QA table rows stack into label/value pairs below 640 px.
- Help drawer: full-width sheet below 980 px; close button in the header.
- Canvas: sticky at the top on mobile; never taller than `55dvh` unless zoomed.

```css
@media (max-width: 1379px) {
  .peiq-app { grid-template-columns: 280px minmax(0, 1fr); }
  .peiq-panel--right { grid-column: 1 / -1; }
}
@media (max-width: 979px) {
  .peiq-header { height: 56px; }
  .peiq-app { grid-template-columns: 1fr; }
  .peiq-panel--scroll { max-height: none; overflow: visible; }
  .peiq-drawer { width: 100%; }
  .peiq-reading { max-width: none; }
}
@media (max-width: 599px) {
  .peiq-shell { padding-inline: 16px; }
  .peiq-btn { min-height: 44px; }
  .peiq-input,
  .peiq-select { min-height: 44px; }
  .peiq-swatch { width: 44px; height: 44px; }
  .peiq-tab { min-height: 44px; }
  .peiq-footer { padding-block: 24px; }
}

/* No horizontal overflow, ever. */
img, canvas, video { max-width: 100%; }
```

**Accessibility**

- Every interactive element has hover and `focus-visible` states.
- Focus rings are visible on dark and light surfaces.
- Contrast: body ≥ 4.5:1; large text/components ≥ 3:1. `--peiq-text-tertiary` is for
  metadata only.
- Never remove native focus without a visible replacement.
- Touch targets ≥ 44 px on mobile.
- `prefers-reduced-motion` is a complete fallback.
- The Help drawer is a labelled dialog; focus moves in on open and returns on close;
  `Esc` closes it.

---

## Appendix A — Reference audit and exact-token mapping

**Source.** The saved `5.3 — Blender` page and its `style.css` (`bthree` theme) were
inspected locally. The following values were extracted, not guessed:

| Site token / rule | Value | PEIQ use |
|---|---|---|
| `--color-bg` | `#1c1e22` | `--peiq-bg` |
| `--color-bg-secondary` | `#25282d` | `--peiq-bg-secondary` |
| `--color-bg-tertiary` | `#202327` | `--peiq-bg-tertiary` |
| `--color-bg-primary` | `#30353b` | `--peiq-surface` |
| `--color-text` | `#c7cbd1` | `--peiq-text` |
| `--color-text-primary` | `#f9fafa` | `--peiq-text-strong` |
| `--color-text-secondary` | `#89939f` | `--peiq-text-secondary` |
| `--color-text-tertiary` | `#6e7987` | `--peiq-text-tertiary` |
| `--border-color` | `rgba(199,203,209,.15)` | `--peiq-border` |
| `--color-accent-h` | `204` | blue interaction accent |
| `--color-accent-s/l` | `100% / 50%` | `hsl(204 100% 50%)` |
| `--btn-color` | `#bec6d0` | `--peiq-btn-color` |
| `--btn-color-bg` | `#40474f` | `--peiq-btn-bg` |
| `--btn-color-bg-hover` | `#454c54` | `--peiq-btn-bg-hover` |
| `--btn-accent-bg-img` | `linear-gradient(350deg,#6183ff,#47aaf5)` | primary button |
| `--btn-accent-bg-img-hover` | `linear-gradient(350deg,#708fff,#5ab3f6)` | primary hover |
| `--btn-accent-box-shadow` | 3-layer blue shadow | primary button |
| `--input-color-bg` | `#25282d` | `--peiq-input-bg` |
| `--input-color-bg-hover` | `#202327` | `--peiq-input-bg-hover` |
| `--code-color` | `#d6b6d8` | `--peiq-code` |
| `--code-color-bg` | `rgba(208,38,217,.08)` | `--peiq-code-bg` |
| `--spacer` | `1.6rem` (16 px at 10 px root) | 16 px space scale |
| `--border-radius` | `.6rem` (6 px) | `--peiq-radius` |
| `--border-radius-lg` | `1.2rem` (12 px) | `--peiq-radius-lg` |
| `--transition-speed` | `150ms` | `--peiq-dur` |
| `--transition-speed-fast` | `80ms` | `--peiq-dur-fast` |
| `--transition-speed-slow` | `250ms` | `--peiq-dur-slow` |
| `--font-family-body` | `"Inter", ...` | `--peiq-font-ui` |
| `--fs-base` | 1.4/1.6/1.8rem at 900/1220 | 14/16/18 px equivalent |
| `--fs-hero-title` | 3.6/5.5/7.2rem; release override 5.2rem | empty-state clamp 36–52 px |
| `--fs-h1` | 2.8/3.2rem | 28/32 px |
| `--fs-h2` | 2.4/2.8rem | 24/28 px |
| `--fs-h4` | 1.8/2.1rem | 18/21 px |
| `--fw-light/bold/title` | 300/600/800 | same |
| `.box` | 24 px padding, 12 px radius, surface | cards |
| `.btn` | 4 px 16 px, 6 px radius, 500 | buttons |
| `.in-viewport-fade` | opacity 1s, transform .5s, translateY 60px | editorial reveal |
| `.hero` | min 480 px, max 560 px, white text | empty-state hero only |
| `.hero-subtitle` | `--fs-lg`, max 62rem | hero subtitle |
| `theme-color` | `#ed8f31` | `--peiq-brand` |

**Intentional deviations**

| Area | Site | PEIQ | Why |
|---|---|---|---|
| Theme default | Light-first with dark override | Dark primary, light optional | Image work; dark is easier on the eyes |
| Accent use | Blue UI + orange brand | Same | Exact brand logic |
| Button text | White on blue gradient | Dark text on blue gradient | WCAG AA; site is ≈ 2.9:1 |
| Root font size | `62.5%` (10 px) | 16 px with equivalent rem | Avoid the 62.5% accessibility hack |
| Content body | 18 px at wide screens | 14 px controls; 16/18 px editorial | Tool density |
| Feature colors | Pink/purple/green per section | Blue + orange only | Tool coherence |
| Motion | Reveal + parallax + video | L1 + editorial reveal only | Performance and focus |
| Artwork | 3D renders, screenshots, video | Live canvas, palette mosaic, SVG | No brand assets; offline |
| Cards | Surface + shadow, no border | Same | Exact |
| Fonts | Inter variable | Self-hosted Inter + OFL | Offline-first, zero CDN |

**Why this is exact enough:** the color stack, accent hue, brand orange, type scale,
weights, spacing, radii, shadows, button gradient, transition speeds, and editorial reveal
all come from the site’s CSS. What changes is the *application*: the tool stays dense,
dark, and fast instead of becoming a long-form marketing page.
