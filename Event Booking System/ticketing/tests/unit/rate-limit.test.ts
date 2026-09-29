import { describe, expect, it } from "vitest";
import { checkInKey, rateLimitRetryAfterSeconds, rateLimitWindowStart, requestIp, storefrontBookingIpKey, storefrontBookingSessionKey } from "@/lib/rate-limit";

describe("rate-limit window maths", () => {
  it("floors a timestamp to its fixed window", () => {
    expect(rateLimitWindowStart(Date.UTC(2026, 8, 29, 12, 0, 59, 999), 60_000).toISOString()).toBe("2026-09-29T12:00:00.000Z");
  });

  it("returns the remaining seconds in the current window", () => {
    expect(rateLimitRetryAfterSeconds(Date.UTC(2026, 8, 29, 12, 0, 45, 100), 60_000)).toBe(15);
  });
});

describe("rate-limit keys", () => {
  it("prefers Vercel's forwarded client IP", () => {
    expect(requestIp(new Request("https://tickets.example", { headers: { "x-vercel-forwarded-for": "203.0.113.8", "x-forwarded-for": "198.51.100.4" } }))).toBe("203.0.113.8");
    expect(requestIp(new Request("https://tickets.example", { headers: { "x-forwarded-for": "198.51.100.4, 10.0.0.1" } }))).toBe("198.51.100.4");
  });

  it("scopes storefront booking limits by IP and session", () => {
    expect(storefrontBookingIpKey("203.0.113.4")).toBe("storefront-booking-ip:203.0.113.4");
    expect(storefrontBookingIpKey("203.0.113.4")).toBe(storefrontBookingIpKey("203.0.113.4"));
    expect(storefrontBookingSessionKey("session-a")).not.toBe(storefrontBookingSessionKey("session-b"));
  });

  it("scopes check-in limits by staff identity rather than IP", () => {
    expect(checkInKey("staff-user-1")).toBe("check-in:staff-user-1");
    expect(checkInKey("staff-user-1")).toBe(checkInKey("staff-user-1"));
  });
});
