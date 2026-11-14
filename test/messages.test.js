// @ts-check
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { MESSAGES } from '../js/content/messages.js';
import { CREDITS, REFERENCE_GROUPS } from '../js/content/references.js';

const root = new URL('../', import.meta.url);
const namespaces = new Set([
  'app',
  'header',
  'locale',
  'theme',
  'hero',
  'export',
  'toolbar',
  'canvas',
  'divider',
  'palette',
  'rail',
  'mode',
  'method',
  'colors',
  'space',
  'targetPalette',
  'transparent',
  'alpha',
  'dither',
  'quality',
  'status',
  'unit',
  'count',
  'session',
  'footer',
  'help',
  'references',
  'credits',
  'toast',
  'error',
  'validation',
]);

/** @param {string} path */
function read(path) {
  return fs.readFileSync(new URL(path, root), 'utf8');
}

/** @param {string} key */
function hasKey(key) {
  return key in MESSAGES.en && key in MESSAGES.ru;
}

/** @param {string} key */
function hasPluralBase(key) {
  return (
    hasKey(`${key}.one`) &&
    hasKey(`${key}.other`) &&
    hasKey(`${key}.few`) &&
    hasKey(`${key}.many`)
  );
}

/** @param {Set<string>} keys */
function assertCovered(keys) {
  const missing = [...keys].filter((key) => !hasKey(key) && !hasPluralBase(key));
  assert.deepEqual(missing, [], `missing message keys: ${missing.join(', ')}`);
}

test('English and Russian catalogs expose the same keys', () => {
  const en = Object.keys(MESSAGES.en).sort();
  const ru = Object.keys(MESSAGES.ru).sort();
  assert.deepEqual(ru, en);
});

test('every static data-i18n annotation has both translations', () => {
  const html = read('index.html');
  const keys = new Set(
    [...html.matchAll(/data-i18n(?:-[a-z-]+)?="([^"]+)"/g)].map((match) => match[1]),
  );
  assert.ok(keys.size > 100, 'expected the static UI to be annotated');
  assertCovered(keys);
});

test('every literal message key used by the UI has both translations', () => {
  const files = [
    'js/main.js',
    'js/ui/i18n.js',
    'js/ui/theme.js',
    'js/ui/learn-view.js',
    'js/ui/palette-view.js',
    'js/ui/status.js',
    'js/ui/export-view.js',
    'js/ui/dropzone.js',
  ];
  const keys = new Set();
  for (const file of files) {
    const text = read(file);
    for (const match of text.matchAll(/'([a-zA-Z][a-zA-Z0-9]*(?:\.[a-zA-Z0-9-]+)+)'/g)) {
      const key = match[1];
      if (key.endsWith('.')) continue;
      const namespace = key.split('.')[0];
      if (namespaces.has(namespace)) keys.add(key);
    }
  }
  assert.ok(keys.size > 80, 'expected the dynamic UI to use the catalog');
  assertCovered(keys);
});

test('dynamic locale, theme, reference, and credit keys are complete', () => {
  for (const mode of ['auto', 'en', 'ru']) {
    assert.ok(hasKey(`locale.short.${mode}`));
    assert.ok(hasKey(`locale.label.${mode}`));
  }
  for (const locale of ['en', 'ru']) {
    assert.ok(hasKey(`locale.language.${locale}`));
  }
  for (const mode of ['auto', 'light', 'dark']) {
    assert.ok(hasKey(`theme.label.${mode}`));
    assert.ok(hasKey(`theme.mode.${mode}`));
  }
  for (const theme of ['light', 'dark']) {
    assert.ok(hasKey(`theme.name.${theme}`));
  }
  for (const group of REFERENCE_GROUPS) {
    assert.ok(hasKey(`references.group.${group.id}`));
  }
  for (const credit of CREDITS) {
    assert.ok(hasKey(`credits.${credit.id}.label`));
    assert.ok(hasKey(`credits.${credit.id}.text`));
    if (credit.link) assert.ok(hasKey(`credits.${credit.id}.link`));
  }
});
