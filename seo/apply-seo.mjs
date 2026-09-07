import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT = process.cwd();
const SEO_PATH = path.join(ROOT, 'seo', 'seo.json');
const MARKER_START = '<!-- seo:start -->';
const MARKER_END = '<!-- seo:end -->';
const args = new Set(process.argv.slice(2));
const dryRun = args.has('--dry-run');
const siteFileDiffs = args.has('--site-file-diffs');

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function cleanSiteUrl(url) {
  return String(url || '').replace(/\/+$/, '');
}

function routeFromFile(file) {
  const normalized = file.split(path.sep).join('/');
  if (normalized === 'index.html') return '/';
  return '/' + normalized.replace(/\/index\.html$/, '').replace(/\.html$/, '');
}

function absoluteUrl(value, siteUrl) {
  const raw = String(value || '').trim();
  if (raw.length === 0) return '';
  if (/^[a-z][a-z0-9+.-]*:/i.test(raw)) return raw;
  const base = cleanSiteUrl(siteUrl);
  if (raw.startsWith('/')) return base + raw;
  return base + '/' + raw;
}

function escapeAttr(value) {
  return String(value)
    .replace(/&(?!(?:[a-zA-Z][a-zA-Z0-9]+|#[0-9]+|#x[a-fA-F0-9]+);)/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeText(value) {
  return String(value)
    .replace(/&(?!(?:[a-zA-Z][a-zA-Z0-9]+|#[0-9]+|#x[a-fA-F0-9]+);)/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function normalizeWhitespace(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function getAttr(tag, name) {
  const match = tag.match(new RegExp(name + '\\s*=\\s*(["\'])([\\s\\S]*?)\\1', 'i'));
  return match ? match[2] : '';
}

function findTags(html, tagName) {
  const pattern = new RegExp('<' + tagName + '\\b[^>]*>', 'gi');
  return [...html.matchAll(pattern)].map(match => match[0]);
}

function findTitle(html) {
  const match = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
  return match ? normalizeWhitespace(match[1]) : '';
}

function findDescription(html) {
  for (const tag of findTags(html, 'meta')) {
    if (getAttr(tag, 'name').toLowerCase() === 'description') return getAttr(tag, 'content');
  }
  return '';
}

function findCanonical(html) {
  for (const tag of findTags(html, 'link')) {
    if (getAttr(tag, 'rel').toLowerCase() === 'canonical') return getAttr(tag, 'href');
  }
  return '';
}

function findSocialTags(html) {
  return findTags(html, 'meta').filter(tag => {
    const property = getAttr(tag, 'property').toLowerCase();
    const name = getAttr(tag, 'name').toLowerCase();
    return property.startsWith('og:') || name.startsWith('twitter:');
  });
}

function findJsonLd(html) {
  return [...html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)]
    .map(match => match[1].trim())
    .filter(Boolean);
}

function removeMarkerBlock(html) {
  return html.replace(new RegExp('\\n?[ \\t]*' + escapeRegExp(MARKER_START) + '[\\s\\S]*?' + escapeRegExp(MARKER_END) + '[ \\t]*\\n?', 'g'), '\n');
}

function removeControlledHeadTags(html) {
  return html
    .replace(/\n?[ \t]*<title\b[^>]*>[\s\S]*?<\/title>[ \t]*\n?/gi, '\n')
    .replace(/\n?[ \t]*<meta\b(?=[^>]*\bname=["']description["'])[^>]*>[ \t]*\n?/gi, '\n')
    .replace(/\n?[ \t]*<link\b(?=[^>]*\brel=["']canonical["'])[^>]*>[ \t]*\n?/gi, '\n')
    .replace(/\n?[ \t]*<meta\b(?=[^>]*\bproperty=["']og:)[^>]*>[ \t]*\n?/gi, '\n')
    .replace(/\n?[ \t]*<meta\b(?=[^>]*\bname=["']twitter:)[^>]*>[ \t]*\n?/gi, '\n')
    .replace(/\n?[ \t]*<script\b[^>]*type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>[ \t]*\n?/gi, '\n');
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function makeMeta(name, content, attr = 'name') {
  if (String(content || '').trim().length === 0) return '';
  return `  <meta ${attr}="${escapeAttr(name)}" content="${escapeAttr(content)}">`;
}

function makeTitle(value) {
  if (String(value || '').trim().length === 0) return '';
  return `  <title>${escapeText(value)}</title>`;
}

function makeCanonical(value) {
  if (String(value || '').trim().length === 0) return '';
  return `  <link rel="canonical" href="${escapeAttr(value)}">`;
}

function makeJsonLd(schema) {
  if (schema === null || schema === undefined) return '';
  return `  <script type="application/ld+json">${JSON.stringify(schema).replace(/</g, '\\u003c')}</script>`;
}

function makeManagedTags(route, page, defaults) {
  const siteUrl = defaults.siteUrl;
  const canonical = absoluteUrl(page.canonical || route, siteUrl);
  const title = page.ogTitle || page.title;
  const description = page.ogDescription || page.description;
  const ogImage = absoluteUrl(page.ogImage || defaults.ogImage, siteUrl);
  const tags = [
    makeTitle(page.title),
    makeMeta('description', page.description),
    makeCanonical(canonical)
  ];

  if (page.robots && (page.robots.index === false || page.robots.follow === false)) {
    tags.push(makeMeta('robots', `${page.robots.index === false ? 'noindex' : 'index'}, ${page.robots.follow === false ? 'nofollow' : 'follow'}`));
  }

  tags.push(makeMeta('og:type', 'website', 'property'));
  tags.push(makeMeta('og:title', title, 'property'));
  tags.push(makeMeta('og:description', description, 'property'));
  tags.push(makeMeta('og:image', ogImage, 'property'));
  tags.push(makeMeta('og:url', canonical, 'property'));
  tags.push(makeMeta('og:locale', defaults.locale, 'property'));
  tags.push(makeMeta('og:site_name', defaults.siteName, 'property'));
  tags.push(makeMeta('twitter:card', defaults.twitterCard));
  tags.push(makeMeta('twitter:title', title));
  tags.push(makeMeta('twitter:description', description));
  tags.push(makeMeta('twitter:image', ogImage));
  tags.push(makeJsonLd(page.schema));

  return tags.filter(Boolean);
}

function buildBlock(route, page, defaults, html) {
  const tags = makeManagedTags(route, page, defaults);
  if (tags.length === 0) return '';
  return `${MARKER_START}\n${tags.join('\n')}\n${MARKER_END}`;
}

function assertPreserved(file, route, page, before, after) {
  const beforeTitle = findTitle(before);
  const afterTitle = findTitle(after);
  const beforeDescription = findDescription(before);
  const afterDescription = findDescription(after);
  const jsonLdBlocks = findJsonLd(after);
  const expectedCanonical = absoluteUrl(page.canonical || route, seo.defaults.siteUrl);
  const afterCanonical = findCanonical(after);

  if (page.title && afterTitle !== normalizeWhitespace(page.title)) throw new Error(`${file}: title would not match seo.json`);
  if (page.description && afterDescription !== page.description) throw new Error(`${file}: description would not match seo.json`);
  if (page.schema === null && jsonLdBlocks.length !== 0) throw new Error(`${file}: JSON-LD would remain when schema is null`);
  if (page.schema !== null && (jsonLdBlocks.length !== 1 || JSON.stringify(JSON.parse(jsonLdBlocks[0])) !== JSON.stringify(page.schema))) throw new Error(`${file}: JSON-LD would not match seo.json`);
  if (afterCanonical !== expectedCanonical) throw new Error(`${file}: canonical would be ${afterCanonical || '(missing)'} instead of ${expectedCanonical}`);
}

function applyPage(route, page, defaults) {
  const filePath = path.join(ROOT, page.file);
  const before = fs.readFileSync(filePath, 'utf8');
  const withoutBlock = removeControlledHeadTags(removeMarkerBlock(before));
  const block = buildBlock(route, page, defaults, withoutBlock);
  const headMatch = withoutBlock.match(/<head\b[^>]*>/i);
  if (!headMatch) throw new Error(`${page.file}: missing <head>`);
  const after = withoutBlock.slice(0, headMatch.index + headMatch[0].length) + '\n  ' + block.replace(/\n/g, '\n  ') + withoutBlock.slice(headMatch.index + headMatch[0].length);
  assertPreserved(page.file, route, page, before, after);
  const socialCount = findSocialTags(after).length - findSocialTags(before).length;
  const canonicalAdded = findCanonical(before).trim().length === 0 && findCanonical(after).trim().length > 0;
  return { file: page.file, before, after, changed: before !== after, socialCount, canonicalAdded };
}

function xmlEscape(value) {
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function lastModified(file) {
  try {
    return execFileSync('git', ['log', '-1', '--format=%cI', '--', file], {
      cwd: ROOT,
      encoding: 'utf8',
      env: { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1' },
      stdio: ['ignore', 'pipe', 'ignore']
    }).trim() || fs.statSync(path.join(ROOT, file)).mtime.toISOString();
  } catch {
    return fs.statSync(path.join(ROOT, file)).mtime.toISOString();
  }
}

function generateSitemap(seoData) {
  const urls = Object.entries(seoData.pages)
    .filter(([, page]) => !page.robots || page.robots.index !== false)
    .map(([route, page]) => {
      const loc = absoluteUrl(page.canonical || route, seoData.defaults.siteUrl);
      return `  <url>\n    <loc>${xmlEscape(loc)}</loc>\n    <lastmod>${xmlEscape(lastModified(page.file))}</lastmod>\n  </url>`;
    });
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`;
}

function generateRobots(seoData) {
  return `User-agent: *\nAllow: /\n\nSitemap: ${cleanSiteUrl(seoData.defaults.siteUrl)}/sitemap.xml\n`;
}

function generateVercel(seoData) {
  const current = fs.existsSync('vercel.json') ? JSON.parse(fs.readFileSync('vercel.json', 'utf8')) : {};
  const generatedRedirects = (seoData.redirects || []).map(redirect => ({
    source: redirect.from,
    destination: redirect.to.replace(/\.html$/, ''),
    permanent: redirect.status === 301 || redirect.status === 308
  }));
  return JSON.stringify({
    ...current,
    cleanUrls: current.cleanUrls ?? true,
    trailingSlash: current.trailingSlash ?? false,
    redirects: [...(current.redirects || []), ...generatedRedirects]
  }, null, 2) + '\n';
}

function simpleDiffLabel(file, current, next) {
  if (current === next) return `${file}: no change`;
  return `${file}: would change (${current.length} bytes -> ${next.length} bytes)`;
}

const seo = readJson(SEO_PATH);
const results = Object.entries(seo.pages).map(([route, page]) => applyPage(route, page, seo.defaults));
const changed = results.filter(result => result.changed);
const nextSitemap = generateSitemap(seo);
const currentSitemap = fs.existsSync('sitemap.xml') ? fs.readFileSync('sitemap.xml', 'utf8') : '';
const sitemapChanged = currentSitemap !== nextSitemap;

console.log(dryRun ? 'SEO dry-run: no files written' : 'SEO apply: writing HTML files');
for (const result of results) {
  const parts = [];
  if (result.changed) parts.push('would change');
  else parts.push('no change');
  if (result.socialCount > 0) parts.push(`+${result.socialCount} social tags`);
  if (result.canonicalAdded) parts.push('+canonical');
  console.log(`${result.file}: ${parts.join(', ')}`);
}
console.log(`sitemap.xml: ${sitemapChanged ? 'would change' : 'no change'}`);

if (siteFileDiffs) {
  console.log('\nGenerated site-file diffs only; not written:');
  const robotsCurrent = fs.existsSync('robots.txt') ? fs.readFileSync('robots.txt', 'utf8') : '';
  const vercelCurrent = fs.existsSync('vercel.json') ? fs.readFileSync('vercel.json', 'utf8') : '';
  console.log(simpleDiffLabel('sitemap.xml', currentSitemap, nextSitemap));
  console.log(simpleDiffLabel('robots.txt', robotsCurrent, generateRobots(seo)));
  console.log(simpleDiffLabel('vercel.json', vercelCurrent, generateVercel(seo)));
}

if (!dryRun) {
  for (const result of changed) fs.writeFileSync(path.join(ROOT, result.file), result.after);
  if (sitemapChanged) fs.writeFileSync('sitemap.xml', nextSitemap);
}

console.log(`Changed files: ${changed.length + (sitemapChanged ? 1 : 0)}`);
