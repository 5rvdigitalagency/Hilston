const fs = require('node:fs');
const path = require('node:path');
const { authConfigured, requireSession } = require('./_seo-auth');

function checkSeo(seo) {
  const warnings = [];
  const errors = [];
  const titles = new Map();
  const canonicals = new Map();

  for (const [route, page] of Object.entries(seo.pages || {})) {
    if (!page.file || !fs.existsSync(path.join(process.cwd(), page.file))) errors.push(`${route}: file does not exist`);
    if (!page.title) warnings.push(`${route}: title is empty`);
    if (page.title && page.title.length > 60) warnings.push(`${route}: title is ${page.title.length} characters`);
    if (!page.description) warnings.push(`${route}: description is empty`);
    if (page.description && (page.description.length < 50 || page.description.length > 160)) warnings.push(`${route}: description is ${page.description.length} characters`);
    if (page.title) {
      if (titles.has(page.title)) warnings.push(`${route}: duplicate title also used by ${titles.get(page.title)}`);
      else titles.set(page.title, route);
    }
    const canonical = page.canonical || route;
    if (canonical) {
      if (canonicals.has(canonical)) errors.push(`${route}: duplicate canonical also used by ${canonicals.get(canonical)}`);
      else canonicals.set(canonical, route);
    }
  }

  return { warnings, errors };
}

module.exports = function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    res.statusCode = 405;
    return res.end('Method Not Allowed');
  }

  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  if (!authConfigured()) {
    res.statusCode = 503;
    return res.end(JSON.stringify({ error: 'SEO admin auth is not configured' }));
  }

  const session = requireSession(req, res);
  if (!session) return;

  try {
    const seo = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'seo', 'seo.json'), 'utf8'));
    res.end(JSON.stringify({ ok: true, user: session.username, seo, check: checkSeo(seo) }));
  } catch (error) {
    res.statusCode = 500;
    res.end(JSON.stringify({ error: error.message }));
  }
};
