// @ts-check
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  exportedPngBlob,
  supportsImageClipboard,
} from '../js/ui/export-view.js';

test('image clipboard support requires write and ClipboardItem', () => {
  const write = () => Promise.resolve();
  assert.equal(supportsImageClipboard(null, function ClipboardItem() {}), false);
  assert.equal(supportsImageClipboard({ write }, undefined), false);
  assert.equal(supportsImageClipboard({}, function ClipboardItem() {}), false);
  assert.equal(supportsImageClipboard({ write }, function ClipboardItem() {}), true);
});

test('the validated PNG export becomes an image/png clipboard blob', async () => {
  const bytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  const blob = exportedPngBlob([
    { mime: 'image/png', data: bytes.buffer, validation: { ok: true, detail: '' } },
  ]);
  assert.ok(blob);
  assert.equal(blob.type, 'image/png');
  assert.deepEqual(new Uint8Array(await blob.arrayBuffer()), bytes);
  assert.equal(exportedPngBlob([{ mime: 'text/plain', data: bytes.buffer }]), null);
  assert.equal(exportedPngBlob([]), null);
});
