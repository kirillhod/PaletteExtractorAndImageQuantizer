// @ts-check
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ALL_REFERENCES,
  CREDITS,
  REFERENCE_GROUPS,
} from '../js/content/references.js';

test('reference groups cover every implemented algorithm', () => {
  const ids = new Set(ALL_REFERENCES.map((reference) => reference.id));
  const required = [
    'heckbert-1982',
    'wu-1991',
    'gervautz-1988',
    'lbg-1980',
    'kmeanspp-2007',
    'floyd-steinberg-1976',
    'bayer-1973',
    'ulichney-1993',
    'sharma-2005',
    'oklab-2020',
    'png-3',
  ];
  for (const id of required) assert.ok(ids.has(id), `missing reference ${id}`);
});

test('references are well formed and use HTTPS or a print citation', () => {
  const ids = new Set();
  const urls = new Set();
  for (const group of REFERENCE_GROUPS) {
    assert.ok(group.id && group.title, 'group needs an id and title');
    for (const reference of group.items) {
      assert.ok(!ids.has(reference.id), `duplicate reference ${reference.id}`);
      ids.add(reference.id);
      assert.ok(reference.title.trim().length > 0, reference.id);
      assert.ok(reference.authors.trim().length > 0, reference.id);
      assert.ok(reference.venue.trim().length > 0, reference.id);
      assert.ok(Number.isInteger(reference.year) && reference.year >= 1900, reference.id);
      if (reference.url === null) continue;
      assert.match(reference.url, /^https:\/\//, reference.id);
      assert.ok(!urls.has(reference.url), `duplicate URL ${reference.url}`);
      urls.add(reference.url);
    }
  }
});

test('credits explain code, font, algorithm, and palette provenance', () => {
  const ids = new Set(CREDITS.map((credit) => credit.id));
  for (const id of ['code', 'font', 'algorithms', 'palettes', 'design']) {
    assert.ok(ids.has(id), `missing credit ${id}`);
  }
  for (const credit of CREDITS) {
    assert.ok(credit.label.trim().length > 0, credit.id);
    assert.ok(credit.text.trim().length > 0, credit.id);
    if (credit.link) assert.match(credit.link.href, /^(https:\/\/|\.\/)/, credit.id);
  }
});
