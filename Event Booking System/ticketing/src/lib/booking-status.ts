export type BookingStatus = "pending_payment" | "paid" | "cancelled" | "refunded" | "partially_refunded" | "expired" | "test";

export type BookingStatusRow = {
  status?: string | null;
  paid?: boolean | null;
  testPayment?: boolean | null;
  payment?: { provider?: string | null; status?: string | null } | null;
  refundStatus?: string | null;
};

export const BOOKING_STATUS_LABEL: Record<BookingStatus, string> = {
  pending_payment: "Awaiting payment",
  paid: "Paid",
  cancelled: "Cancelled",
  refunded: "Refunded",
  partially_refunded: "Partially refunded",
  expired: "Expired",
  test: "Test (no payment)",
};

export const BOOKING_STATUS_TONE: Record<BookingStatus, "success" | "warning" | "danger" | "neutral" | "info"> = {
  pending_payment: "warning",
  paid: "success",
  cancelled: "danger",
  refunded: "neutral",
  partially_refunded: "info",
  expired: "neutral",
  test: "neutral",
};

export function deriveBookingStatus(row: BookingStatusRow): BookingStatus {
  if (row.testPayment || row.payment?.provider === "mock") return "test";
  if (row.refundStatus === "partially_refunded") return "partially_refunded";
  if (row.refundStatus === "refunded") return "refunded";
  if (row.status === "cancelled") return "cancelled";
  if (row.status === "expired") return "expired";
  if (row.paid || row.payment?.status === "succeeded") return "paid";
  return "pending_payment";
}

export const COUNTS_AS_REVENUE = new Set<BookingStatus>(["paid"]);

export function formatGBP(pence: number) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format((pence || 0) / 100);
}
