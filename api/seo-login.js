const { authConfigured, createSession, passwordMatches, readJsonBody, setSessionCookie } = require('./_seo-auth');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.statusCode = 405;
    return res.end('Method Not Allowed');
  }

  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  if (!authConfigured()) {
    res.statusCode = 503;
    return res.end(JSON.stringify({ error: 'SEO admin auth is not configured' }));
  }

  try {
    const body = await readJsonBody(req);
    const username = String(body.username || '');
    const password = String(body.password || '');

    if (username !== process.env.SEO_ADMIN_USERNAME || !passwordMatches(password)) {
      res.statusCode = 401;
      return res.end(JSON.stringify({ error: 'Invalid username or password' }));
    }

    setSessionCookie(res, createSession(username));
    return res.end(JSON.stringify({ ok: true, user: username }));
  } catch (error) {
    res.statusCode = 400;
    return res.end(JSON.stringify({ error: error.message }));
  }
};
