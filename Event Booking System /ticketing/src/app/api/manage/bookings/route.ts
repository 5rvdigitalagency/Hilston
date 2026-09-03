import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { isStaffSession } from "@/lib/auth";
import { databaseEnabled, listBookingDetails } from "@/lib/db";
import { appBaseUrl } from "@/lib/email";
import { createTicketLinkToken } from "@/lib/ticket-links";

export async function GET(request: Request) {
  const session = (await cookies()).get("ticketing_staff")?.value;
  if (!(await isStaffSession(session, "bookings.view"))) return NextResponse.json({ error: "Staff authentication required" }, { status: 401 });
  if (!databaseEnabled) return NextResponse.json({ bookings: [] });
  const eventId = new URL(request.url).searchParams.get("eventId") || undefined;
  try {
    const bookings = await listBookingDetails(eventId);
    const withLinks = await Promise.all(bookings.map(async (booking) => ({
      ...booking,
      ticketUrl: `${appBaseUrl()}/tickets/${await createTicketLinkToken(booking.bookingId)}`,
    })));
    return NextResponse.json({ bookings: withLinks }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("bookings list failed", error);
    return NextResponse.json({ error: "Bookings could not be loaded." }, { status: 503 });
  }
}
