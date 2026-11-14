// @ts-check
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_LOCALE,
  detectLocale,
  formatMessage,
  formatNumber,
  formatPlural,
  interpolate,
  nextLocaleMode,
  normalizeLocale,
  normalizeLocaleMode,
  resolveLocale,
} from '../js/core/i18n.js';
import { MESSAGES } from '../js/content/messages.js';

test('locale detection follows the browser language order', () => {
  assert.equal(detectLocale(['ru-RU', 'en-US']), 'ru');
  assert.equal(detectLocale(['fr-FR', 'en-GB', 'ru-RU']), 'en');
  assert.equal(detectLocale(['fr-FR']), DEFAULT_LOCALE);
  assert.equal(detectLocale([]), DEFAULT_LOCALE);
  assert.equal(normalizeLocale('RU-ru'), 'ru');
  assert.equal(normalizeLocale('en_US'), 'en');
  assert.equal(normalizeLocale('de-DE'), null);
});

test('manual locale modes override auto detection', () => {
  assert.equal(resolveLocale('en', ['ru-RU']), 'en');
  assert.equal(resolveLocale('ru', ['en-US']), 'ru');
  assert.equal(resolveLocale('auto', ['ru-RU']), 'ru');
  assert.equal(resolveLocale('auto', ['en-US']), 'en');
  assert.equal(normalizeLocaleMode('de'), 'auto');
  assert.equal(nextLocaleMode('auto'), 'en');
  assert.equal(nextLocaleMode('en'), 'ru');
  assert.equal(nextLocaleMode('ru'), 'auto');
});

test('interpolation fills named parameters and leaves missing values empty', () => {
  assert.equal(interpolate('{count} colors', { count: 16 }), '16 colors');
  assert.equal(interpolate('{a} / {b}', { a: 'x' }), 'x / ');
  assert.equal(interpolate('literal'), 'literal');
});

test('message lookup falls back to English and then to the key', () => {
  assert.equal(formatMessage(MESSAGES, 'ru', 'palette.label'), 'Палитра');
  assert.equal(formatMessage(MESSAGES, 'ru', 'missing.key'), 'missing.key');
  assert.equal(
    formatMessage(MESSAGES, 'en', 'count.colors.one', { count: 1 }),
    '1 color',
  );
});

test('plural forms follow English and Russian rules', () => {
  assert.equal(formatPlural(MESSAGES, 'en', 'count.colors', 1), '1 color');
  assert.equal(formatPlural(MESSAGES, 'en', 'count.colors', 2), '2 colors');
  assert.equal(formatPlural(MESSAGES, 'ru', 'count.colors', 1), '1 цвет');
  assert.equal(formatPlural(MESSAGES, 'ru', 'count.colors', 2), '2 цвета');
  assert.equal(formatPlural(MESSAGES, 'ru', 'count.colors', 5), '5 цветов');
  assert.equal(formatPlural(MESSAGES, 'ru', 'count.colors', 21), '21 цвет');
  assert.equal(formatPlural(MESSAGES, 'ru', 'count.pixels', 0), '0 пикселей');
  assert.equal(formatPlural(MESSAGES, 'en', 'count.hexValues', 3), '3 HEX values');
});

test('decimal formatting follows the locale separator', () => {
  assert.equal(formatNumber('en', 2.3), '2.3');
  assert.equal(formatNumber('ru', 2.3), '2,3');
});
