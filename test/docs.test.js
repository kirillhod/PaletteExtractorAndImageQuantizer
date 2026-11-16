// @ts-check
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// The plan is split across the index, docs/spec, and docs/history. A broken link or a
// renumbered section silently strands an agent or a reader, so the layout is checked
// here instead of relying on review.

const ROOT = fileURLToPath(new URL('..', import.meta.url));

const PLAN_FILES = [
  'IMPLEMENTATION_PLAN.md',
  'docs/spec/product.md',
  'docs/spec/architecture.md',
  'docs/spec/algorithms.md',
  'docs/spec/ui.md',
  'docs/spec/contracts.md',
  'docs/spec/appendix.md',
  'docs/history/decisions.md',
  'docs/history/milestones.md',
  'docs/history/releases.md',
];

const LINKED_DOCS = [
  'README.md',
  'AGENTS.md',
  'DESIGN.md',
  'IMPLEMENTATION_PLAN.md',
  'RESEARCH_REPORT.md',
  ...PLAN_FILES.filter((file) => file !== 'IMPLEMENTATION_PLAN.md'),
  'docs/agent/context-map.md',
  'docs/agent/browser-check.md',
  'docs/agent/release.md',
];

test('every plan part exists and opens with a heading', () => {
  for (const file of PLAN_FILES) {
    const full = path.join(ROOT, file);
    assert.ok(fs.existsSync(full), `${file} is missing`);
    const text = fs.readFileSync(full, 'utf8');
    assert.match(text, /^# /, `${file} needs a top-level heading`);
    assert.match(text, /^## /m, `${file} needs at least one section`);
  }
});

test('relative document links resolve', () => {
  const failures = [];
  for (const file of LINKED_DOCS) {
    const text = fs.readFileSync(path.join(ROOT, file), 'utf8');
    for (const match of text.matchAll(/\]\(([^)\s]+)\)/g)) {
      const target = match[1];
      if (/^(?:https?:|mailto:|#)/.test(target)) continue;
      const withoutAnchor = target.split('#')[0];
      if (!withoutAnchor) continue;
      const resolved = path.resolve(path.dirname(path.join(ROOT, file)), withoutAnchor);
      if (!fs.existsSync(resolved)) failures.push(`${file} -> ${target}`);
    }
  }
  assert.deepEqual(failures, [], `broken relative links:\n${failures.join('\n')}`);
});

test('plan section numbers are unique across the split files', () => {
  /** @type {Map<string, string>} */
  const owners = new Map();
  const duplicates = [];
  for (const file of PLAN_FILES) {
    const text = fs.readFileSync(path.join(ROOT, file), 'utf8');
    for (const match of text.matchAll(/^## ((?:\d+(?:\.\d+)*)|Appendix [A-Z])\b/gm)) {
      const number = match[1];
      if (owners.has(number)) duplicates.push(`§${number} in ${owners.get(number)} and ${file}`);
      else owners.set(number, file);
    }
  }
  assert.deepEqual(duplicates, [], `duplicate sections:\n${duplicates.join('\n')}`);
  assert.ok(owners.has('0'), 'the plan index owns section 0');
  assert.ok(owners.has('16'), 'the plan index owns the Definition of Done');
});
