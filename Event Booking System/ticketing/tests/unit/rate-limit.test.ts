import { describe, expect, it } from "vitest";
import { checkInKey, rateLimitRetryAfterSeconds, rateLimitWindowStart, storefrontBookingKey } from "@/lib/rate-limit";

describe("rate-limit window maths", () => {
  it("floors a timestamp to its fixed window", () => {
    expect(rateLimitWindowStart(Date.UTC(2026, 8, 29, 12, 0, 59, 999), 60_000).toISOString()).toBe("2026-09-29T12:00:00.000Z");
  });

  it("returns the remaining seconds in the current window", () => {
    expect(rateLimitRetryAfterSeconds(Date.UTC(2026, 8, 29, 12, 0, 45, 100), 60_000)).toBe(15);
  });
});

describe("rate-limit keys", () => {
  it("scopes storefront booking limits by IP and session", () => {
    expect(storefrontBookingKey("203.0.113.4", "session-a")).toBe("storefront-booking:203.0.113.4:session-a");
    expect(storefrontBookingKey("203.0.113.4", "session-a")).not.toBe(storefrontBookingKey("203.0.113.4", "session-b"));
  });

  it("scopes check-in limits by staff identity rather than IP", () => {
    expect(checkInKey("staff-user-1")).toBe("check-in:staff-user-1");
    expect(checkInKey("staff-user-1")).toBe(checkInKey("staff-user-1"));
  });
});
