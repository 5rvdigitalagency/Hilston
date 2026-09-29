import Link from "next/link";
import { databaseEnabled, getBookingForEmail } from "@/lib/db";
import { getStoreBookingForEmail } from "@/lib/store";
import { readTicketLinkToken } from "@/lib/ticket-links";

export const dynamic = "force-dynamic";

function formatWhen(value: string) {
  return new Date(value).toLocaleString("en-GB", { dateStyle: "full", timeStyle: "short", timeZone: "Europe/London" });
}

export default async function BookingConfirmationPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const bookingId = await readTicketLinkToken(token);
  const booking = bookingId
    ? await (databaseEnabled ? getBookingForEmail(bookingId) : Promise.resolve(getStoreBookingForEmail(bookingId))).catch(() => null)
    : null;

  if (!booking) {
    return <main className="page-shell"><section className="content-section auth-layout">
      <p className="eyebrow">Hilston Park</p>
      <h1>We could not find this booking.</h1>
      <p className="lead-copy">Please return to the events page or contact Hilston Park for help.</p>
      <Link className="primary-button" href="/events">View events</Link>
    </section></main>;
  }

  return <main className="page-shell">
    <section className="content-section confirmation-layout">
      <div className="confirmation-copy">
        <span className="success-mark" aria-hidden="true">✓</span>
        <p className="eyebrow">Test booking confirmed</p>
        <h1>You’re on the list, {booking.name}.</h1>
        <p className="lead-copy">Your booking for <strong>{booking.eventTitle}</strong> is confirmed in the staging preview. No real payment was taken.</p>
        <dl className="booking-facts">
          <div><dt>When</dt><dd>{formatWhen(booking.startsAt)}</dd></div>
          <div><dt>Where</dt><dd>{booking.venue}</dd></div>
          <div><dt>Tickets</dt><dd>{booking.ticketCodes.length}</dd></div>
        </dl>
        <div className="confirmation-actions">
          <Link className="primary-button" href={`/tickets/${token}`}>View tickets</Link>
          <Link className="secondary-link" href="/events">Back to events</Link>
        </div>
      </div>
      <aside className="confirmation-card">
        <p className="eyebrow">Booking reference</p>
        <h2>{booking.bookingId.slice(0, 8).toUpperCase()}</h2>
        <p>A ticket link is ready for this preview booking. Confirmation email delivery depends on the staging email configuration.</p>
        <p>{booking.email}</p>
      </aside>
    </section>
    <footer className="footer"><span>Hilston Park ticketing preview</span><span>No real payment taken</span></footer>
  </main>;
}