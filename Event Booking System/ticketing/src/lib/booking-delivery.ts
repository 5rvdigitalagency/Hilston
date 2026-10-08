import { getBookingForEmail, markDispatchByKey, orgSettings } from "@/lib/db";
import { appBaseUrl, emailEnabled, sendBookingConfirmation, sendStaffBookingAlert } from "@/lib/email";
import { buildTicketPdf } from "@/lib/ticket-pdf";
import { createTicketLinkToken } from "@/lib/ticket-links";

export async function deliverBookingEmails(bookingId: string, staffEmail?: string, token?: string) {
  const details = await getBookingForEmail(bookingId);
  const ticketCode = details.ticketCode;
  if (!ticketCode) throw new Error("ticket_not_issued");
  const ticketToken = token || await createTicketLinkToken(bookingId);
  const ticketUrl = `${appBaseUrl()}/tickets/${ticketToken}`;
  const pdf = await buildTicketPdf({ org: await orgSettings(), eventTitle: details.eventTitle, startsAt: details.startsAt, venue: details.venue, guestName: details.name, ticketCode, totalGuests: details.totalGuests, bookingReference: details.bookingReference || undefined }).catch(() => undefined);

  try {
    const sent = await sendBookingConfirmation({ name: details.name, email: details.email, eventTitle: details.eventTitle, startsAt: details.startsAt, venue: details.venue, ticketCode, totalGuests: details.totalGuests, bookingReference: details.bookingReference || undefined, ticketUrl, pdf });
    await markDispatchByKey(`booking:${bookingId}:guest`, { status: "sent", providerRef: sent.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Email delivery failed";
    console.error("booking confirmation email failed", message);
    await markDispatchByKey(`booking:${bookingId}:guest`, { status: "failed", error: message }).catch(() => undefined);
    return { emailed: false as const, ticketUrl };
  }

  if (staffEmail) {
    try {
      const alert = await sendStaffBookingAlert({ to: staffEmail, name: details.name, email: details.email, eventTitle: details.eventTitle, totalGuests: details.totalGuests });
      await markDispatchByKey(`booking:${bookingId}:staff`, { status: "sent", providerRef: alert.id });
    } catch (error) {
      await markDispatchByKey(`booking:${bookingId}:staff`, { status: "failed", error: error instanceof Error ? error.message : "failed" }).catch(() => undefined);
    }
  }
  return { emailed: true as const, ticketUrl };
}

export { emailEnabled };