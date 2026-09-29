import Link from "next/link";
import { databaseEnabled, getBookingForEmail, getBookingTicketStates } from "@/lib/db";
import { getStoreBookingForEmail, getStoreBookingTicketStates } from "@/lib/store";
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

  const states = databaseEnabled ? await getBookingTicketStates(bookingId) : getStoreBookingTicketStates(bookingId);
  const stateFor = (code: string) => states.find((item) => item.ticketCode === code);
  const usedCount = states.filter((item) => item.status === "checked_in" || item.checkedInAt).length;

  return (
    <main className="page-shell">
      <section className="content-section ticket-page">
        <p className="eyebrow">Hilston Park</p>
        <h1>Your tickets</h1>
        <p className="lead-copy">Hello {booking.name}, here are your tickets for <strong>{booking.eventTitle}</strong>. Show each QR code at the entrance. Every ticket admits one person and can be scanned once.</p>

        <dl className="booking-facts">
          <div><dt>Event</dt><dd>{booking.eventTitle}</dd></div>
          <div><dt>When</dt><dd>{formatWhen(booking.startsAt)}</dd></div>
          <div><dt>Where</dt><dd>{booking.venue}</dd></div>
          <div><dt>Tickets</dt><dd>{booking.ticketCodes.length}{usedCount > 0 ? ` (${usedCount} already used)` : ""}</dd></div>
        </dl>

        <div className="booking-tickets">
          <ul>
            {booking.ticketCodes.map((code) => {
              const state = stateFor(code);
              const used = state?.status === "checked_in" || Boolean(state?.checkedInAt);
              return (
                <li key={code} className={used ? "ticket-used" : undefined}>
                  <img src={`/api/public/tickets/${encodeURIComponent(code)}/qr`} alt={`QR code for ticket ${code}`} width={200} height={200} />
                  <strong>{code}</strong>
                  {used
                    ? <small className="ticket-state-used">Already used{state?.checkedInAt ? ` \u00b7 ${formatWhen(state.checkedInAt)}` : ""}</small>
                    : <small className="ticket-state-valid">Valid &middot; admits one</small>}
                </li>
              );
            })}
          </ul>
        </div>

        <p className="form-note">Each QR code can only be scanned once. Copying or forwarding a ticket does not create a second entry.</p>
        <p className="ticket-download"><a className="primary-button" href={`/tickets/${token}/pdf`}>Download tickets (PDF)</a></p>
      </section>
      <footer className="footer">
        <Link href="https://hilstonpark.com">Hilston Park</Link>
      </footer>
    </main>
  );
}
