const STAGING_ORIGIN = "https://hilston-park.vercel.app";

export function eventPublishingEnabled() {
  if (process.env.VERCEL_ENV === "production") {
    return process.env.EVENT_PUBLISHING_ENABLED === "true"
      && process.env.LIVE_EVENT_PUBLISHING_AUTHORIZED === "true";
  }
  return process.env.EVENT_PUBLISHING_ENABLED === "true";
}

export function publicEventsOrigin() {
  return process.env.EVENTS_PUBLIC_ORIGIN || STAGING_ORIGIN;
}

export function publicEventsCorsHeaders(request: Request) {
  const requestOrigin = request.headers.get("origin");
  const allowedOrigin = publicEventsOrigin();
  const origin = requestOrigin === allowedOrigin ? requestOrigin : allowedOrigin;

  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Cache-Control",
    Vary: "Origin",
  };
}