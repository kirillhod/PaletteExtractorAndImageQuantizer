# DESIGN.md

> A precise palette compiler with an editorial shell: charcoal, one warm orange light, big
> type where it helps, and nothing between the user and the pixels.

**Product:** PaletteExtractorAndImageQuantizer (short mark **PEIQ**)
**Reference:** [blender.org](https://www.blender.org/) — design-language inspiration, not a clone
**Scope:** single-page browser tool: app shell, empty state, working panels, Help drawer
**Constraints:** zero dependencies, no build step, no external/CDN fonts or images, offline-first, GPL-3.0
**Interaction tier:** **L1 — precise static**, plus one optional editorial reveal pattern
**Dependencies:** CSS only + a small vanilla `IntersectionObserver`; no GSAP, no Lenis, no WebGL
**Source of truth:** visual values and component CSS live here; behavior lives in
[`IMPLEMENTATION_PLAN.md`](IMPLEMENTATION_PLAN.md). If they disagree on a visual value,
this file wins; if they disagree on behavior, the plan wins.

---

## 1. Visual Theme & Atmosphere

**Style:** Editorial Charcoal / Blender-inspired.

**Keywords:** precise, warm, matte, editorial, technical, calm, high-contrast, tool-first.

**Tone:** confident and utilitarian — **NOT** corporate SaaS, gamer neon, glassmorphism,
or playful illustration. It should feel like a workshop, not a product launch.

**Feel:** a dark workshop with one orange task light: the image is the workbench, the
palette is the tool wall, and the theory is a well-printed manual on the side.

**Interaction Tier:** **L1**. State changes only: hover, focus, active, drawer open/close,
progress, and a single fade-up reveal for editorial sections. No scroll-jacking, no
parallax, no pinned scenes, no custom cursor.

**Reference notes**

- Adopt: charcoal surfaces, one orange accent, tight bold headlines, generous editorial
  whitespace, thin-bordered cards, uppercase section labels, matte surfaces, subtle motion.
- Do not copy: Blender’s logo, wordmark, artwork, screenshots, CSS/theme files, exact font,
  or 3D renders. The reference site is a marketing surface; this product is a tool.
- The tool is the hero: the empty state shows a live canvas/palette preview or a
  canvas-generated palette mosaic, never a stock render or a video.
- The working UI stays dense and scannable. Editorial scale is reserved for the empty
  state, the Guide drawer, and the footer — not for controls, tables, or data panels.

---

## 2. Color Palette & Roles

All colors are **CSS variables**. Components must never contain hard-coded hex values.
The `--peiq-` prefix is required by `AGENTS.md`.

```css
:root {
  /* Backgrounds */
  --peiq-bg: #1a1a1a;                 /* page / app shell */
  --peiq-bg-deep: #111111;            /* wells, inputs, canvas chrome */
  --peiq-surface: #232323;            /* panels, cards */
  --peiq-surface-alt: #2b2b2b;        /* alternating surface, hover base */
  --peiq-surface-hover: #303030;      /* hover surface */
  --peiq-paper: #f5f5f5;              /* editorial reading surface */
  --peiq-paper-alt: #ececec;          /* paper zebra / code block */
  --peiq-paper-ink: #1a1a1a;          /* text on paper */
  --peiq-paper-muted: #5c5c5c;        /* secondary text on paper */

  /* Borders */
  --peiq-border: #3a3a3a;             /* default structure */
  --peiq-border-strong: #4d4d4d;      /* inputs, secondary buttons */
  --peiq-border-hover: #ea7600;       /* interactive hover */

  /* Text */
  --peiq-text: #f2f2f2;               /* headings, primary text */
  --peiq-text-secondary: #c9c9c9;     /* body */
  --peiq-text-tertiary: #a3a3a3;      /* labels, metadata */
  --peiq-text-on-accent: #1a1a1a;     /* text on orange */
  --peiq-text-on-paper: #1a1a1a;

  /* Accent */
  --peiq-accent: #ea7600;             /* primary action, active, focus */
  --peiq-accent-hover: #ff8a1f;       /* hover / links on dark */
  --peiq-accent-pressed: #c85f00;     /* active press */
  --peiq-accent-ink: #a84800;         /* links / small text on paper */
  --peiq-accent-soft: rgba(234, 118, 0, 0.14);
  --peiq-accent-ring: rgba(234, 118, 0, 0.32);

  /* RGB variants for rgba() */
  --peiq-bg-rgb: 26, 26, 26;
  --peiq-surface-rgb: 35, 35, 35;
  --peiq-paper-rgb: 245, 245, 245;
  --peiq-accent-rgb: 234, 118, 0;

  /* Semantic */
  --peiq-success: #4ade80;
  --peiq-error: #ff5c5c;
  --peiq-warning: #f0b429;
  --peiq-info: #7cc4ff;
  --peiq-focus: #ff8a1f;

  /* Semantic RGB variants */
  --peiq-success-rgb: 74, 222, 128;
  --peiq-error-rgb: 255, 92, 92;
  --peiq-warning-rgb: 240, 180, 41;
  --peiq-info-rgb: 124, 196, 255;
  --peiq-paper-border: rgba(0, 0, 0, 0.12);

  /* Canvas */
  --peiq-checker-a: #202020;
  --peiq-checker-b: #262626;

  /* Shadows */
  --peiq-shadow-subtle: 0 1px 2px rgba(0, 0, 0, 0.40);
  --peiq-shadow-panel: 0 8px 24px rgba(0, 0, 0, 0.28);
  --peiq-shadow-popover: 0 16px 40px rgba(0, 0, 0, 0.45);
  --peiq-shadow-drawer: -24px 0 64px rgba(0, 0, 0, 0.45);

  /* Geometry */
  --peiq-radius: 10px;
  --peiq-radius-sm: 6px;
  --peiq-radius-pill: 999px;
}
```

**Color rules**

- Every color in a component comes from a variable above. No raw hex in
  `components.css`, `layout.css`, `learn.css`, or JS.
- Orange is an accent, never body text. On dark, links use `--peiq-accent-hover`. On
  paper, links and small text use `--peiq-accent-ink`; `--peiq-accent` is only for large
  text or icons on paper.
- Primary buttons use `--peiq-accent` with `--peiq-text-on-accent`. Do **not** use white
  text on orange: contrast is insufficient for normal text.
- Status colors are semantic only: success, warning, error, info. Never use them as
  decoration.
- Borders carry structure; shadows are rare (see §6).
- Opacity tints use `rgba(var(--peiq-accent-rgb), α)`, not a new hex.
- One accent per view. Do not introduce a second brand hue.

**Key contrast pairs (sRGB, approximate)**

| Pair | Ratio | Use |
|---|---:|---|
| `--peiq-text` on `--peiq-bg` | ≈ 15:1 | body/headings |
| `--peiq-text-tertiary` on `--peiq-bg` | ≈ 7:1 | labels, metadata |
| `--peiq-accent` on `--peiq-bg` | ≈ 5.3:1 | links, icons, focus |
| `--peiq-text-on-accent` on `--peiq-accent` | ≈ 5.3:1 | primary button |
| `--peiq-accent-ink` on `--peiq-paper` | ≈ 5.4:1 | links on paper |
| `--peiq-accent` on `--peiq-paper` | ≈ 2.7:1 | **not** for small text; icons/large only |
| `--peiq-text-on-paper` on `--peiq-paper` | ≈ 15:1 | Guide body |

---

## 3. Typography Rules

**No external font import.** The project is offline-first and dependency-free; a Google
Fonts `@import` is forbidden. The default is an intentional system stack. If the visual
review requires closer Blender-like typography, ship **one** self-hosted variable Inter
(OFL) under `assets/fonts/` with its license, and only then enable the commented face.

```css
:root {
  --peiq-font-ui: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
    "Helvetica Neue", Arial, "Noto Sans", sans-serif;
  --peiq-font-mono: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas,
    "Liberation Mono", monospace;
}

/*
Optional, only with assets/fonts/InterVariable.woff2 + OFL.txt:
@font-face {
  font-family: "PEIQ Inter";
  src: url("../assets/fonts/InterVariable.woff2") format("woff2");
  font-weight: 100 900;
  font-style: normal;
  font-display: swap;
}
:root { --peiq-font-ui: "PEIQ Inter", -apple-system, ...; }
*/
```

| Role | Font | Size | Weight | Line Height | Letter Spacing |
|---|---|---|---|---|---|
| Display / empty-state H1 | UI | `clamp(2.5rem, 6vw, 5rem)` | 800 | 1.02 | `-0.03em` |
| Section H2 (editorial) | UI | `clamp(1.75rem, 3.5vw, 2.75rem)` | 800 | 1.08 | `-0.02em` |
| App page title | UI | `1.5rem` (24 px) | 700 | 1.20 | `-0.01em` |
| H3 / panel title | UI | `1.125rem` (18 px) | 700 | 1.25 | `-0.01em` |
| Body (controls) | UI | `0.9375rem` (15 px) | 400 | 1.55 | 0 |
| Body (Guide) | UI | `1rem` (16 px) | 400 | 1.65 | 0 |
| Small / metadata | UI | `0.8125rem` (13 px) | 400 | 1.45 | 0 |
| Label / eyebrow | UI | `0.6875rem` (11 px) | 700 | 1.20 | `0.08em`, uppercase |
| Mono / hex / index | Mono | `0.8125rem` (13 px) | 400 | 1.40 | 0 |
| Button | UI | `0.875rem` (14 px) | 600 | 1.00 | 0 |

**Typography rules**

- Headings use weight 700–800 and tight tracking. Never fake bold/italic with shadows.
- Editorial display type is only for the empty state, Guide headings, and footer; app
  controls use the compact sizes above.
- Body line length in the Guide: **60–75ch**. Controls never exceed one line where a
  shorter label works.
- Uppercase only for labels/eyebrows, never for body copy.
- Numbers in QA/timings use `font-variant-numeric: tabular-nums`. Hex values use mono.
- No gradient text, no text-shadow, no decorative outlines. This is an L1 editorial
  system; hierarchy comes from size, weight, and color.
- **NEVER use:** Comic Sans, Papyrus, Brush Script, decorative display fonts, script
  fonts, or a serif for UI controls.
- Do not load a second display font. One family is enough.

**Text decoration decisions**

| Element | Gradient | Shadow | Decision |
|---|---|---|---|
| Empty-state H1 | No | No | Solid `--peiq-text`; optional one accent word or eyebrow |
| Section H2 | No | No | Solid; eyebrow above carries color |
| H3 | No | No | Solid |
| Body | No | No | Plain |
| Links | No | No | Color + underline offset; no glow |
| Eyebrow | No | No | Orange uppercase + optional 2 px bottom border |

---

## 4. Component Stylings

All components use the variables from §2. States are mandatory: default, hover, active,
focus-visible, disabled. Dynamic colors (palette swatches) are the only allowed inline
style: set `--swatch` on the element; never write a hex into JS.

### Global focus

```css
:where(a, button, input, select, textarea, [tabindex]):focus-visible {
  outline: 2px solid var(--peiq-focus);
  outline-offset: 2px;
}
```

### Buttons

```css
.peiq-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 36px;
  padding: 0 14px;
  border: 1px solid var(--peiq-border-strong);
  border-radius: var(--peiq-radius-sm);
  background: transparent;
  color: var(--peiq-text);
  font: 600 0.875rem/1 var(--peiq-font-ui);
  cursor: pointer;
  transition:
    background-color 120ms var(--peiq-ease),
    border-color 120ms var(--peiq-ease),
    color 120ms var(--peiq-ease),
    transform 120ms var(--peiq-ease);
}
.peiq-btn:hover {
  border-color: var(--peiq-accent);
  color: var(--peiq-accent-hover);
}
.peiq-btn:active { transform: translateY(1px); }
.peiq-btn:focus-visible {
  outline: 2px solid var(--peiq-focus);
  outline-offset: 2px;
}
.peiq-btn:disabled,
.peiq-btn[aria-disabled="true"] {
  opacity: 0.45;
  cursor: not-allowed;
  transform: none;
}

.peiq-btn--primary {
  background: var(--peiq-accent);
  border-color: var(--peiq-accent);
  color: var(--peiq-text-on-accent);
}
.peiq-btn--primary:hover {
  background: var(--peiq-accent-hover);
  border-color: var(--peiq-accent-hover);
  color: var(--peiq-text-on-accent);
}
.peiq-btn--primary:active {
  background: var(--peiq-accent-pressed);
  border-color: var(--peiq-accent-pressed);
}

.peiq-btn--ghost {
  border-color: transparent;
  color: var(--peiq-text-secondary);
}
.peiq-btn--ghost:hover {
  background: var(--peiq-surface-hover);
  border-color: transparent;
  color: var(--peiq-text);
}

.peiq-btn--icon {
  width: 36px;
  padding: 0;
}

.peiq-btn--danger:hover {
  border-color: var(--peiq-error);
  color: var(--peiq-error);
}
```

### Cards

```css
.peiq-card {
  background: var(--peiq-surface);
  border: 1px solid var(--peiq-border);
  border-radius: var(--peiq-radius);
  padding: 16px;
}
.peiq-card--interactive {
  transition:
    border-color 120ms var(--peiq-ease),
    transform 120ms var(--peiq-ease);
}
.peiq-card--interactive:hover {
  border-color: var(--peiq-accent);
  transform: translateY(-2px);
}
.peiq-card:focus-within { border-color: var(--peiq-accent); }
.peiq-card--paper {
  background: var(--peiq-paper);
  color: var(--peiq-paper-ink);
  border-color: transparent;
}
.peiq-card--flat { box-shadow: none; }
.peiq-card--elevated { box-shadow: var(--peiq-shadow-panel); }
```

### Header / navigation

```css
.peiq-header {
  position: sticky;
  top: 0;
  z-index: 40;
  display: flex;
  align-items: center;
  gap: 16px;
  min-height: 64px;
  padding: 0 clamp(16px, 3vw, 32px);
  background: rgba(var(--peiq-bg-rgb), 0.92);
  border-bottom: 1px solid var(--peiq-border);
  transition: box-shadow 120ms var(--peiq-ease);
}
.peiq-header--scrolled { box-shadow: var(--peiq-shadow-subtle); }

.peiq-nav { display: flex; align-items: center; gap: 4px; }
.peiq-nav__link {
  display: inline-flex;
  align-items: center;
  min-height: 32px;
  padding: 0 10px;
  border-radius: var(--peiq-radius-sm);
  color: var(--peiq-text-secondary);
  font: 600 0.8125rem/1 var(--peiq-font-ui);
  text-decoration: none;
  transition: color 120ms var(--peiq-ease), background-color 120ms var(--peiq-ease);
}
.peiq-nav__link:hover {
  color: var(--peiq-text);
  background: var(--peiq-surface-hover);
}
.peiq-nav__link[aria-current="page"] {
  color: var(--peiq-accent-hover);
  background: var(--peiq-accent-soft);
}
.peiq-nav__link:focus-visible {
  outline: 2px solid var(--peiq-focus);
  outline-offset: 2px;
}
```

### Links

```css
.peiq-link {
  color: var(--peiq-accent-hover);
  text-decoration: underline;
  text-decoration-thickness: 1px;
  text-underline-offset: 3px;
  transition: color 120ms var(--peiq-ease);
}
.peiq-link:hover { color: var(--peiq-text); }
.peiq-link:focus-visible {
  outline: 2px solid var(--peiq-focus);
  outline-offset: 2px;
}
.peiq-link--paper { color: var(--peiq-accent-ink); }
.peiq-link--paper:hover { color: var(--peiq-paper-ink); }
```

### Tags / badges

```css
.peiq-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 22px;
  padding: 0 8px;
  border: 1px solid var(--peiq-border);
  border-radius: var(--peiq-radius-pill);
  color: var(--peiq-text-secondary);
  font: 700 0.6875rem/1 var(--peiq-font-ui);
  letter-spacing: 0.04em;
  text-transform: uppercase;
}
.peiq-badge--accent {
  color: var(--peiq-accent-hover);
  border-color: rgba(var(--peiq-accent-rgb), 0.45);
  background: var(--peiq-accent-soft);
}
.peiq-badge--success { color: var(--peiq-success); border-color: rgba(var(--peiq-success-rgb), 0.35); }
.peiq-badge--warning { color: var(--peiq-warning); border-color: rgba(var(--peiq-warning-rgb), 0.35); }
.peiq-badge--error { color: var(--peiq-error); border-color: rgba(var(--peiq-error-rgb), 0.35); }
```

### Form controls

```css
.peiq-field { display: grid; gap: 6px; }

.peiq-label {
  color: var(--peiq-text-tertiary);
  font: 700 0.6875rem/1.2 var(--peiq-font-ui);
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.peiq-input,
.peiq-select {
  min-height: 36px;
  padding: 0 10px;
  background: var(--peiq-bg-deep);
  color: var(--peiq-text);
  border: 1px solid var(--peiq-border);
  border-radius: var(--peiq-radius-sm);
  font: 400 0.875rem/1.4 var(--peiq-font-ui);
}
.peiq-input:hover,
.peiq-select:hover { border-color: var(--peiq-border-strong); }
.peiq-input:focus-visible,
.peiq-select:focus-visible {
  outline: 2px solid var(--peiq-focus);
  outline-offset: 1px;
  border-color: var(--peiq-accent);
}
.peiq-input:disabled,
.peiq-select:disabled {
  opacity: 0.45;
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
.peiq-range:disabled { opacity: 0.45; cursor: not-allowed; }

.peiq-check {
  width: 18px;
  height: 18px;
  accent-color: var(--peiq-accent);
}
.peiq-check:focus-visible {
  outline: 2px solid var(--peiq-focus);
  outline-offset: 2px;
}
```

### Tabs

```css
.peiq-tabs {
  display: flex;
  gap: 2px;
  padding: 4px;
  background: var(--peiq-bg-deep);
  border: 1px solid var(--peiq-border);
  border-radius: var(--peiq-radius-sm);
}
.peiq-tab {
  min-height: 32px;
  padding: 0 12px;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: var(--peiq-text-secondary);
  font: 600 0.8125rem/1 var(--peiq-font-ui);
  cursor: pointer;
  transition: color 120ms var(--peiq-ease), background-color 120ms var(--peiq-ease);
}
.peiq-tab:hover {
  color: var(--peiq-text);
  background: var(--peiq-surface-hover);
}
.peiq-tab[aria-selected="true"] {
  color: var(--peiq-text-on-accent);
  background: var(--peiq-accent);
}
.peiq-tab:focus-visible {
  outline: 2px solid var(--peiq-focus);
  outline-offset: 2px;
}
.peiq-tab:disabled { opacity: 0.45; cursor: not-allowed; }
```

### Palette swatches

```css
.peiq-swatch {
  position: relative;
  width: 32px;
  height: 32px;
  border: 1px solid var(--peiq-border-strong);
  border-radius: var(--peiq-radius-sm);
  background: var(--swatch, var(--peiq-surface-alt));
  cursor: pointer;
  transition:
    transform 120ms var(--peiq-ease),
    box-shadow 120ms var(--peiq-ease),
    border-color 120ms var(--peiq-ease);
}
.peiq-swatch:hover {
  transform: scale(1.06);
  border-color: var(--peiq-text);
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
.peiq-swatch:disabled { opacity: 0.45; cursor: not-allowed; }
```

> Dynamic swatch color: set `element.style.setProperty('--swatch', '#rrggbb')` from the
> palette entry. This is the only permitted inline style. Never write a color literal into
> a component stylesheet.

### Drawer and popover

```css
.peiq-drawer {
  position: fixed;
  inset: 0 0 0 auto;
  z-index: 60;
  width: min(360px, 92vw);
  overflow: auto;
  background: var(--peiq-paper);
  color: var(--peiq-paper-ink);
  border-left: 1px solid var(--peiq-paper-border);
  box-shadow: var(--peiq-shadow-drawer);
  transform: translateX(100%);
  transition: transform 200ms var(--peiq-ease);
}
.peiq-drawer[data-open="true"] { transform: translateX(0); }
.peiq-drawer a { color: var(--peiq-accent-ink); }

.peiq-popover {
  z-index: 50;
  max-width: 320px;
  padding: 12px;
  background: var(--peiq-surface);
  color: var(--peiq-text);
  border: 1px solid var(--peiq-border-strong);
  border-radius: var(--peiq-radius);
  box-shadow: var(--peiq-shadow-popover);
  font: 400 0.8125rem/1.5 var(--peiq-font-ui);
}
```

### Status, QA stats, toasts

```css
.peiq-stat { display: grid; gap: 2px; }
.peiq-stat__value {
  color: var(--peiq-text);
  font: 700 1.25rem/1.1 var(--peiq-font-ui);
  font-variant-numeric: tabular-nums;
}
.peiq-stat__label {
  color: var(--peiq-text-tertiary);
  font: 700 0.6875rem/1.2 var(--peiq-font-ui);
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.peiq-stat--warning .peiq-stat__value { color: var(--peiq-warning); }
.peiq-stat--error .peiq-stat__value { color: var(--peiq-error); }

.peiq-toast {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  background: var(--peiq-surface);
  color: var(--peiq-text);
  border: 1px solid var(--peiq-border-strong);
  border-radius: var(--peiq-radius-sm);
  box-shadow: var(--peiq-shadow-panel);
  font: 400 0.8125rem/1.4 var(--peiq-font-ui);
}
.peiq-toast--success { border-color: rgba(var(--peiq-success-rgb), 0.45); }
.peiq-toast--warning { border-color: rgba(var(--peiq-warning-rgb), 0.45); }
.peiq-toast--error { border-color: rgba(var(--peiq-error-rgb), 0.45); }
```

### Table

```css
.peiq-table {
  width: 100%;
  border-collapse: collapse;
  font: 400 0.8125rem/1.4 var(--peiq-font-ui);
}
.peiq-table th {
  padding: 8px;
  color: var(--peiq-text-tertiary);
  border-bottom: 1px solid var(--peiq-border);
  font: 700 0.6875rem/1.2 var(--peiq-font-ui);
  letter-spacing: 0.08em;
  text-align: left;
  text-transform: uppercase;
}
.peiq-table td {
  padding: 8px;
  border-bottom: 1px solid var(--peiq-border);
}
.peiq-table tbody tr:hover td { background: var(--peiq-surface-hover); }
```

### Canvas frame

```css
.peiq-canvas-frame {
  position: relative;
  min-height: 320px;
  overflow: hidden;
  border: 1px solid var(--peiq-border);
  border-radius: var(--peiq-radius);
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
  padding: 32px clamp(16px, 3vw, 32px);
  border-top: 1px solid var(--peiq-border);
  color: var(--peiq-text-tertiary);
  font: 400 0.8125rem/1.5 var(--peiq-font-ui);
}
.peiq-footer a { color: var(--peiq-text-secondary); }
.peiq-footer a:hover { color: var(--peiq-accent-hover); }
```

### Keyboard hint

```css
.peiq-kbd {
  display: inline-block;
  padding: 4px 6px;
  background: var(--peiq-bg-deep);
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

- App shell max width: **1600 px**.
- Page padding: `clamp(16px, 3vw, 32px)`.
- Editorial reading width: **72ch**; never full-width paragraphs.
- Header height: **64 px** desktop, **56 px** mobile.
- App grid: `320px / minmax(0, 1fr) / 360px` at ≥1280 px.

```css
.peiq-shell {
  width: min(100%, 1600px);
  margin-inline: auto;
  padding-inline: clamp(16px, 3vw, 32px);
}

.peiq-app {
  display: grid;
  grid-template-columns: 320px minmax(0, 1fr) 360px;
  gap: 16px;
  align-items: start;
  min-height: calc(100dvh - 64px);
}

.peiq-panel {
  min-width: 0;              /* critical: prevents grid overflow */
  display: grid;
  gap: 16px;
  align-content: start;
}
.peiq-panel--scroll {
  max-height: calc(100dvh - 96px);
  overflow: auto;
  padding-right: 4px;
}
.peiq-reading { max-width: 72ch; }
```

**Spacing scale**

`4 / 8 / 12 / 16 / 24 / 32 / 48 / 64 px`

| Context | Value |
|---|---|
| App panel gap | 16 px |
| Card padding | 16 px |
| Editorial card padding | 24–32 px |
| Section padding (desktop) | 96 px |
| Section padding (tablet) | 64 px |
| Section padding (mobile) | 48 px |
| Control vertical rhythm | 8–12 px |

**Grid**

- Editorial sections use a 12-column grid with 24 px gaps; cards may span 3/4/6/12.
- App panels are single-column stacks; do not nest complex grids inside the left panel.
- The palette list scrolls independently; max 256 rows, no virtualization.
- The canvas takes remaining width and must not force horizontal overflow.

---

## 6. Depth & Elevation

Borders first, shadows second. Matte surfaces; no glassmorphism.

| Level | Treatment | Use |
|---|---|---|
| Flat | No shadow; `1px` border | Panels, cards, inputs, tables |
| Subtle | `0 1px 2px rgba(0,0,0,.40)` | Sticky header after scroll, small raised rows |
| Panel | `0 8px 24px rgba(0,0,0,.28)` | Floating status/toast, compact popover |
| Popover | `0 16px 40px rgba(0,0,0,.45)` | Info popovers, menus |
| Drawer | `-24px 0 64px rgba(0,0,0,.45)` | Help drawer |
| Focus | `2px` orange ring, `2px` offset | All interactive elements |

Rules:

- Do not put a shadow on every card; that makes the UI noisy.
- Hover feedback is a border color change plus an optional 2 px lift — not a glow.
- Paper surfaces use a hairline border or a very subtle shadow, never a dark glow.
- Shadows are never the only affordance; hover/focus/active must also change color or border.

---

## 7. Animation & Interaction

**Motion philosophy:** state changes, not decoration. Animate opacity, transform, color,
and border; never animate layout. The canvas is the only “spectacle”.

**Tier:** **L1**. No GSAP/ScrollTrigger/Lenis. No parallax, pinning, scroll-jacking,
custom cursor, or WebGL.

```css
:root {
  --peiq-ease: cubic-bezier(0.2, 0.8, 0.2, 1);
  --peiq-dur-fast: 120ms;
  --peiq-dur: 180ms;
  --peiq-dur-slow: 240ms;
}
```

### Entrance animation

```css
@keyframes peiq-fade-up {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: none; }
}

.peiq-reveal {
  opacity: 0;
  transform: translateY(8px);
  transition:
    opacity var(--peiq-dur) var(--peiq-ease),
    transform var(--peiq-dur) var(--peiq-ease);
}
.peiq-reveal.is-visible {
  opacity: 1;
  transform: none;
}

/* App shell: one short fade on first paint, no stagger. */
.peiq-app { animation: peiq-fade-up var(--peiq-dur-slow) var(--peiq-ease) both; }
```

### Scroll behavior

Only editorial content (empty state, Guide sections) may reveal. App panels never animate
on scroll. Use a native `IntersectionObserver`; unobserve after the first reveal.

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

- Buttons: border/color 120 ms; primary background 120 ms; active translateY(1px).
- Cards: border orange + translateY(-2px) in 120 ms.
- Links: color 120 ms; underline offset from CSS.
- Swatches: scale 1.06 on hover, 0.98 on active.
- Tabs: background/color 120 ms; selected is a solid orange fill.
- Drawer: transform 200 ms; no backdrop blur; content remains readable.

### Processing state

- Use a 2 px progress bar with `transform: scaleX()` or `width` transition on a fixed
  track; no full-screen spinner.
- Keep the last result visible; overlay a subtle dark scrim and a status line.
- Cancel is always reachable; progress updates are throttled to ~10 Hz.

### Reduced motion

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
  .peiq-reveal { opacity: 1; transform: none; }
}
```

### Performance rules

- Animate only `transform` and `opacity`; color/border transitions are cheap but keep them
  under 200 ms.
- No `filter: blur()` on moving elements. No large `backdrop-filter` areas; if ever used,
  cap at 14 px and a small surface.
- `pointermove` listeners, if added later, must be rAF-throttled.
- The canvas is not animated by CSS; it is painted imperatively.

---

## 8. Do's and Don'ts

### Do

- Keep the tool above the fold; editorial scale belongs to the empty state and Guide.
- Use **one** orange accent for primary action, active state, focus, and links.
- Build hierarchy with borders, spacing, weight, and muted text — not shadows.
- Use compact type in controls (13–15 px) and editorial type in reading surfaces.
- Use tabular numbers for metrics and mono for hex/index values.
- Use `--peiq-accent-ink` for small text on paper; use dark text on orange buttons.
- Use inline SVG for icons; keep them 16/20 px and stroke-based.
- Respect `prefers-reduced-motion` and keep all interactions keyboard-operable.
- Let the live canvas or a generated palette mosaic be the visual hook.
- Keep the design matte: flat surfaces, hairline borders, restrained shadows.

### Don't

- ❌ Copy Blender’s logo, wordmark, artwork, screenshots, CSS, or theme files.
- ❌ Use external images, videos, icon packs, Google Fonts, or any CDN asset.
- ❌ Put a marketing hero above the tool or push the canvas below the fold.
- ❌ Use orange for body text or small text on light paper.
- ❌ Use white text on orange buttons; use `--peiq-text-on-accent`.
- ❌ Use glassmorphism, gradient text, neon glows, heavy shadows, or noise textures.
- ❌ Use scroll-jacking, parallax, pinned sections, GSAP/Lenis, or a custom cursor.
- ❌ Animate `width`, `height`, `top`, or `left`; animate transforms instead.
- ❌ Use `filter: blur()` on moving elements or large `backdrop-filter` surfaces.
- ❌ Use emoji as UI icons.
- ❌ Hard-code hex values in components or JS; use CSS variables.
- ❌ Make every card a different size/shadow just for visual interest.
- ❌ Ship a first-run tour, modal onboarding, or permanently visible paragraphs.
- ❌ Use color alone to communicate state; pair it with text or an icon.

---

## 9. Responsive Behavior

**Breakpoints**

| Name | Width | Key changes |
|---|---|---|
| Desktop | ≥ 1280 px | 3-column app: controls / canvas / palette+QA. Full header. |
| Tablet | 960–1279 px | 2 columns: controls / canvas; palette + QA become a tab below. Side panel 280 px. |
| Mobile | < 960 px | Stacked; canvas sticky at top; tabs: Controls / Palette / QA / Export. Help drawer full-height. |
| Small mobile | < 640 px | Single column; 44 px touch targets; compact header with `PEIQ` mark. |

**Touch targets:** minimum **44×44 px** on mobile; 32–36 px is acceptable on desktop for
dense controls.

**Collapsing strategy**

- Header: full public name ≥ 960 px; `PEIQ` below. Mode tabs become icon+label or a
  segmented control; Help stays visible.
- Left panel: scrolls independently; sections become collapsible `<details>` below 640 px.
- Palette panel: becomes a tab; the palette list keeps its own scroll.
- QA: table rows stack into label/value pairs below 640 px.
- Help drawer: full-width sheet below 960 px; close button in the header.
- Canvas: sticky at the top on mobile; never taller than `55dvh` unless the user zooms.

```css
@media (max-width: 1279px) {
  .peiq-app { grid-template-columns: 280px minmax(0, 1fr); }
  .peiq-panel--right { grid-column: 1 / -1; }
}

@media (max-width: 959px) {
  .peiq-header { min-height: 56px; }
  .peiq-app { grid-template-columns: 1fr; }
  .peiq-panel--scroll { max-height: none; overflow: visible; }
  .peiq-drawer { width: 100%; }
  .peiq-reading { max-width: none; }
}

@media (max-width: 639px) {
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

- Every interactive element has `hover` and `focus-visible` states.
- Focus rings are visible on dark and paper surfaces.
- Contrast: body ≥ 4.5:1; large text/components ≥ 3:1.
- Do not remove native focus outlines without replacing them.
- Touch targets ≥ 44 px on mobile.
- `prefers-reduced-motion` is a complete fallback, not a partial one.
- The Help drawer is a labelled dialog; focus moves in on open and returns to the trigger
  on close; `Esc` closes it.

---

## Appendix A — Reference audit and intentional deviations

**Access note:** automated access to [blender.org](https://www.blender.org/) returned a
Cloudflare challenge (HTTP 403, “Just a moment…”), so no CSS tokens, section count, or
motion audit could be extracted. This document is an **intentional interpretation of the
public design language**, not a token-for-token reproduction.

**Aligned**

- Charcoal surfaces + a single warm orange accent.
- Tight, bold editorial headlines and uppercase section labels.
- Thin-bordered cards, generous editorial whitespace, matte surfaces.
- Subtle state-driven motion rather than spectacle.

**Intentionally different**

| Area | Blender site | PEIQ | Why |
|---|---|---|---|
| Purpose | Marketing/showcase | Working tool | The tool must stay above the fold |
| Typography | Custom/brand font | System stack; optional self-hosted Inter | Zero external fonts/CDN |
| Artwork | 3D renders, screenshots, video | Live canvas, palette mosaic, SVG, own screenshots | No brand assets; no heavy media |
| Motion | L2/L3 marketing motion | L1 state motion + one reveal | Performance and focus |
| Density | Airy marketing sections | Dense controls; editorial only in empty/Guide | Usability |
| Brand | Blender logo/wordmark | PEIQ name/wordmark | Trademark; no copying |
| Fonts/images | External assets | Local only | Offline-first, zero dependencies |

**Why this is the right adaptation:** the product is judged by the accuracy of its output,
not by the drama of its landing page. The editorial shell gives it warmth and identity;
the working surface stays precise, fast, and readable.
