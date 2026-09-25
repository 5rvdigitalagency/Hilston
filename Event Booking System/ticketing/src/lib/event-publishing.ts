const STAGING_ORIGIN = "https://hilston-park.vercel.app";

function secureEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return difference === 0;
}

export function eventPublishingEnabled() {
  if (process.env.EVENT_DEPLOYMENT_ROLE === "live") {
    return process.env.EVENT_PUBLISHING_ENABLED === "true"
      && process.env.LIVE_EVENT_PUBLISHING_AUTHORIZED === "true";
  }
  return process.env.EVENT_DEPLOYMENT_ROLE === "staging"
    && process.env.EVENT_PUBLISHING_ENABLED === "true";
}

export function stagingStorefrontEnabled() {
  return process.env.EVENT_DEPLOYMENT_ROLE === "staging"
    && process.env.EVENT_STOREFRONT_ENABLED === "true"
    && eventPublishingEnabled();
}

export function publicEventsOrigin() {
  return process.env.EVENTS_PUBLIC_ORIGIN || STAGING_ORIGIN;
}

export function publicEventsFeedAuthorized(request: Request) {
  const key = process.env.TICKETING_EVENTS_FEED_KEY;
  const authorization = request.headers.get("authorization");
  return process.env.EVENTS_PUBLIC_FEED_ENABLED === "true"
    && typeof key === "string"
    && typeof authorization === "string"
    && authorization.startsWith("Bearer ")
    && secureEqual(authorization.slice(7), key);
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