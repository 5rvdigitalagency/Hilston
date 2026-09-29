export function rateLimitWindowStart(nowMs: number, windowMs: number) {
  return new Date(Math.floor(nowMs / windowMs) * windowMs);
}

export function rateLimitRetryAfterSeconds(nowMs: number, windowMs: number) {
  const windowStart = rateLimitWindowStart(nowMs, windowMs).getTime();
  return Math.max(1, Math.ceil((windowStart + windowMs - nowMs) / 1000));
}

export function storefrontBookingKey(ip: string, sessionId: string) {
  return `storefront-booking:${ip}:${sessionId}`;
}

export function checkInKey(staffUserId: string) {
  return `check-in:${staffUserId}`;
}

export function requestIp(request: Request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || request.headers.get("x-real-ip")
    || "unknown";
}
