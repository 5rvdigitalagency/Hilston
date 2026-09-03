import { NextResponse } from "next/server";
import { z } from "zod";
import { createMockBooking, databaseEnabled, getBookingForEmail, markDispatchByKey, orgSettings } from "@/lib/db";
import { appBaseUrl, emailEnabled, sendBookingConfirmation, sendStaffBookingAlert } from "@/lib/email";
import { createTicketLinkToken } from "@/lib/ticket-links";
import { buildTicketPdf } from "@/lib/ticket-pdf";

const CORS = { "Access-Control-Allow-Origin": "https://hilston-park.vercel.app", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type" };
const bookingSchema = z.object({ eventId: z.string().uuid(), name: z.string().trim().min(2).max(120), email: z.string().email().max(254), childCount: z.number().int().min(0).max(100), paymentMode: z.literal("test") });

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

async function deliverBookingEmails(bookingId: string, staffEmail?: string) {
  const details = await getBookingForEmail(bookingId);
  const ticketUrl = `${appBaseUrl()}/tickets/${await createTicketLinkToken(bookingId)}`;
  const pdf = await buildTicketPdf({ org: await orgSettings(), eventTitle: details.eventTitle, startsAt: details.startsAt, venue: details.venue, guestName: details.name, ticketCodes: details.ticketCodes }).catch(() => undefined);
  try {
    const sent = await sendBookingConfirmation({ ...details, ticketUrl, pdf });
    await markDispatchByKey(`booking:${bookingId}:guest`, { status: "sent", providerRef: sent.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Email delivery failed";
    console.error("booking confirmation email failed", message);
    await markDispatchByKey(`booking:${bookingId}:guest`, { status: "failed", error: message });
    return { emailed: false as const };
  }
  if (staffEmail) {
    try {
      const alert = await sendStaffBookingAlert({ to: staffEmail, name: details.name, email: details.email, eventTitle: details.eventTitle, ticketCount: details.ticketCodes.length });
      await markDispatchByKey(`booking:${bookingId}:staff`, { status: "sent", providerRef: alert.id });
    } catch (error) {
      await markDispatchByKey(`booking:${bookingId}:staff`, { status: "failed", error: error instanceof Error ? error.message : "failed" });
    }
  }
  return { emailed: true as const };
}

export async function POST(request: Request) {
  if (!databaseEnabled) return NextResponse.json({ error: "Booking storage is unavailable." }, { status: 503, headers: CORS });
  const parsed = bookingSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Please check the booking details." }, { status: 400, headers: CORS });
  try {
    const staffEmail = process.env.STAFF_EMAIL;
    const booking = await createMockBooking({ ...parsed.data, staffEmail });
    const delivery = emailEnabled ? await deliverBookingEmails(booking.bookingId, staffEmail) : { emailed: false as const };
    const notifications = !emailEnabled ? "not_configured" : delivery.emailed ? "sent" : "failed";
    return NextResponse.json({ booking, notifications }, { status: 201, headers: CORS });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Booking could not be confirmed";
    if (message.includes("event_not_found")) return NextResponse.json({ error: "This event is no longer available." }, { status: 404, headers: CORS });
    if (message.includes("event_full")) return NextResponse.json({ error: "This event no longer has enough spaces for this booking." }, { status: 409, headers: CORS });
    console.error("public booking failed", error);
    return NextResponse.json({ error: "Booking could not be confirmed. Please try again." }, { status: 503, headers: CORS });
  }
}