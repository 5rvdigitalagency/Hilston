import { NextResponse } from "next/server";
import { z } from "zod";
import { createSessionBooking, databaseEnabled, listEvents } from "@/lib/db";
import { stagingStorefrontEnabled } from "@/lib/event-publishing";
import { createTicketLinkToken } from "@/lib/ticket-links";
import { deliverBookingEmails, emailEnabled } from "@/lib/booking-delivery";
import { computeDemoEventStatus, createStoreSessionBooking, store } from "@/lib/store";
import { requestIp, storefrontBookingIpKey, storefrontBookingSessionKey } from "@/lib/rate-limit";
import { checkDatabaseRateLimit } from "@/lib/db";

const bookingSchema = z.object({
  eventId: z.string().uuid(),
  sessionId: z.string().uuid(),
  items: z.array(z.object({ ticketTypeId: z.string().uuid(), quantity: z.number().int().min(1).max(99) })).min(1).max(20),
  name: z.string().trim().min(2).max(120),
  email: z.string().email().max(254),
  phone: z.string().trim().min(5).max(30),
  specialRequests: z.string().trim().max(500).optional().default(""),
  paymentMode: z.literal("test"),
});

function testPaymentsAllowed() {
  return process.env.DEMO_MODE === "true" || process.env.EVENT_DEPLOYMENT_ROLE === "staging";
}

/** Compares against the incoming Host header rather than request.url — Next.js can normalise request.url's host (e.g. to "localhost") independently of the hostname the client actually connected to, which made this check fail for any non-default hostname. */
function isSameOriginRequest(request: Request) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (!origin || !host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  if (!stagingStorefrontEnabled()) return NextResponse.json({ error: "Booking service unavailable." }, { status: 404 });
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "Booking requests must come from this storefront." }, { status: 403 });
  }

  const parsed = bookingSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Please check the booking details." }, { status: 400 });
  const ipRate = await checkDatabaseRateLimit(storefrontBookingIpKey(requestIp(request)), 20, 60 * 1000);
  const sessionRate = await checkDatabaseRateLimit(storefrontBookingSessionKey(parsed.data.sessionId), 10, 60 * 1000);
  const rate = ipRate.allowed ? sessionRate : ipRate;
  if (!rate.allowed) return NextResponse.json({ error: "Too many booking attempts. Please try again later." }, { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } });
  if (!testPaymentsAllowed()) {
    return NextResponse.json({ error: "Online payments are not configured for live sales." }, { status: 503 });
  }

  try {
    let booking: { bookingId: string; attendeeId: string; eventTitle: string; totalPence: number; ticketCode: string; totalGuests: number };
    if (databaseEnabled) {
      const event = (await listEvents()).find((item) => item.id === parsed.data.eventId && item.status === "published");
      if (!event) return NextResponse.json({ error: "This event is no longer available." }, { status: 404 });
      const staffEmail = process.env.STAFF_EMAIL;
      booking = await createSessionBooking({ ...parsed.data, staffEmail });
    } else {
      const event = store.events.find((item) => item.id === parsed.data.eventId && (item.status ?? computeDemoEventStatus(item)) === "published");
      if (!event) return NextResponse.json({ error: "This event is no longer available." }, { status: 404 });
      booking = createStoreSessionBooking(parsed.data);
    }
    const token = await createTicketLinkToken(booking.bookingId);
    const delivery = emailEnabled && databaseEnabled
      ? await deliverBookingEmails(booking.bookingId, process.env.STAFF_EMAIL, token).catch(() => ({ emailed: false as const, ticketUrl: `/tickets/${token}` }))
      : { emailed: false as const, ticketUrl: `/tickets/${token}` };
    return NextResponse.json({ booking, confirmationUrl: `/booking/confirmation/${token}`, ticketUrl: delivery.ticketUrl, notifications: emailEnabled && databaseEnabled ? (delivery.emailed ? "sent" : "failed") : "not_configured" }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Booking could not be confirmed";
    if (message.includes("event_not_found")) return NextResponse.json({ error: "This event is no longer available." }, { status: 404 });
    if (message.includes("event_full")) return NextResponse.json({ error: "This event no longer has enough spaces for this booking." }, { status: 409 });
    if (message.includes("ticket_limit_exceeded")) return NextResponse.json({ error: "One of the ticket types exceeds its per-order limit." }, { status: 400 });
    if (message.includes("ticket_type_not_found")) return NextResponse.json({ error: "One of the selected ticket types is no longer available." }, { status: 400 });
    if (message.includes("booking_empty")) return NextResponse.json({ error: "Please select at least one ticket." }, { status: 400 });
    console.error("storefront booking failed", error);
    return NextResponse.json({ error: "Booking could not be confirmed. Please try again." }, { status: 503 });
  }
}