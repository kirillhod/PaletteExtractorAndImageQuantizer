// @ts-check
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

import {
  THEME_MODES,
  nextThemeMode,
  normalizeThemeMode,
  resolveTheme,
} from '../js/core/theme-mode.js';

const tokensCss = fs.readFileSync(new URL('../css/tokens.css', import.meta.url), 'utf8');
const themeInit = fs.readFileSync(new URL('../js/theme-init.js', import.meta.url), 'utf8');

/**
 * Tokens CSS declares in `:root` (dark) and overrides in `[data-theme="light"]`.
 * The list comes from DESIGN.md "Theme parity" and is the contract the UI follows.
 */
const REQUIRED_TOKENS = [
  '--peiq-bg',
  '--peiq-bg-secondary',
  '--peiq-bg-tertiary',
  '--peiq-surface',
  '--peiq-surface-hover',
  '--peiq-text',
  '--peiq-text-strong',
  '--peiq-text-secondary',
  '--peiq-text-tertiary',
  '--peiq-link',
  '--peiq-link-hover',
  '--peiq-border',
  '--peiq-border-strong',
  '--peiq-btn-color',
  '--peiq-btn-bg',
  '--peiq-btn-bg-hover',
  '--peiq-input-bg',
  '--peiq-input-bg-hover',
  '--peiq-input-border',
  '--peiq-code',
  '--peiq-code-bg',
  '--peiq-success',
  '--peiq-success-bg',
  '--peiq-success-text',
  '--peiq-warning',
  '--peiq-warning-bg',
  '--peiq-warning-text',
  '--peiq-danger',
  '--peiq-danger-bg',
  '--peiq-danger-text',
  '--peiq-info',
  '--peiq-info-bg',
  '--peiq-info-text',
  '--peiq-shadow-card',
  '--peiq-shadow-card-lg',
  '--peiq-shadow-popover',
  '--peiq-shadow-drawer',
  '--peiq-brand-soft',
  '--peiq-brand-text',
  '--peiq-brand-ink',
  '--peiq-checker-a',
  '--peiq-checker-b',
  '--peiq-text-on-accent',
];

/**
 * @param {string} selector
 * @returns {Set<string>}
 */
function tokensInBlock(selector) {
  const start = tokensCss.indexOf(selector);
  assert.notEqual(start, -1, `missing ${selector}`);
  const open = tokensCss.indexOf('{', start);
  const close = tokensCss.indexOf('}', open);
  assert.ok(open > 0 && close > open, `unterminated ${selector}`);
  const block = tokensCss.slice(open + 1, close);
  return new Set([...block.matchAll(/--peiq-[a-z0-9-]+(?=\s*:)/g)].map((match) => match[0]));
}

test('every required theme token is declared in both themes', () => {
  const dark = tokensInBlock(':root');
  const light = tokensInBlock('[data-theme="light"]');

  for (const token of REQUIRED_TOKENS) {
    assert.ok(dark.has(token), `${token} missing from :root`);
    assert.ok(light.has(token), `${token} missing from [data-theme="light"]`);
  }
});

test('component CSS never overrides tokens per theme', () => {
  const cssDir = new URL('../css/', import.meta.url);
  for (const name of fs.readdirSync(cssDir)) {
    if (!name.endsWith('.css') || name === 'tokens.css') continue;
    const css = fs.readFileSync(new URL(name, cssDir), 'utf8');
    assert.ok(!css.includes('[data-theme'), `${name} must use tokens, not theme overrides`);
  }
});

test('auto follows the system and manual modes always win', () => {
  assert.equal(resolveTheme('auto', true), 'dark');
  assert.equal(resolveTheme('auto', false), 'light');
  assert.equal(resolveTheme('light', true), 'light');
  assert.equal(resolveTheme('dark', false), 'dark');
});

test('the toggle cycles auto, light, dark and back', () => {
  assert.deepEqual([...THEME_MODES], ['auto', 'light', 'dark']);
  assert.equal(nextThemeMode('auto'), 'light');
  assert.equal(nextThemeMode('light'), 'dark');
  assert.equal(nextThemeMode('dark'), 'auto');
  assert.equal(nextThemeMode('auto'), 'light');
});

test('invalid stored values fall back to auto', () => {
  assert.equal(normalizeThemeMode('sepia'), 'auto');
  assert.equal(normalizeThemeMode(null), 'auto');
  assert.equal(normalizeThemeMode(undefined), 'auto');
  assert.equal(normalizeThemeMode('light'), 'light');
  assert.equal(normalizeThemeMode('dark'), 'dark');
});

/**
 * Run the classic pre-paint script against a fake browser.
 *
 * @param {{ stored?: string|null, prefersLight?: boolean, failStorage?: boolean }} options
 */
function runThemeInit({ stored = null, prefersLight = false, failStorage = false }) {
  /** @type {Record<string, string>} */
  const root = {};
  /** @type {Record<string, string>} */
  const meta = {};
  const document = {
    documentElement: {
      setAttribute(/** @type {string} */ name, /** @type {string} */ value) {
        root[name] = value;
      },
    },
    querySelector(/** @type {string} */ selector) {
      if (!selector.includes('theme-color')) return null;
      return {
        setAttribute(/** @type {string} */ name, /** @type {string} */ value) {
          meta[name] = value;
        },
      };
    },
  };
  const window = {
    localStorage: {
      getItem(/** @type {string} */ key) {
        if (failStorage) throw new Error('storage blocked');
        return key === 'peiq.theme' ? stored : null;
      },
    },
    matchMedia() {
      return { matches: prefersLight };
    },
  };
  const navigator = { languages: ['en-US'], language: 'en-US' };

  vm.runInNewContext(themeInit, { window, document, navigator });
  return { root, meta };
}

test('theme-init resolves stored modes before paint', () => {
  assert.equal(runThemeInit({ stored: 'dark' }).root['data-theme'], 'dark');
  assert.equal(runThemeInit({ stored: 'light' }).root['data-theme'], 'light');
  assert.equal(runThemeInit({ stored: 'auto', prefersLight: true }).root['data-theme'], 'light');
  assert.equal(runThemeInit({ stored: 'auto', prefersLight: false }).root['data-theme'], 'dark');
});

test('theme-init treats a corrupt or blocked store as auto', () => {
  const corrupt = runThemeInit({ stored: 'sepia', prefersLight: true });
  assert.equal(corrupt.root['data-theme-mode'], 'auto');
  assert.equal(corrupt.root['data-theme'], 'light');

  const blocked = runThemeInit({ failStorage: true });
  assert.equal(blocked.root['data-theme-mode'], 'auto');
  assert.equal(blocked.root['data-theme'], 'dark');
  assert.equal(blocked.root.lang, 'en');
});

test('theme-init updates the theme-color meta tag', () => {
  assert.equal(runThemeInit({ stored: 'dark' }).meta.content, '#1c1e22');
  assert.equal(runThemeInit({ stored: 'light' }).meta.content, '#f5f5f5');
});
