"use client";

import Link from "next/link";
import { ArrowLineDown, CheckCircle, Clock, CurrencyGbp, Ticket, X, XCircle } from "@phosphor-icons/react";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import StaffShell from "../staff-shell";
import { BOOKING_STATUS_LABEL, deriveBookingStatus, formatGBP, type BookingStatus } from "@/lib/booking-status";

type BookingItem = { name: string; quantity: number; unitPricePence: number };
type BookingPayment = { provider: string; paymentIntentId: string; paidAt: string } | null;

type Booking = {
  bookingId: string;
  bookingReference: string | null;
  eventId: string;
  eventTitle: string;
  startsAt: string;
  venue: string;
  name: string;
  email: string;
  phone?: string | null;
  specialRequests?: string | null;
  sessionStartsAt?: string | null;
  totalGuests: number;
  guestsCheckedIn: number;
  ticketCode: string | null;
  status: string;
  paid: boolean;
  testPayment?: boolean;
  totalPence: number;
  createdAt: string;
  confirmationStatus: string | null;
  confirmationSentAt: string | null;
  items: BookingItem[];
  payment: BookingPayment;
};

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Date to confirm" : date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function formatDateTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function paymentStatus(booking: Booking): BookingStatus {
  return deriveBookingStatus(booking);
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return (parts[0]?.[0] || "").concat(parts[1]?.[0] || "").toUpperCase() || "--";
}

function monthLabel(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
}

function csvCell(value: string) {
  // Spreadsheets execute cells starting with these characters as formulas.
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return `"${safe.replace(/"/g, '""')}"`;
}

function BookingsPageInner() {
  const eventIdParam = useSearchParams().get("eventId");
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [eventFilter, setEventFilter] = useState(eventIdParam || "all");
  const [statusFilter, setStatusFilter] = useState<"all" | BookingStatus>("all");
  const [dateFilter, setDateFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [openBookingId, setOpenBookingId] = useState<string | null>(null);
  const [resendState, setResendState] = useState<{ tone: "success" | "error"; message: string } | null>(null);
  const [resending, setResending] = useState(false);

  const [cancelling, setCancelling] = useState(false);

  const loadBookings = useCallback(() => fetch("/api/manage/bookings", { cache: "no-store" })
    .then((response) => response.ok ? response.json() : { bookings: [] })
    .then((result) => setBookings(Array.isArray(result.bookings) ? result.bookings : []))
    .catch(() => setBookings([]))
    .finally(() => setLoading(false)), []);

  useEffect(() => {
    loadBookings();
  }, [loadBookings]);

  const events = useMemo(() => {
    const byId = new Map<string, string>();
    bookings.forEach((booking) => { if (!byId.has(booking.eventId)) byId.set(booking.eventId, booking.eventTitle); });
    return Array.from(byId.entries()).map(([id, title]) => ({ id, title })).sort((a, b) => a.title.localeCompare(b.title));
  }, [bookings]);
  const months = useMemo(() => Array.from(new Set(bookings.map((booking) => monthLabel(booking.startsAt)).filter((label): label is string => Boolean(label)))), [bookings]);

  const counts = useMemo(() => ({
    total: bookings.length,
    paid: bookings.filter((booking) => paymentStatus(booking) === "paid").length,
    pending: bookings.filter((booking) => paymentStatus(booking) === "pending_payment").length,
    cancelled: bookings.filter((booking) => paymentStatus(booking) === "cancelled").length,
    revenuePence: bookings.filter((booking) => paymentStatus(booking) === "paid").reduce((total, booking) => total + booking.totalPence, 0),
  }), [bookings]);

  const filteredBookings = useMemo(() => bookings.filter((booking) => {
    const matchesSearch = !searchTerm || `${booking.name} ${booking.email} ${booking.eventTitle} ${booking.bookingId}`.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesEvent = eventFilter === "all" || booking.eventId === eventFilter;
    const matchesStatus = statusFilter === "all" || paymentStatus(booking) === statusFilter;
    const matchesDate = dateFilter === "all" || monthLabel(booking.startsAt) === dateFilter;
    return matchesSearch && matchesEvent && matchesStatus && matchesDate;
  }), [bookings, searchTerm, eventFilter, statusFilter, dateFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredBookings.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paginatedBookings = filteredBookings.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const openBooking = bookings.find((booking) => booking.bookingId === openBookingId) || null;

  function resetFilters() {
    setSearchTerm("");
    setEventFilter("all");
    setStatusFilter("all");
    setDateFilter("all");
    setPage(1);
    setSelectedIds(new Set());
  }

  function resetListSelection() {
    setPage(1);
    setSelectedIds(new Set());
  }

  function toggleSelected(id: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleSelectAllOnPage() {
    setSelectedIds((current) => {
      const pageIds = paginatedBookings.map((booking) => booking.bookingId);
      const allSelected = pageIds.every((id) => current.has(id));
      const next = new Set(current);
      pageIds.forEach((id) => (allSelected ? next.delete(id) : next.add(id)));
      return next;
    });
  }

  function exportCsv() {
    const header = ["Booking No.", "Customer", "Email", "Phone", "Event", "Session", "Ticket types", "Guests", "Amount (GBP)", "Payment status", "Payment reference", "Checked in", "Special requests", "Booked at"];
    const rows = filteredBookings.map((booking) => [
      booking.bookingId.slice(0, 8).toUpperCase(),
      booking.name,
      booking.email,
      booking.phone || "",
      booking.eventTitle,
      formatDateTime(booking.sessionStartsAt || booking.startsAt),
      booking.items.map((item) => `${item.name} x ${item.quantity}`).join("; "),
      String(booking.totalGuests),
      (booking.totalPence / 100).toFixed(2),
      BOOKING_STATUS_LABEL[paymentStatus(booking)],
      booking.payment?.paymentIntentId || "",
      `${booking.guestsCheckedIn} / ${booking.totalGuests}`,
      booking.specialRequests || "",
      formatDateTime(booking.createdAt),
    ]);
    const csv = [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `bookings-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function cancelOpenBooking(booking: Booking) {
    const refundNote = booking.paid ? " The payment is not refunded automatically; refund it in the payment provider's dashboard." : "";
    if (window.confirm(`Cancel booking ${booking.bookingId.slice(0, 8).toUpperCase()} for ${booking.name}? Their ${booking.totalGuests} ${booking.totalGuests === 1 ? "guest" : "guests"} will stop working and the places will be released.${refundNote}`) === false) return;
    setCancelling(true);
    setResendState(null);
    try {
      const response = await fetch(`/api/manage/bookings/${booking.bookingId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "cancelled" }) });
      const result = await response.json().catch(() => ({}));
      if (response.ok === false) return setResendState({ tone: "error", message: result.error || "The booking could not be cancelled." });
      setResendState({ tone: "success", message: result.message || "Booking cancelled." });
      await loadBookings();
    } catch {
      setResendState({ tone: "error", message: "Network problem while cancelling. Please try again." });
    } finally {
      setCancelling(false);
    }
  }

  async function resendConfirmation(bookingId: string) {
    setResending(true);
    setResendState(null);
    try {
      const response = await fetch("/api/manage/notifications", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ bookingId }) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) return setResendState({ tone: "error", message: result.error || "The confirmation could not be sent." });
      setResendState({ tone: "success", message: result.message || (result.status === "queued" ? "Confirmation queued." : "Confirmation sent.") });
    } catch {
      setResendState({ tone: "error", message: "Network problem while sending. Please try again." });
    } finally {
      setResending(false);
    }
  }

  return (
    <StaffShell active="bookings" title="Bookings">
      <section className="events-page-heading">
        <div>
          <p className="eyebrow">Sales and attendance</p>
          <h1>Bookings</h1>
          <p>View and manage all event bookings. Search, filter, and export the data.</p>
        </div>
        <button className="secondary-button dark-text" type="button" onClick={exportCsv}><ArrowLineDown aria-hidden="true" size={16} /> Export CSV</button>
      </section>

      <section className="cms-content events-page-content">
        <div className="event-stat-grid booking-stat-grid">
          <article><span className="event-stat-icon blue"><Ticket aria-hidden="true" size={19} /></span><div><strong>{counts.total}</strong><small>Total bookings</small></div></article>
          <article><span className="event-stat-icon green"><CheckCircle aria-hidden="true" size={19} /></span><div><strong>{counts.paid}</strong><small>Paid</small></div></article>
          <article><span className="event-stat-icon amber"><Clock aria-hidden="true" size={19} /></span><div><strong>{counts.pending}</strong><small>Pending</small></div></article>
          <article><span className="event-stat-icon rose"><XCircle aria-hidden="true" size={19} /></span><div><strong>{counts.cancelled}</strong><small>Cancelled</small></div></article>
          <article><span className="event-stat-icon violet"><CurrencyGbp aria-hidden="true" size={19} /></span><div><strong>{formatGBP(counts.revenuePence)}</strong><small>Total revenue</small></div></article>
        </div>

        <section className="cms-card events-panel">
          <div className="event-list-toolbar booking-list-toolbar" aria-label="Booking filters">
            <label className="search-field">
              <span>Search bookings</span>
              <input type="search" value={searchTerm} onChange={(event) => { setSearchTerm(event.target.value); resetListSelection(); }} placeholder="Booking no., name, or email" />
            </label>
            <label className="filter-field">
              <span>Event</span>
              <select value={eventFilter} onChange={(event) => { setEventFilter(event.target.value); resetListSelection(); }}>
                <option value="all">All events</option>
                {events.map((event) => <option key={event.id} value={event.id}>{event.title}</option>)}
              </select>
            </label>
            <label className="filter-field">
              <span>Payment status</span>
              <select value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value as typeof statusFilter); resetListSelection(); }}>
                <option value="all">All statuses</option>
                <option value="paid">Paid</option><option value="test">Test (no payment)</option>
                <option value="pending_payment">Awaiting payment</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </label>
            <label className="filter-field">
              <span>Date</span>
              <select value={dateFilter} onChange={(event) => { setDateFilter(event.target.value); resetListSelection(); }}>
                <option value="all">All dates</option>
                {months.map((label) => <option key={label} value={label}>{label}</option>)}
              </select>
            </label>
            <button className="table-action reset-filters" type="button" onClick={resetFilters}>Reset</button>
          </div>

          {selectedIds.size > 0 && (
            <div className="event-bulk-bar" role="toolbar" aria-label="Bulk actions">
              <span>{selectedIds.size} selected</span>
              <button className="table-action" type="button" onClick={exportCsv}>Export selection</button>
              <button className="table-action" type="button" onClick={() => setSelectedIds(new Set())}>Clear</button>
            </div>
          )}

          {loading && <p className="panel-copy">Loading bookings...</p>}
          {!loading && filteredBookings.length === 0 && <div className="events-empty"><strong>No matching bookings</strong><small>Try another search term or clear one of the filters.</small></div>}
          {!loading && filteredBookings.length > 0 && (
            <div className="event-table-wrap">
              <table className="event-management-table">
                <thead><tr><th className="event-table-checkbox"><input type="checkbox" aria-label="Select all bookings on this page" checked={paginatedBookings.length > 0 && paginatedBookings.every((booking) => selectedIds.has(booking.bookingId))} onChange={toggleSelectAllOnPage} /></th><th>Booking no.</th><th>Customer</th><th>Event</th><th>Date</th><th>Guests</th><th>Amount</th><th>Payment status</th><th>Check-in</th><th>Actions</th></tr></thead>
                <tbody>
                  {paginatedBookings.map((booking) => {
                    const status = paymentStatus(booking);
                    return (
                      <tr key={booking.bookingId}>
                        <td className="event-table-checkbox"><input type="checkbox" aria-label={`Select booking ${booking.bookingId}`} checked={selectedIds.has(booking.bookingId)} onChange={() => toggleSelected(booking.bookingId)} /></td>
                        <td><strong>{booking.bookingId.slice(0, 8).toUpperCase()}</strong></td>
                        <td><strong>{booking.name}</strong><small>{booking.email}</small></td>
                        <td>{booking.eventTitle}</td>
                        <td>{formatDate(booking.startsAt)}</td>
                        <td>{booking.totalGuests}</td>
                        <td>{formatGBP(booking.totalPence)}</td>
                        <td><span className={`event-status-pill ${status === "paid" ? "published" : status === "pending_payment" || status === "test" ? "draft" : "cancelled"}`}><i />{BOOKING_STATUS_LABEL[status]}</span></td>
                        <td>{booking.guestsCheckedIn} / {booking.totalGuests}</td>
                        <td><div className="event-table-actions"><button className="table-action" type="button" onClick={() => { setOpenBookingId(booking.bookingId); setResendState(null); }}>View</button></div></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div className="event-table-pagination">
                <p>Showing {filteredBookings.length === 0 ? 0 : (currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, filteredBookings.length)} of {filteredBookings.length} bookings</p>
                <div className="event-table-pages">
                  <button type="button" disabled={currentPage <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))} aria-label="Previous page">&lsaquo;</button>
                  {Array.from({ length: totalPages }, (_, index) => index + 1).map((pageNumber) => (
                    <button key={pageNumber} type="button" className={pageNumber === currentPage ? "active" : ""} onClick={() => setPage(pageNumber)}>{pageNumber}</button>
                  ))}
                  <button type="button" disabled={currentPage >= totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))} aria-label="Next page">&rsaquo;</button>
                </div>
                <label className="page-size-field">
                  <select value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); resetListSelection(); }}>
                    <option value={10}>10 per page</option>
                    <option value={25}>25 per page</option>
                    <option value={50}>50 per page</option>
                  </select>
                </label>
              </div>
            </div>
          )}
        </section>
      </section>

      {openBooking && (
        <div className="booking-drawer-overlay" role="presentation" onClick={() => setOpenBookingId(null)}>
          <aside className="booking-drawer" role="dialog" aria-modal="true" aria-label="Booking details" onClick={(event) => event.stopPropagation()}>
            <div className="booking-drawer-heading">
              <h3>Booking details</h3>
              <button type="button" aria-label="Close details" onClick={() => setOpenBookingId(null)}><X aria-hidden="true" size={18} /></button>
            </div>
            <div className="booking-drawer-body">
              <div className="booking-drawer-title-row">
                <h2>{openBooking.bookingId.slice(0, 8).toUpperCase()}</h2>
                <span className={`event-status-pill ${paymentStatus(openBooking) === "paid" ? "published" : paymentStatus(openBooking) === "pending_payment" || paymentStatus(openBooking) === "test" ? "draft" : "cancelled"}`}><i />{BOOKING_STATUS_LABEL[paymentStatus(openBooking)]}</span>
              </div>
              <p className="panel-copy">Booked on {formatDateTime(openBooking.createdAt)}</p>

              <h3 className="booking-drawer-section">Customer</h3>
              <div className="booking-customer-row">
                <span className="booking-avatar">{initials(openBooking.name)}</span>
                <span><strong>{openBooking.name}</strong><small>{openBooking.email}</small>{openBooking.phone && <small>{openBooking.phone}</small>}</span>
              </div>
              {openBooking.specialRequests && <p className="panel-copy"><strong>Special requests:</strong> {openBooking.specialRequests}</p>}

              <h3 className="booking-drawer-section">Event</h3>
              <p className="booking-event-summary"><strong>{openBooking.eventTitle}</strong><small>Session: {formatDateTime(openBooking.sessionStartsAt || openBooking.startsAt)} &middot; {openBooking.venue}</small></p>

              <h3 className="booking-drawer-section">Guests</h3>
              {openBooking.items.length > 0 ? (
                <ul className="booking-ticket-list">
                  {openBooking.items.map((item, index) => <li key={`${item.name}-${index}`}><span>{item.name} &times; {item.quantity} @ {formatGBP(item.unitPricePence)}</span><span>{formatGBP(item.unitPricePence * item.quantity)}</span></li>)}
                  <li className="booking-ticket-total"><span>Total amount</span><span>{formatGBP(openBooking.totalPence)}</span></li>
                </ul>
              ) : <p className="panel-copy">Guest breakdown is not available for this booking.</p>}
              {openBooking.ticketCode && <p className="panel-copy"><strong>QR ticket code:</strong> {openBooking.ticketCode}{openBooking.bookingReference ? ` \u00b7 Booking ${openBooking.bookingReference}` : ""}</p>}

              <h3 className="booking-drawer-section">Payment</h3>
              <dl className="booking-payment-facts">
                <div><dt>Status</dt><dd>{BOOKING_STATUS_LABEL[paymentStatus(openBooking)]}</dd></div>
                {openBooking.payment && <div><dt>Provider</dt><dd>{openBooking.payment.provider}</dd></div>}
                {openBooking.payment && <div><dt>Reference</dt><dd>{openBooking.payment.paymentIntentId}</dd></div>}
                {["paid", "refunded", "partially_refunded"].includes(paymentStatus(openBooking)) && openBooking.payment && <div><dt>Paid on</dt><dd>{formatDateTime(openBooking.payment.paidAt)}</dd></div>}
              </dl>

              <h3 className="booking-drawer-section">Check-in</h3>
              <p className="booking-checkin-row"><strong>{openBooking.guestsCheckedIn} / {openBooking.totalGuests}</strong> guests checked in <Link href="/manage/check-in">Open check-in</Link></p>

              <h3 className="booking-drawer-section">Confirmation email</h3>
              <p className="panel-copy">{openBooking.confirmationSentAt ? `Last sent ${formatDateTime(openBooking.confirmationSentAt)}` : openBooking.confirmationStatus === "failed" ? "Last attempt failed to send." : "Not sent yet."}</p>
              {resendState && <p className={resendState.tone === "success" ? "form-success" : "form-error"}>{resendState.message}</p>}
              <button className="primary-button" type="button" disabled={resending} onClick={() => resendConfirmation(openBooking.bookingId)}>{resending ? "Sending..." : "Resend confirmation"}</button>
              {openBooking.status !== "cancelled" && <>
                <h3 className="booking-drawer-section">Cancel booking</h3>
                <p className="panel-copy">{openBooking.guestsCheckedIn > 0 ? "A guest has already been checked in, so this booking can't be cancelled." : "Cancelling voids the ticket and releases the places."}</p>
                <button className="secondary-button danger-button" type="button" disabled={cancelling || openBooking.guestsCheckedIn > 0} onClick={() => cancelOpenBooking(openBooking)}>{cancelling ? "Cancelling..." : "Cancel booking"}</button>
              </>}
            </div>
          </aside>
        </div>
      )}
    </StaffShell>
  );
}

export default function BookingsPage() {
  return (
    <Suspense fallback={<StaffShell active="bookings" title="Bookings"><section className="cms-content"><p className="panel-copy">Loading bookings...</p></section></StaffShell>}>
      <BookingsPageInner />
    </Suspense>
  );
}
