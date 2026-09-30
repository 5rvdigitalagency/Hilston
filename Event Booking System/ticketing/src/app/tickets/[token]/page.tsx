import Link from "next/link";
import { databaseEnabled, getBookingForEmail, getBookingTicketState } from "@/lib/db";
import { getStoreBookingForEmail, getStoreBookingTicketState } from "@/lib/store";
import { readTicketLinkToken } from "@/lib/ticket-links";

export const dynamic = "force-dynamic";

function formatWhen(value: string) {
  return new Date(value).toLocaleString("en-GB", { dateStyle: "full", timeStyle: "short", timeZone: "Europe/London" });
}

export default async function TicketsPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const bookingId = await readTicketLinkToken(token);

  if (!bookingId) {
    return (
      <main className="page-shell">
        <section className="content-section auth-layout">
          <p className="eyebrow">Hilston Park</p>
          <h1>This ticket link is not valid.</h1>
          <p className="lead-copy">The link may have been mistyped or has expired. Please use the most recent confirmation email, or contact Hilston Park and we will resend your tickets.</p>
        </section>
      </main>
    );
  }

  let booking;
  try {
    booking = databaseEnabled ? await getBookingForEmail(bookingId) : getStoreBookingForEmail(bookingId);
  } catch {
    return (
      <main className="page-shell">
        <section className="content-section auth-layout">
          <p className="eyebrow">Hilston Park</p>
          <h1>We could not find this booking.</h1>
          <p className="lead-copy">Please contact Hilston Park and we will resend your tickets.</p>
        </section>
      </main>
    );
  }

  const state = databaseEnabled ? await getBookingTicketState(bookingId) : getStoreBookingTicketState(bookingId);
  const totalGuests = state?.totalGuests ?? booking.totalGuests;
  const checkedInCount = state?.checkedInCount ?? 0;
  const used = checkedInCount > 0;
  const code = booking.ticketCode;

  return (
    <main className="page-shell">
      <section className="content-section ticket-page">
        <p className="eyebrow">Hilston Park</p>
        <h1>Your ticket</h1>
        <p className="lead-copy">Hello {booking.name}, here is your ticket for <strong>{booking.eventTitle}</strong>. Show this QR code at the entrance &mdash; it covers your whole booking.</p>

        <dl className="booking-facts">
          <div><dt>Event</dt><dd>{booking.eventTitle}</dd></div>
          <div><dt>When</dt><dd>{formatWhen(booking.startsAt)}</dd></div>
          <div><dt>Where</dt><dd>{booking.venue}</dd></div>
          <div><dt>Booking</dt><dd>1 Booking &middot; {totalGuests} guest{totalGuests === 1 ? "" : "s"} &middot; 1 QR ticket{used ? ` (${checkedInCount} of ${totalGuests} checked in)` : ""}</dd></div>
        </dl>

        {code && (
          <div className="booking-tickets">
            <ul>
              <li className={checkedInCount >= totalGuests ? "ticket-used" : undefined}>
                <img src={`/api/public/tickets/${encodeURIComponent(code)}/qr`} alt={`QR code for ticket ${code}`} width={200} height={200} />
                <strong>{code}</strong>
                {booking.bookingReference && <small>Booking {booking.bookingReference}</small>}
                {checkedInCount >= totalGuests
                  ? <small className="ticket-state-used">Fully checked in</small>
                  : used
                    ? <small className="ticket-state-valid">Valid &middot; {totalGuests - checkedInCount} guest{totalGuests - checkedInCount === 1 ? "" : "s"} remaining</small>
                    : <small className="ticket-state-valid">Valid &middot; admits {totalGuests} guest{totalGuests === 1 ? "" : "s"}</small>}
              </li>
            </ul>
          </div>
        )}

        <p className="form-note">This QR code covers your entire booking. Copying or forwarding it does not create extra entries.</p>
        <p className="ticket-download"><a className="primary-button" href={`/tickets/${token}/pdf`}>View / download ticket (PDF)</a></p>
      </section>
      <footer className="footer">
        <Link href="https://hilstonpark.com">Hilston Park</Link>
      </footer>
    </main>
  );
}
