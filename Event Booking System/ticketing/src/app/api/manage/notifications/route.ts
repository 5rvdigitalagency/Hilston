import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { isStaffSession } from "@/lib/auth";
import { getBookingForEmail, markDispatchByKey, prepareBookingConfirmation, writeAuditLog } from "@/lib/db";
import { emailEnabled, sendBookingConfirmation, appBaseUrl } from "@/lib/email";
import { createTicketLinkToken } from "@/lib/ticket-links";

const schema = z.object({ bookingId: z.string().uuid().optional(), attendeeId: z.string().uuid().optional() })
  .refine((value) => Boolean(value.bookingId || value.attendeeId), { message: "A booking or attendee is required" });

export async function POST(request: Request) {
  const session = (await cookies()).get("ticketing_staff")?.value;
  if (!(await isStaffSession(session, "events.manage"))) return NextResponse.json({ error: "Staff authentication required" }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid booking record" }, { status: 400 });

  try {
    let bookingId = parsed.data.bookingId;
    if (!bookingId) {
      const prepared = await prepareBookingConfirmation(parsed.data.attendeeId!);
      if (!prepared.bookingId) return NextResponse.json({ error: "This guest has no booking to confirm yet." }, { status: 409 });
      bookingId = prepared.bookingId;
    }

    const details = await getBookingForEmail(bookingId);
    if (!details.email) return NextResponse.json({ error: "This booking has no email address." }, { status: 409 });
    const ticketCode = details.ticketCode;
    if (!ticketCode) return NextResponse.json({ error: "This booking has no issued ticket yet." }, { status: 409 });
    if (!emailEnabled) return NextResponse.json({ status: "queued", message: "Confirmation queued. Add EMAIL_FROM plus either SMTP_HOST or RESEND_API_KEY to send emails." });

    try {
      const ticketUrl = `${appBaseUrl()}/tickets/${await createTicketLinkToken(bookingId)}`;
      const sent = await sendBookingConfirmation({ name: details.name, email: details.email, eventTitle: details.eventTitle, startsAt: details.startsAt, venue: details.venue, ticketCode, totalGuests: details.totalGuests, bookingReference: details.bookingReference || undefined, ticketUrl });
      await markDispatchByKey(`booking:${bookingId}:guest`, { status: "sent", providerRef: sent.id });
      await writeAuditLog("notification.booking_confirmation.sent", { bookingId });
      return NextResponse.json({ status: "sent", message: `Tickets sent to ${details.email}.` });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Email provider rejected the request";
      await markDispatchByKey(`booking:${bookingId}:guest`, { status: "failed", error: message });
      return NextResponse.json({ status: "failed", error: `The email could not be sent: ${message}` }, { status: 502 });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown";
    if (message.includes("booking_not_found") || message.includes("attendee_not_found")) return NextResponse.json({ error: "That booking could not be found." }, { status: 404 });
    console.error("booking confirmation notification failed", error);
    return NextResponse.json({ error: "Confirmation could not be sent." }, { status: 503 });
  }
}
