import { NextResponse } from "next/server";
import { cookies, headers } from "next/headers";
import { isStaffSession, staffSessionInfo } from "@/lib/auth";
import { checkInBookingByCode as checkInMemory, checkInTicket as checkInLegacyMemory, ensureDemoTickets, getStoreBookingScanDetails, store } from "@/lib/store";
import { checkInBookingTicket as checkInDatabase, databaseEnabled, ensureStaffUser, getBookingScanDetails } from "@/lib/db";
import { z } from "zod";
import { checkInKey } from "@/lib/rate-limit";
import { checkDatabaseRateLimit } from "@/lib/db";
import { allowPartialCheckIn, sessionMismatch } from "@/lib/check-in-logic";

const schema = z.object({
  ticketCode: z.string().trim().min(4).max(120),
  sessionId: z.string().uuid().optional(),
  guests: z.number().int().positive().optional(),
  confirm: z.boolean().optional(),
});

type ScanDetails = {
  ticketCode: string;
  bookingReference: string | null;
  bookingStatus: string;
  eventTitle: string;
  sessionId: string | null;
  sessionStartsAt: string | null;
  sessionEndsAt: string | null;
  buyerName: string;
  buyerEmail: string;
  guestBreakdown: { name: string; quantity: number }[];
  totalGuests: number;
  checkedInCount: number;
  paid: boolean;
  testPayment: boolean;
  lastCheckedInAt: string | null;
  scannedBy: string | null;
};

function scanResponse(scan: ScanDetails, partialAllowed: boolean) {
  return {
    ok: true,
    mode: "lookup" as const,
    ticketCode: scan.ticketCode,
    bookingReference: scan.bookingReference,
    eventTitle: scan.eventTitle,
    sessionStartsAt: scan.sessionStartsAt,
    sessionEndsAt: scan.sessionEndsAt,
    buyerName: scan.buyerName,
    guestBreakdown: scan.guestBreakdown,
    totalGuests: scan.totalGuests,
    checkedInCount: scan.checkedInCount,
    remainingGuests: Math.max(0, scan.totalGuests - scan.checkedInCount),
    paid: scan.paid,
    testPayment: scan.testPayment,
    partialCheckInAllowed: partialAllowed,
    fullyCheckedIn: scan.checkedInCount >= scan.totalGuests,
  };
}
export async function POST(request: Request) {
  const session = (await cookies()).get("ticketing_staff")?.value;
  if (!(await isStaffSession(session, "check_in.manage"))) return NextResponse.json({ error: "Staff authentication required" }, { status: 401 });
  const staff = await staffSessionInfo(session);
  const rate = await checkDatabaseRateLimit(checkInKey(staff?.userId || staff?.email || "bootstrap"), 120, 60 * 1000);
  if (!rate.allowed) return NextResponse.json({ error: "Too many check-in attempts. Please try again shortly." }, { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter a ticket code" }, { status: 400 });
  const { ticketCode, sessionId, guests, confirm } = parsed.data;
  const partialAllowed = allowPartialCheckIn();
  const upperCode = ticketCode.toUpperCase();

  // Legacy single-person demo tickets (DEMO-*) keep their original one-shot behaviour. Any other
  // code is looked up in the demo booking_tickets store whenever the real database is disabled.
  if (upperCode.startsWith("DEMO-") || !databaseEnabled || process.env.DEMO_MODE !== "false") {
    if (upperCode.startsWith("DEMO-") || !store.bookingTickets.some((item) => item.ticketCode.toUpperCase() === upperCode)) {
      ensureDemoTickets();
      const ticket = store.tickets.find((item) => item.ticketCode.toUpperCase() === upperCode);
      if (!ticket) return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
      if (!confirm) {
        return NextResponse.json(scanResponse({
          ticketCode: ticket.ticketCode,
          bookingReference: null,
          bookingStatus: "confirmed",
          eventTitle: "Demo event",
          sessionId: null,
          sessionStartsAt: null,
          sessionEndsAt: null,
          buyerName: ticket.attendeeName,
          buyerEmail: "",
          guestBreakdown: [{ name: "Guest", quantity: 1 }],
          totalGuests: 1,
          checkedInCount: ticket.status === "checked_in" ? 1 : 0,
          paid: false,
          testPayment: true,
          lastCheckedInAt: ticket.checkedInAt ?? null,
          scannedBy: null,
        }, partialAllowed));
      }
      const result = checkInLegacyMemory(ticketCode);
      return result.ok
        ? NextResponse.json({ ok: true, mode: "confirm", ticketCode, guestsCheckedIn: 1, totalGuests: 1, checkedInCount: 1, eventTitle: "Demo event", buyerName: result.ticket.attendeeName, bookingReference: null })
        : NextResponse.json({ error: result.error }, { status: 409 });
    }

    const scan = getStoreBookingScanDetails(ticketCode);
    if (!scan) return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    if (sessionMismatch(scan.sessionId, sessionId)) {
      return NextResponse.json({ error: "This ticket is for a different event session.", mismatch: true, eventTitle: scan.eventTitle, sessionStartsAt: scan.sessionStartsAt }, { status: 409 });
    }
    if (!confirm) return NextResponse.json(scanResponse(scan, partialAllowed));
    if (scan.checkedInCount >= scan.totalGuests) {
      return NextResponse.json({ error: "This booking is fully checked in", fullyCheckedIn: true, buyerName: scan.buyerName, eventTitle: scan.eventTitle }, { status: 409 });
    }
    const result = checkInMemory(ticketCode, guests);
    if (!result.ok) {
      if (result.error === "over_admission") return NextResponse.json({ error: `You can only check in ${scan.totalGuests - scan.checkedInCount} more guest(s).`, remaining: scan.totalGuests - scan.checkedInCount }, { status: 409 });
      if (result.error === "already_checked_in") return NextResponse.json({ error: "This booking is fully checked in", fullyCheckedIn: true }, { status: 409 });
      return NextResponse.json({ error: "Enter a valid number of guests to check in." }, { status: 400 });
    }
    return NextResponse.json({ ok: true, mode: "confirm", ticketCode, guestsCheckedIn: result.guestsCheckedIn, totalGuests: result.totalGuests, checkedInCount: result.checkedInCount, eventTitle: scan.eventTitle, buyerName: scan.buyerName, bookingReference: scan.bookingReference });
  }

  const staffEmail = process.env.STAFF_EMAIL;
  if (!staffEmail) return NextResponse.json({ error: "Staff identity is not configured" }, { status: 503 });
  try {
    const requestHeaders = await headers();
    const scan = await getBookingScanDetails(ticketCode);
    if (!scan) return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    if (sessionMismatch(scan.sessionId, sessionId)) {
      return NextResponse.json({ error: "This ticket is for a different event session.", mismatch: true, eventTitle: scan.eventTitle, sessionStartsAt: scan.sessionStartsAt }, { status: 409 });
    }
    if (scan.bookingStatus === "cancelled") {
      return NextResponse.json({ error: "This ticket belongs to a cancelled booking. Do not admit.", eventTitle: scan.eventTitle, buyerName: scan.buyerName }, { status: 409 });
    }
    if (!confirm) return NextResponse.json(scanResponse(scan, partialAllowed));
    if (scan.checkedInCount >= scan.totalGuests) {
      return NextResponse.json({ error: "This booking is fully checked in", fullyCheckedIn: true, firstScannedAt: scan.lastCheckedInAt, scannedBy: scan.scannedBy, buyerName: scan.buyerName, eventTitle: scan.eventTitle }, { status: 409 });
    }
    const staffUserId = await ensureStaffUser(staffEmail);
    const ticket = await checkInDatabase(ticketCode, guests, staffUserId, requestHeaders.get("x-forwarded-for"), requestHeaders.get("user-agent"));
    return NextResponse.json({ ok: true, mode: "confirm", ticketCode, guestsCheckedIn: guests ?? Math.max(0, scan.totalGuests - scan.checkedInCount), totalGuests: Number(ticket.total_guests), checkedInCount: Number(ticket.checked_in_count), eventTitle: scan.eventTitle, buyerName: scan.buyerName, bookingReference: scan.bookingReference });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Check-in failed";
    if (message.includes("ticket_not_found")) return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    if (message.includes("ticket_cancelled")) return NextResponse.json({ error: "This ticket belongs to a cancelled booking. Do not admit." }, { status: 409 });
    if (message.includes("already_checked_in")) {
      const scan = await getBookingScanDetails(ticketCode).catch(() => null);
      return NextResponse.json({
        error: "This booking is fully checked in",
        fullyCheckedIn: true,
        firstScannedAt: scan?.lastCheckedInAt,
        scannedBy: scan?.scannedBy,
        buyerName: scan?.buyerName,
        eventTitle: scan?.eventTitle,
      }, { status: 409 });
    }
    if (message.includes("over_admission")) {
      const scan = await getBookingScanDetails(ticketCode).catch(() => null);
      const remaining = scan ? Math.max(0, scan.totalGuests - scan.checkedInCount) : 0;
      return NextResponse.json({ error: `You can only check in ${remaining} more guest(s).`, remaining }, { status: 409 });
    }
    if (message.includes("invalid_guest_count")) return NextResponse.json({ error: "Enter a valid number of guests to check in." }, { status: 400 });
    return NextResponse.json({ error: "Check-in failed" }, { status: 500 });
  }
}
