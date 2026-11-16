// @ts-check
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const root = new URL('../', import.meta.url);
const html = fs.readFileSync(new URL('index.html', root), 'utf8');

/** @param {string} start @param {string} end */
function sliceBetween(start, end) {
  const from = html.indexOf(start);
  const to = html.indexOf(end);
  assert.ok(from >= 0 && to > from, `missing section: ${start}`);
  return html.slice(from, to);
}

test('Help explains extraction methods as well as mapping', () => {
  for (const key of [
    'help.extractTitle',
    'help.extractPopularityText',
    'help.extractMedianText',
    'help.extractWuText',
    'help.extractOctreeText',
    'help.extractKmeansText',
  ]) {
    assert.match(html, new RegExp(`data-i18n="${key}"`), key);
  }
  const help = sliceBetween('id="help-drawer"', 'id="palette-preview"');
  assert.match(help, /data-i18n="help.mapTitle"/);
  assert.match(help, /data-i18n="help.extractTitle"/);
});

test('saved-session clearing sits in the footer behind a confirmation dialog', () => {
  const footer = sliceBetween('<footer', '</footer>');
  assert.match(footer, /id="session-clear"/);
  assert.match(footer, /aria-controls="session-clear-dialog"/);

  const help = sliceBetween('id="help-drawer"', 'id="palette-preview"');
  assert.doesNotMatch(help, /id="session-clear"/);

  assert.match(html, /<dialog[^>]*id="session-clear-dialog"/);
  assert.match(html, /id="session-clear-cancel"[^>]*autofocus/);
  assert.match(html, /id="session-clear-confirm"[^>]*value="confirm"/);
});
