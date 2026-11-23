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
  assert.match(title[1], /palette/i);
  assert.match(title[1], /PEIQ/);
  assert.ok(title[1].length <= 60, `title too long: ${title[1].length}`);
  assert.equal(metaContent('og:title'), title[1]);
  assert.equal(metaContent('twitter:title'), title[1]);
  const description = metaContent('description');
  assert.match(description, /palette/i);
  assert.match(description, /indexed PNG/i);
  // The owner chose the full handoff sentence; search engines may truncate its tail.
  assert.ok(description.length >= 120 && description.length <= 210);
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

test('favicons are declared in a format search engines can fetch', () => {
  const icons = linkTags.filter((tag) => /rel="(?:icon|apple-touch-icon)"/.test(tag));
  assert.ok(
    icons.some((tag) => tag.includes('favicon.svg') && tag.includes('image/svg+xml')),
    'missing SVG icon for browsers',
  );
  const pngTag = icons.find((tag) => tag.includes('favicon.png'));
  assert.ok(pngTag, 'missing PNG icon: Google Search does not accept SVG favicons');
  assert.match(pngTag, /type="image\/png"/);
  assert.ok(
    icons.some((tag) => tag.includes('rel="apple-touch-icon"')),
    'missing apple-touch-icon',
  );

  const png = fs.readFileSync(new URL('assets/favicon.png', root));
  assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', 'not a PNG');
  const width = png.readUInt32BE(16);
  const height = png.readUInt32BE(20);
  assert.equal(width, height, 'favicon must be square');
  assert.ok(width >= 48, `favicon too small: ${width}px`);
  assert.equal(png[24], 8, 'favicon must be 8-bit');
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

test('the app version is injected, never hardcoded in the shell', () => {
  assert.ok(html.includes('id="app-version"'), 'missing footer version element');
  assert.ok(html.includes('id="help-version"'), 'missing Help version element');
  assert.doesNotMatch(
    html,
    /\bv\d+\.\d+/,
    'index.html must take the version from APP_VERSION',
  );
});
