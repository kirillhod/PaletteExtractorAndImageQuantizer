// @ts-check
/**
 * Print one section of a large project document without loading the whole file.
 * The plan, DESIGN, and research report are authoritative but expensive to read in
 * full; this tool keeps a lookup to the section that the task actually needs.
 *
 * The plan is split by topic under `docs/spec/` and `docs/history/`. `plan` searches
 * all of them and keeps the original section numbers, so `plan 6.5` still works after
 * the split.
 *
 * Usage:
 *   node tools/spec.mjs plan 6.5
 *   node tools/spec.mjs algorithms 6.6
 *   node tools/spec.mjs design 5
 *   node tools/spec.mjs research 4.5
 *   node tools/spec.mjs plan --list
 */
import fs from 'node:fs';
import process from 'node:process';

const SPEC_FILES = [
  'docs/spec/product.md',
  'docs/spec/architecture.md',
  'docs/spec/algorithms.md',
  'docs/spec/ui.md',
  'docs/spec/contracts.md',
  'docs/spec/appendix.md',
];

const HISTORY_FILES = [
  'docs/history/decisions.md',
  'docs/history/milestones.md',
  'docs/history/releases.md',
];

/** @type {Record<string, string[]>} */
const DOCS = {
  plan: ['IMPLEMENTATION_PLAN.md', ...SPEC_FILES, ...HISTORY_FILES],
  product: ['docs/spec/product.md'],
  architecture: ['docs/spec/architecture.md'],
  algorithms: ['docs/spec/algorithms.md'],
  ui: ['docs/spec/ui.md'],
  contracts: ['docs/spec/contracts.md'],
  appendix: ['docs/spec/appendix.md'],
  decisions: ['docs/history/decisions.md'],
  milestones: ['docs/history/milestones.md'],
  releases: ['docs/history/releases.md'],
  design: ['DESIGN.md'],
  research: ['RESEARCH_REPORT.md'],
};

const NAMES = Object.keys(DOCS).join('|');
const [docName, query] = process.argv.slice(2);
const files = DOCS[docName];
if (!files) {
  console.error(`Usage: node tools/spec.mjs <${NAMES}> <section|--list>`);
  process.exit(1);
}

/**
 * @typedef {Object} Doc
 * @property {string} file
 * @property {string[]} lines
 * @property {{ level:number, title:string, line:number }[]} headings
 */

/** @type {Doc[]} */
const docs = files.map((file) => {
  const lines = fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8').split(/\r?\n/);
  /** @type {{ level:number, title:string, line:number }[]} */
  const headings = [];
  lines.forEach((line, index) => {
    const match = /^(#{2,3}) (.+)$/.exec(line);
    if (match) headings.push({ level: match[1].length, title: match[2].trim(), line: index });
  });
  return { file, lines, headings };
});

if (!query || query === '--list') {
  docs.forEach((doc, index) => {
    if (docs.length > 1) {
      if (index > 0) console.log('');
      console.log(doc.file);
    }
    for (const heading of doc.headings) {
      console.log(
        `${String(heading.line + 1).padStart(4)}  ${'#'.repeat(heading.level)} ${heading.title}`,
      );
    }
  });
  process.exit(0);
}

/** @type {{ doc:Doc, heading:{ level:number, title:string, line:number } }[]} */
const matches = [];
for (const doc of docs) {
  if (/^\d+(?:\.\d+)*$/.test(query)) {
    const escaped = query.replaceAll('.', '\\.');
    const pattern = new RegExp(`^${escaped}(?:\\.\\s|\\s)`);
    for (const heading of doc.headings) {
      if (pattern.test(heading.title)) matches.push({ doc, heading });
    }
  } else {
    const needle = query.toLowerCase();
    for (const heading of doc.headings) {
      if (heading.title.toLowerCase().includes(needle)) matches.push({ doc, heading });
    }
  }
}

if (matches.length === 0) {
  console.error(`No section matches "${query}" in ${files.join(', ')}. Try --list.`);
  process.exit(1);
}
if (matches.length > 1) {
  console.error(`"${query}" matches ${matches.length} sections:`);
  for (const match of matches) {
    console.error(`  ${match.doc.file}:${match.heading.line + 1}: ${match.heading.title}`);
  }
  process.exit(2);
}

const [{ doc, heading }] = matches;
const end = doc.headings.find(
  (candidate) => candidate.line > heading.line && candidate.level <= heading.level,
);
const body = doc.lines.slice(heading.line, end ? end.line : doc.lines.length);
while (body.length > 0 && body[body.length - 1].trim() === '') body.pop();
console.log(body.join('\n'));
