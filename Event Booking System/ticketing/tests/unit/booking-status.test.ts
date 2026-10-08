import { describe, expect, it } from "vitest";
import { deriveBookingStatus, formatGBP } from "@/lib/booking-status";

describe("deriveBookingStatus", () => {
  it.each([
    [{ testPayment: true }, "test"],
    [{ payment: { provider: "mock" } }, "test"],
    [{ status: "hold", paid: false }, "pending_payment"],
    [{ status: "confirmed", paid: true }, "paid"],
    [{ status: "cancelled", paid: false }, "cancelled"],
    [{ status: "expired", paid: false }, "expired"],
    [{ status: "confirmed", paid: true, refundStatus: "refunded" }, "refunded"],
    [{ status: "confirmed", paid: true, refundStatus: "partially_refunded" }, "partially_refunded"],
  ])("maps %j to %s", (row, expected) => {
    expect(deriveBookingStatus(row)).toBe(expected);
  });
});

describe("formatGBP", () => {
  it.each([[0, "£0.00"], [500, "£5.00"], [1005, "£10.05"]])("formats %i pence as %s", (pence, expected) => {
    expect(formatGBP(pence)).toBe(expected);
  });
});