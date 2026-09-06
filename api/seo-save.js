const { readJsonBody, requireSession } = require('./_seo-auth');

const MARKER_START = '<!-- seo:start -->';
const MARKER_END = '<!-- seo:end -->';

function json(res, status, payload) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

function cleanSiteUrl(url) {
  return String(url || '').replace(/\/+$/, '');
}

function absoluteUrl(value, siteUrl) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (/^[a-z][a-z0-9+.-]*:/i.test(raw)) return raw;
  return cleanSiteUrl(siteUrl) + (raw.startsWith('/') ? raw : '/' + raw);
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

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function removeMarkerBlock(html) {
  return html.replace(new RegExp('\n?[ \t]*' + escapeRegExp(MARKER_START) + '[\s\S]*?' + escapeRegExp(MARKER_END) + '[ \t]*\n?', 'g'), '\n');
}

function removeControlledHeadTags(html) {
  return html
    .replace(/\n?[ \t]*<title\b[^>]*>[\s\S]*?<\/title>[ \t]*\n?/gi, '\n')
    .replace(/\n?[ \t]*<meta\b(?=[^>]*\bname=["']description["'])[^>]*>[ \t]*\n?/gi, '\n')
    .replace(/\n?[ \t]*<link\b(?=[^>]*\brel=["']canonical["'])[^>]*>[ \t]*\n?/gi, '\n')
    .replace(/\n?[ \t]*<meta\b(?=[^>]*\bproperty=["']og:)[^>]*>[ \t]*\n?/gi, '\n')
    .replace(/\n?[ \t]*<meta\b(?=[^>]*\bname=["']twitter:)[^>]*>[ \t]*\n?/gi, '\n');
}

function makeMeta(name, content, attr = 'name') {
  if (String(content || '').trim().length === 0) return '';
  return `  <meta ${attr}="${escapeAttr(name)}" content="${escapeAttr(content)}">`;
}

function makeManagedTags(route, page, defaults) {
  const canonical = absoluteUrl(page.canonical || route, defaults.siteUrl);
  const title = page.ogTitle || page.title;
  const description = page.ogDescription || page.description;
  const ogImage = absoluteUrl(page.ogImage || defaults.ogImage, defaults.siteUrl);
  const tags = [];
  if (page.title) tags.push(`  <title>${escapeText(page.title)}</title>`);
  if (page.description) tags.push(makeMeta('description', page.description));
  if (canonical) tags.push(`  <link rel="canonical" href="${escapeAttr(canonical)}">`);
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
  return tags.filter(Boolean);
}

function applyPage(html, route, page, defaults) {
  const withoutBlock = removeControlledHeadTags(removeMarkerBlock(html));
  const block = `${MARKER_START}\n${makeManagedTags(route, page, defaults).join('\n')}\n${MARKER_END}`;
  const headMatch = withoutBlock.match(/<head\b[^>]*>/i);
  if (!headMatch) throw new Error(`${page.file}: missing <head>`);
  return withoutBlock.slice(0, headMatch.index + headMatch[0].length) + '\n  ' + block.replace(/\n/g, '\n  ') + withoutBlock.slice(headMatch.index + headMatch[0].length);
}

function xmlEscape(value) {
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function sitemapLastmods(xml) {
  const map = new Map();
  for (const match of xml.matchAll(/<url>[\s\S]*?<loc>\s*([^<]+)\s*<\/loc>[\s\S]*?<lastmod>\s*([^<]+)\s*<\/lastmod>[\s\S]*?<\/url>/g)) {
    map.set(match[1].trim(), match[2].trim());
  }
  return map;
}

function generateSitemap(seo, currentSitemap, changedFiles) {
  const previous = sitemapLastmods(currentSitemap || '');
  const now = new Date().toISOString();
  const urls = Object.entries(seo.pages)
    .filter(([, page]) => !page.robots || page.robots.index !== false)
    .map(([route, page]) => {
      const loc = absoluteUrl(page.canonical || route, seo.defaults.siteUrl);
      const lastmod = changedFiles.has(page.file) || !previous.has(loc) ? now : previous.get(loc);
      return `  <url>\n    <loc>${xmlEscape(loc)}</loc>\n    <lastmod>${xmlEscape(lastmod)}</lastmod>\n  </url>`;
    });
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`;
}

function validateSeo(seo) {
  if (!seo || typeof seo !== 'object') throw new Error('SEO payload must be an object');
  if (!seo.defaults || typeof seo.defaults !== 'object') throw new Error('Missing defaults');
  if (!seo.pages || typeof seo.pages !== 'object') throw new Error('Missing pages');
  for (const [route, page] of Object.entries(seo.pages)) {
    if (!route.startsWith('/')) throw new Error(`Invalid route key: ${route}`);
    if (!page.file || typeof page.file !== 'string') throw new Error(`${route}: missing file`);
    if (page.file.includes('..') || page.file.startsWith('/')) throw new Error(`${route}: invalid file path`);
    if (page.schema !== null) JSON.stringify(page.schema);
  }
}

async function github(path, options = {}) {
  const repo = process.env.GITHUB_REPO;
  const token = process.env.GITHUB_TOKEN;
  const response = await fetch(`https://api.github.com/repos/${repo}${path}`, {
    ...options,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(options.headers || {})
    }
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) throw new Error(data?.message || `GitHub API failed: ${response.status}`);
  return data;
}

async function getTextFile(file, branch) {
  const data = await github(`/contents/${encodeURIComponent(file).replace(/%2F/g, '/')}?ref=${encodeURIComponent(branch)}`);
  return Buffer.from(data.content, 'base64').toString('utf8');
}

async function createBlob(content) {
  const blob = await github('/git/blobs', {
    method: 'POST',
    body: JSON.stringify({ content, encoding: 'utf-8' })
  });
  return blob.sha;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return json(res, 405, { error: 'Method Not Allowed' });
  }

  const session = requireSession(req, res);
  if (!session) return;

  if (!process.env.GITHUB_TOKEN || !process.env.GITHUB_REPO) {
    return json(res, 503, { error: 'GitHub persistence is not configured. Set GITHUB_TOKEN, GITHUB_REPO and optional GITHUB_BRANCH in Vercel.' });
  }

  try {
    const branch = process.env.GITHUB_BRANCH || 'main';
    const body = await readJsonBody(req, 2 * 1024 * 1024);
    const seo = body.seo;
    validateSeo(seo);

    const ref = await github(`/git/ref/heads/${encodeURIComponent(branch)}`);
    const baseCommitSha = ref.object.sha;
    const baseCommit = await github(`/git/commits/${baseCommitSha}`);
    const changedFiles = new Set();
    const treeItems = [];

    const seoJson = JSON.stringify(seo, null, 2) + '\n';
    const currentSeoJson = await getTextFile('seo/seo.json', branch);
    if (currentSeoJson !== seoJson) {
      treeItems.push({ path: 'seo/seo.json', mode: '100644', type: 'blob', sha: await createBlob(seoJson) });
    }

    for (const [route, page] of Object.entries(seo.pages)) {
      const currentHtml = await getTextFile(page.file, branch);
      const nextHtml = applyPage(currentHtml, route, page, seo.defaults);
      if (currentHtml !== nextHtml) {
        changedFiles.add(page.file);
        treeItems.push({ path: page.file, mode: '100644', type: 'blob', sha: await createBlob(nextHtml) });
      }
    }

    const currentSitemap = await getTextFile('sitemap.xml', branch);
    const nextSitemap = generateSitemap(seo, currentSitemap, changedFiles);
    if (currentSitemap !== nextSitemap) {
      treeItems.push({ path: 'sitemap.xml', mode: '100644', type: 'blob', sha: await createBlob(nextSitemap) });
    }

    if (treeItems.length === 0) return json(res, 200, { ok: true, message: 'No changes to save', files: [] });

    const tree = await github('/git/trees', {
      method: 'POST',
      body: JSON.stringify({ base_tree: baseCommit.tree.sha, tree: treeItems })
    });
    const commit = await github('/git/commits', {
      method: 'POST',
      body: JSON.stringify({
        message: body.message || `chore(seo): update metadata from admin (${session.username})`,
        tree: tree.sha,
        parents: [baseCommitSha]
      })
    });
    await github(`/git/refs/heads/${encodeURIComponent(branch)}`, {
      method: 'PATCH',
      body: JSON.stringify({ sha: commit.sha })
    });

    return json(res, 200, { ok: true, commit: commit.sha, files: treeItems.map(item => item.path) });
  } catch (error) {
    return json(res, 500, { error: error.message });
  }
};
