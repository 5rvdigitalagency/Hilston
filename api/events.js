const TICKETING_URL = process.env.TICKETING_EVENTS_API_URL;
const FEED_KEY = process.env.TICKETING_EVENTS_FEED_KEY;

function configured() {
  if (process.env.EVENTS_DISPLAY_ENABLED !== 'true' || !TICKETING_URL || !FEED_KEY) return false;
  try {
    return new URL(TICKETING_URL).protocol === 'https:';
  } catch {
    return false;
  }
}

module.exports = async function handler(req, res) {
  if (!['GET', 'POST'].includes(req.method)) {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!configured()) {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ events: [] });
  }

  try {
    const endpoint = req.method === 'GET'
      ? TICKETING_URL
      : new URL('/api/public/bookings', TICKETING_URL).toString();
    const response = await fetch(endpoint, {
      method: req.method,
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${FEED_KEY}`,
        ...(req.method === 'POST' ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(req.method === 'POST' ? { body: JSON.stringify(req.body) } : {}),
    });

    const body = await response.json();
    if (req.method === 'POST') return res.status(response.status).json(body);
    if (!response.ok) return res.status(503).json({ events: [] });
    const events = Array.isArray(body.events) ? body.events : [];
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ events });
  } catch {
    return res.status(503).json({ events: [] });
  }
};