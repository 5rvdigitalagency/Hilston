const crypto = require('node:crypto');

const COOKIE_NAME = 'hilston_seo_session';
const SESSION_SECONDS = 8 * 60 * 60;

function parseCookies(req) {
  const header = req.headers.cookie || '';
  return Object.fromEntries(header.split(';').map(part => {
    const index = part.indexOf('=');
    if (index === -1) return ['', ''];
    return [part.slice(0, index).trim(), decodeURIComponent(part.slice(index + 1).trim())];
  }).filter(([key]) => key));
}

function sign(value, secret) {
  return crypto.createHmac('sha256', secret).update(value).digest('base64url');
}

function timingSafeStringEqual(left, right) {
  const leftBuffer = Buffer.from(String(left));
  const rightBuffer = Buffer.from(String(right));
  if (leftBuffer.length !== rightBuffer.length) return false;
  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function passwordMatches(password) {
  const hash = process.env.SEO_ADMIN_PASSWORD_SHA256;
  const plain = process.env.SEO_ADMIN_PASSWORD;
  if (hash) {
    const supplied = crypto.createHash('sha256').update(String(password)).digest('hex');
    return timingSafeStringEqual(supplied, hash);
  }
  if (plain) return timingSafeStringEqual(password, plain);
  return false;
}

function authConfigured() {
  return Boolean(process.env.SEO_ADMIN_USERNAME && process.env.SEO_SESSION_SECRET && (process.env.SEO_ADMIN_PASSWORD_SHA256 || process.env.SEO_ADMIN_PASSWORD));
}

function createSession(username) {
  const secret = process.env.SEO_SESSION_SECRET;
  const expires = Math.floor(Date.now() / 1000) + SESSION_SECONDS;
  const payload = `${username}.${expires}`;
  return `${payload}.${sign(payload, secret)}`;
}

function verifySession(req) {
  if (!authConfigured()) return null;
  const token = parseCookies(req)[COOKIE_NAME];
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [username, expires, signature] = parts;
  if (Number(expires) < Math.floor(Date.now() / 1000)) return null;
  if (username !== process.env.SEO_ADMIN_USERNAME) return null;
  const expected = sign(`${username}.${expires}`, process.env.SEO_SESSION_SECRET);
  if (!timingSafeStringEqual(signature, expected)) return null;
  return { username };
}

function requireSession(req, res) {
  const session = verifySession(req);
  if (session) return session;
  res.statusCode = authConfigured() ? 401 : 503;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify({ error: authConfigured() ? 'Unauthorised' : 'SEO admin auth is not configured' }));
  return null;
}

function setSessionCookie(res, token) {
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; Max-Age=${SESSION_SECONDS}; HttpOnly; Secure; SameSite=Strict`);
}

function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict`);
}

async function readJsonBody(req, maxBytes = 1024 * 1024) {
  let body = '';
  for await (const chunk of req) {
    body += chunk;
    if (Buffer.byteLength(body) > maxBytes) throw new Error('Request body too large');
  }
  return body ? JSON.parse(body) : {};
}

module.exports = {
  authConfigured,
  clearSessionCookie,
  createSession,
  passwordMatches,
  readJsonBody,
  requireSession,
  setSessionCookie,
  verifySession
};
