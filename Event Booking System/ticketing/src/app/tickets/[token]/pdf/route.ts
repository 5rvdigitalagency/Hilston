import { NextResponse } from "next/server";
import { getBookingForEmail, orgSettings } from "@/lib/db";
import { readTicketLinkToken } from "@/lib/ticket-links";
import { buildTicketPdf } from "@/lib/ticket-pdf";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  const bookingId = await readTicketLinkToken(token);
  if (!bookingId) return NextResponse.json({ error: "This ticket link is not valid." }, { status: 404 });

  try {
    const booking = await getBookingForEmail(bookingId);
    const pdf = await buildTicketPdf({
      org: await orgSettings(),
      eventTitle: booking.eventTitle,
      startsAt: booking.startsAt,
      venue: booking.venue,
      guestName: booking.name,
      ticketCodes: booking.ticketCodes,
    });
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        // FR-PR-04: ticket documents must never sit in a shared cache.
        "Cache-Control": "private, no-store",
        "Content-Disposition": `attachment; filename="tickets-${bookingId.slice(0, 8)}.pdf"`,
      },
    });
  } catch {
    return NextResponse.json({ error: "Tickets could not be produced." }, { status: 404 });
  }
}
