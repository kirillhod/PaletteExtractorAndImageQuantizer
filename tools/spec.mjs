// @ts-check
/**
 * Print one section of a large project document without loading the whole file.
 * The plan, DESIGN, and research report are authoritative but expensive to read in
 * full; this tool keeps a lookup to the section that the task actually needs.
 *
 * Usage:
 *   node tools/spec.mjs plan 6.5
 *   node tools/spec.mjs design 5
 *   node tools/spec.mjs research 4.5
 *   node tools/spec.mjs plan --list
 */
import fs from 'node:fs';
import process from 'node:process';

const DOCS = {
  plan: 'IMPLEMENTATION_PLAN.md',
  design: 'DESIGN.md',
  research: 'RESEARCH_REPORT.md',
};

const [docName, query] = process.argv.slice(2);
const file = DOCS[docName];
if (!file) {
  console.error('Usage: node tools/spec.mjs <plan|design|research> <section|--list>');
  process.exit(1);
}

const lines = fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8').split(/\r?\n/);
/** @type {{ level:number, title:string, line:number }[]} */
const headings = [];
lines.forEach((line, index) => {
  const match = /^(#{2,3}) (.+)$/.exec(line);
  if (match) headings.push({ level: match[1].length, title: match[2].trim(), line: index });
});

if (!query || query === '--list') {
  for (const heading of headings) {
    console.log(`${String(heading.line + 1).padStart(4)}  ${'#'.repeat(heading.level)} ${heading.title}`);
  }
  process.exit(0);
}

let matches;
if (/^\d+(?:\.\d+)*$/.test(query)) {
  const escaped = query.replaceAll('.', '\\.');
  const pattern = new RegExp(`^${escaped}(?:\\.\\s|\\s)`);
  matches = headings.filter((heading) => pattern.test(heading.title));
} else {
  const needle = query.toLowerCase();
  matches = headings.filter((heading) => heading.title.toLowerCase().includes(needle));
}

if (matches.length === 0) {
  console.error(`No section matches "${query}" in ${file}. Try --list.`);
  process.exit(1);
}
if (matches.length > 1) {
  console.error(`"${query}" matches ${matches.length} sections in ${file}:`);
  for (const heading of matches) {
    console.error(`  ${heading.line + 1}: ${heading.title}`);
  }
  process.exit(2);
}

const [section] = matches;
const end = headings.find(
  (heading) => heading.line > section.line && heading.level <= section.level,
);
const body = lines.slice(section.line, end ? end.line : lines.length);
while (body.length > 0 && body[body.length - 1].trim() === '') body.pop();
console.log(body.join('\n'));
