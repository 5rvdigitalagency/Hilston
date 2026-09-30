/**
 * Phase 10.1 ticket architecture: one booking = one ticket code = one QR code, with a
 * `total_guests` / `checked_in_count` pair instead of one legacy `tickets` row per guest.
 *
 * Pure, DB-free helpers live here so the admission/session/migration-conversion math can be
 * unit tested without a live Postgres instance. Both src/lib/db.ts (real DB) and src/lib/store.ts
 * (demo mode) call into these so the two stay in lockstep.
 */

export const BOOKING_TICKET_PREFIX = "HP";
export const BOOKING_REFERENCE_PREFIX = "BK";

/** ALLOW_PARTIAL_CHECKIN defaults to true (partial arrivals allowed) unless explicitly "false". */
export function allowPartialCheckIn() {
  return process.env.ALLOW_PARTIAL_CHECKIN !== "false";
}

export function generateBookingTicketCode() {
  const random = crypto.randomUUID().replace(/-/g, "").toUpperCase();
  return `${BOOKING_TICKET_PREFIX}-${random.slice(0, 6)}`;
}

export function generateBookingReference() {
  const random = crypto.randomUUID().replace(/-/g, "").toUpperCase();
  return `${BOOKING_REFERENCE_PREFIX}-${random.slice(0, 5)}`;
}

export type BookingTicketState = { totalGuests: number; checkedInCount: number };

export type CheckInAdmission =
  | { ok: true; guestsToAdmit: number }
  | { ok: false; error: "invalid_guest_count" | "already_checked_in" | "over_admission"; remaining: number };

/**
 * Decides how many guests can be admitted for one check-in action. When partial check-in is
 * disabled, the requested guest count is ignored and the full remaining balance is always used
 * (the UI only offers a single "check in all" action in that mode).
 */
export function resolveCheckInAdmission(state: BookingTicketState, requestedGuests: number | undefined, partialAllowed: boolean): CheckInAdmission {
  const remaining = state.totalGuests - state.checkedInCount;
  if (remaining <= 0) return { ok: false, error: "already_checked_in", remaining: 0 };

  const requested = partialAllowed ? requestedGuests ?? remaining : remaining;
  if (!Number.isInteger(requested) || requested <= 0) return { ok: false, error: "invalid_guest_count", remaining };
  if (requested > remaining) return { ok: false, error: "over_admission", remaining };
  return { ok: true, guestsToAdmit: requested };
}

/** True when a scanned ticket's session doesn't match the session the staff member selected. */
export function sessionMismatch(scanSessionId: string | null | undefined, selectedSessionId: string | null | undefined) {
  return Boolean(selectedSessionId) && Boolean(scanSessionId) && scanSessionId !== selectedSessionId;
}

export type LegacyBookingTickets = { itemQuantities: number[]; legacyTicketStatuses: string[] };

/**
 * Mirrors the data-conversion math in database/migrations/0004_booking_tickets.sql exactly, so it
 * can be unit tested. total_guests = sum of booking_items quantities, falling back to a count of
 * legacy ticket rows for bookings that predate ticket types. checked_in_count = legacy tickets
 * already checked in, capped at total_guests.
 */
export function summariseLegacyBookingTickets(input: LegacyBookingTickets): BookingTicketState {
  const itemTotal = input.itemQuantities.reduce((sum, quantity) => sum + quantity, 0);
  const totalGuests = Math.max(1, itemTotal > 0 ? itemTotal : input.legacyTicketStatuses.length);
  const checkedIn = input.legacyTicketStatuses.filter((status) => status === "checked_in").length;
  return { totalGuests, checkedInCount: Math.min(totalGuests, checkedIn) };
}
