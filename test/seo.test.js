// @ts-check
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const root = new URL('../', import.meta.url);
const canonical = 'https://kirillhod.github.io/PaletteExtractorAndImageQuantizer/';

/** @param {string} path */
function read(path) {
  return fs.readFileSync(new URL(path, root), 'utf8');
}

const html = read('index.html');
const metaTags = [...html.matchAll(/<meta\b[^>]*>/g)].map((match) => match[0]);
const linkTags = [...html.matchAll(/<link\b[^>]*>/g)].map((match) => match[0]);

/**
 * @param {string} key
 * @returns {string}
 */
function metaContent(key) {
  const tag = metaTags.find(
    (value) => value.includes(`name="${key}"`) || value.includes(`property="${key}"`),
  );
  assert.ok(tag, `missing meta ${key}`);
  const content = tag.match(/(?:^|\s)content="([^"]*)"/);
  assert.ok(content, `missing content for meta ${key}`);
  return content[1];
}

test('canonical, Open Graph, and Twitter Card metadata are complete', () => {
  const canonicalTag = linkTags.find((tag) => tag.includes('rel="canonical"'));
  assert.ok(canonicalTag, 'missing canonical link');
  assert.match(canonicalTag, new RegExp(`href="${canonical}"`));

  assert.equal(metaContent('og:type'), 'website');
  assert.equal(metaContent('og:url'), canonical);
  assert.match(metaContent('og:title'), /palette/i);
  assert.match(metaContent('og:description'), /indexed PNG/i);
  assert.equal(metaContent('og:image:width'), '1200');
  assert.equal(metaContent('og:image:height'), '630');
  assert.equal(
    metaContent('og:image'),
    `${canonical}assets/og-image.png`,
  );
  assert.equal(metaContent('twitter:card'), 'summary_large_image');
  assert.equal(metaContent('twitter:image'), metaContent('og:image'));
  assert.match(metaContent('robots'), /max-image-preview:large/);
});

test('title and description use searchable, natural-length copy', () => {
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/);
  assert.ok(title);
  assert.match(title[1], /PaletteExtractorAndImageQuantizer/);
  assert.match(title[1], /palette/i);
  assert.ok(title[1].length <= 70, `title too long: ${title[1].length}`);
  const description = metaContent('description');
  assert.match(description, /palette/i);
  assert.match(description, /indexed PNG/i);
  assert.ok(description.length >= 120 && description.length <= 170);
});

test('JSON-LD describes the free browser application', () => {
  const script = html.match(
    /<script type="application\/ld\+json">([\s\S]*?)<\/script>/,
  );
  assert.ok(script, 'missing JSON-LD');
  const data = JSON.parse(script[1]);
  assert.equal(data['@context'], 'https://schema.org');
  assert.equal(data['@type'], 'WebApplication');
  assert.equal(data.name, 'PaletteExtractorAndImageQuantizer');
  assert.equal(data.alternateName, 'PEIQ');
  assert.equal(data.url, canonical);
  assert.equal(data.applicationCategory, 'MultimediaApplication');
  assert.equal(data.operatingSystem, 'Any');
  assert.equal(data.isAccessibleForFree, true);
  assert.equal(data.offers['@type'], 'Offer');
  assert.equal(data.offers.price, '0');
  assert.equal(data.offers.priceCurrency, 'USD');
  assert.ok(Array.isArray(data.featureList) && data.featureList.length >= 5);
  assert.equal(data.sameAs, 'https://github.com/kirillhod/PaletteExtractorAndImageQuantizer');
  assert.match(data.license, /gpl-3\.0/);
});

test('social image and sitemap match the canonical URL', () => {
  const png = fs.readFileSync(new URL('assets/og-image.png', root));
  assert.equal(png.readUInt32BE(16), 1200);
  assert.equal(png.readUInt32BE(20), 630);
  const sitemap = read('sitemap.xml');
  assert.match(sitemap, new RegExp(`<loc>${canonical}</loc>`));
  assert.match(sitemap, /<lastmod>\d{4}-\d{2}-\d{2}<\/lastmod>/);
  const robots = read('robots.txt');
  assert.match(robots, new RegExp(`Sitemap: ${canonical}sitemap\\.xml`));
});
