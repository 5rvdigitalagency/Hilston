import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SEO_PATH = path.join(ROOT, 'seo', 'seo.json');
const strict = process.argv.includes('--strict');
const ignoredPrefixes = ['Archive/', 'Chnages/', 'New Updates/', 'Event Booking System /ticketing/', 'seo/'];
const skipDirs = new Set(['.git', '.vercel', '.venv', '.pdf-previews', 'node_modules']);
const warnings = [];
const errors = [];

function addWarning(message) {
  warnings.push(message);
}

function addError(message) {
  errors.push(message);
}

function readSeo() {
  try {
    return JSON.parse(fs.readFileSync(SEO_PATH, 'utf8'));
  } catch (error) {
    addError(`seo/seo.json is not valid JSON: ${error.message}`);
    return null;
  }
}

function routeFromFile(file) {
  if (file === 'index.html') return '/';
  return '/' + file.replace(/\/index\.html$/, '').replace(/\.html$/, '');
}

function walkHtml(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (skipDirs.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    const relative = path.relative(ROOT, full).split(path.sep).join('/');
    if (ignoredPrefixes.some(prefix => (relative + (entry.isDirectory() ? '/' : '')).startsWith(prefix))) continue;
    if (entry.isDirectory()) walkHtml(full, out);
    else if (entry.isFile() && entry.name.endsWith('.html')) out.push(relative);
  }
  return out;
}

function localPathExists(urlPath) {
  if (!urlPath || !urlPath.startsWith('/')) return true;
  const clean = urlPath.split('#')[0].split('?')[0];
  if (clean === '/') return fs.existsSync(path.join(ROOT, 'index.html'));
  return fs.existsSync(path.join(ROOT, clean.slice(1) + '.html')) || fs.existsSync(path.join(ROOT, clean.slice(1), 'index.html'));
}

function imagePathExists(value, siteUrl) {
  if (!value) return true;
  let imagePath = value;
  if (siteUrl && imagePath.startsWith(siteUrl)) imagePath = imagePath.slice(siteUrl.length);
  if (/^https?:\/\//i.test(imagePath)) return true;
  if (!imagePath.startsWith('/')) imagePath = '/' + imagePath;
  return fs.existsSync(path.join(ROOT, imagePath.slice(1).split('?')[0].split('#')[0]));
}

function checkSchema(route, schema) {
  if (schema === null) return;
  const items = Array.isArray(schema) ? schema : [schema];
  for (const item of items) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      addError(`${route}: schema must be an object, array of objects, or null`);
      continue;
    }
    if (!item['@context']) addError(`${route}: schema missing @context`);
    if (!item['@type']) addError(`${route}: schema missing @type`);
  }
}

const seo = readSeo();
if (seo) {
  const pages = seo.pages || {};
  const routeEntries = Object.entries(pages);
  const titles = new Map();
  const canonicals = new Map();
  const redirects = seo.redirects || [];
  const htmlRoutes = new Set(walkHtml(ROOT).map(routeFromFile));
  const configuredRoutes = new Set(Object.keys(pages));

  for (const route of htmlRoutes) {
    if (!configuredRoutes.has(route)) addError(`${route}: HTML file exists but has no seo.json entry`);
  }

  for (const [route, page] of routeEntries) {
    if (!page.file || !fs.existsSync(path.join(ROOT, page.file))) addError(`${route}: file does not exist (${page.file || 'missing file'})`);

    const title = page.title || '';
    if (!title) addWarning(`${route}: title is empty`);
    if (title.length > 60) addWarning(`${route}: title is ${title.length} characters`);
    if (title) {
      if (titles.has(title)) addWarning(`${route}: duplicate title also used by ${titles.get(title)}`);
      else titles.set(title, route);
    }

    const description = page.description || '';
    if (!description) addWarning(`${route}: description is empty`);
    if (description && (description.length < 50 || description.length > 160)) addWarning(`${route}: description is ${description.length} characters`);

    const canonical = page.canonical || route;
    if (canonical) {
      if (canonicals.has(canonical)) addError(`${route}: duplicate canonical also used by ${canonicals.get(canonical)}`);
      else canonicals.set(canonical, route);
    }

    checkSchema(route, page.schema);
    if (!imagePathExists(page.ogImage || seo.defaults?.ogImage || '', seo.defaults?.siteUrl || '')) addWarning(`${route}: ogImage does not resolve to a local file`);
  }

  const redirectFrom = new Map();
  for (const redirect of redirects) {
    if (!redirect.from || !redirect.to) {
      addError('redirect missing from or to');
      continue;
    }
    if (redirect.from === redirect.to) addError(`${redirect.from}: self-redirect`);
    if (redirectFrom.has(redirect.to) && redirectFrom.get(redirect.to) === redirect.from) addError(`${redirect.from}: redirect loop with ${redirect.to}`);
    redirectFrom.set(redirect.from, redirect.to);
    if (!localPathExists(redirect.to)) addWarning(`${redirect.from}: redirect target does not resolve (${redirect.to})`);
  }
}

for (const warning of warnings) console.warn(`warning: ${warning}`);
for (const error of errors) console.error(`error: ${error}`);
console.log(`SEO check complete: ${warnings.length} warning(s), ${errors.length} error(s)`);

if (errors.length > 0 || (strict && warnings.length > 0)) process.exit(1);
