"use client";

import Link from "next/link";
import { ArrowRight, CalendarDots, ChartBar, CheckCircle, ClipboardText, Clock, Plus, Pulse, QrCode, Ticket, UsersThree, WarningCircle } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import StaffShell from "./staff-shell";
import { BOOKING_STATUS_LABEL, deriveBookingStatus, formatGBP } from "@/lib/booking-status";

type DashboardReport = {
  sales: { bookings: number; current_revenue_pence: number; projected_revenue_pence: number };
  publishedEvents: number;
  activity: { action: string; createdAt: string }[];
};
type DashboardEvent = { id: string; title: string; startsAt: string; venue: string; capacity: number; attendeeCount?: number; childCount?: number; status?: string; published: boolean; archived?: boolean; createdAt: string };
type DashboardBooking = { bookingId: string; eventId: string; eventTitle: string; startsAt: string; createdAt: string; name: string; status: string; paid: boolean; totalPence: number; totalGuests: number };
type Period = "month" | "30d" | "all";

const shortDate = (value: string) => new Date(value).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
const monthKey = (value: Date) => `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}`;
const inRange = (value: string, start: Date, end: Date) => { const time = new Date(value).getTime(); return time >= start.getTime() && time <= end.getTime(); };

/** Turns the selected reporting window into a current + prior range pair so metric deltas compare like-for-like periods. */
function periodBounds(period: Period) {
  const now = new Date();
  if (period === "month") {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const prevEnd = new Date(start.getTime() - 1);
    const prevStart = new Date(prevEnd.getFullYear(), prevEnd.getMonth(), 1);
    return { start, end: now, prevStart, prevEnd, label: start.toLocaleDateString("en-GB", { month: "long", year: "numeric" }), comparisonLabel: "vs last month" };
  }
  if (period === "30d") {
    const start = new Date(now.getTime() - 30 * 86400000);
    const prevEnd = new Date(start.getTime() - 1);
    const prevStart = new Date(prevEnd.getTime() - 30 * 86400000);
    return { start, end: now, prevStart, prevEnd, label: "Last 30 days", comparisonLabel: "vs previous 30 days" };
  }
  return { start: new Date(0), end: now, prevStart: null as Date | null, prevEnd: null as Date | null, label: "All time", comparisonLabel: "" };
}

/** Computes a real vs-previous-period delta, or null when there isn't enough history to compare honestly. */
function computeDelta(current: number, previous: number | null) {
  if (previous === null) return null;
  if (previous === 0) return current > 0 ? { isNew: true as const } : null;
  return { isNew: false as const, percent: Math.round((current - previous) / previous * 100) };
}

export default function ManagePage() {
  const [report, setReport] = useState<DashboardReport | null>(null);
  const [events, setEvents] = useState<DashboardEvent[]>([]);
  const [bookings, setBookings] = useState<DashboardBooking[]>([]);
  const [message, setMessage] = useState("");
  const [period, setPeriod] = useState<Period>("month");
  const [identityEmail, setIdentityEmail] = useState("");
  const [health, setHealth] = useState<{ ok: boolean; databaseConnected: boolean; checkedAt: string } | null>(null);
  const [healthError, setHealthError] = useState(false);
  const [eventsError, setEventsError] = useState(false);
  const [bookingsError, setBookingsError] = useState(false);
  const [currentTime] = useState(() => Date.now());

  function loadDashboard() {
    fetch("/api/manage/operations", { cache: "no-store" }).then(async (response) => {
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Dashboard data is unavailable.");
      setReport(data);
    }).catch((error) => setMessage(error instanceof Error ? error.message : "Dashboard data is unavailable."));
    fetch("/api/events", { cache: "no-store" }).then((response) => { if (!response.ok) throw new Error(); return response.json(); }).then((data) => setEvents(Array.isArray(data.events) ? data.events : [])).catch(() => setEventsError(true));
    fetch("/api/manage/bookings", { cache: "no-store" }).then((response) => { if (!response.ok) throw new Error(); return response.json(); }).then((data) => setBookings(Array.isArray(data.bookings) ? data.bookings : [])).catch(() => setBookingsError(true));
  }

  function retryDashboard() {
    setMessage("");
    setEventsError(false);
    setBookingsError(false);
    loadDashboard();
  }

  useEffect(() => {
    loadDashboard();
    fetch("/api/auth/session", { cache: "no-store" }).then((response) => response.ok ? response.json() : null).then((data) => { if (data?.email) setIdentityEmail(data.email); }).catch(() => {});
    fetch("/api/health", { cache: "no-store" }).then((response) => response.ok ? response.json() : Promise.reject()).then((data) => setHealth({ ok: Boolean(data.ok), databaseConnected: Boolean(data.integrations?.database), checkedAt: new Date().toISOString() })).catch(() => setHealthError(true));
  }, []);

  const dataDegraded = eventsError || bookingsError;
  const systemUnhealthy = healthError || (health !== null && !(health.ok && health.databaseConnected));

  const upcomingEvents = events.filter((event) => !event.archived && new Date(event.startsAt).getTime() >= currentTime).sort((a, b) => a.startsAt.localeCompare(b.startsAt)).slice(0, 5);
  const draftEvents = events.filter((event) => !event.published && !event.archived);
  const pendingBookings = bookings.filter((booking) => deriveBookingStatus(booking) === "pending_payment");
  const attentionCount = draftEvents.length + pendingBookings.length;
  const paidBookings = bookings.filter((booking) => deriveBookingStatus(booking) === "paid");
  const bookingStatuses = [
    { label: BOOKING_STATUS_LABEL.paid, color: "#0a9872", count: paidBookings.length },
    { label: BOOKING_STATUS_LABEL.pending_payment, color: "#f2b52b", count: pendingBookings.length },
    { label: BOOKING_STATUS_LABEL.cancelled, color: "#ed5a56", count: bookings.filter((booking) => deriveBookingStatus(booking) === "cancelled").length },
    { label: BOOKING_STATUS_LABEL.test, color: "#8293a4", count: bookings.filter((booking) => deriveBookingStatus(booking) === "test").length },
  ];
  const bookingStatusTotal = bookingStatuses.reduce((total, status) => total + status.count, 0);
  let donutOffset = 0;
  const donutStops = bookingStatuses.map((status) => {
    const start = donutOffset;
    donutOffset += bookingStatusTotal ? status.count / bookingStatusTotal * 100 : 0;
    return `${status.color} ${start}% ${donutOffset}%`;
  }).join(", ");
  const chartMonths = Array.from({ length: 6 }, (_, index) => {
    const date = new Date();
    date.setDate(1);
    date.setMonth(date.getMonth() - (5 - index));
    return { key: monthKey(date), label: date.toLocaleDateString("en-GB", { month: "short", year: "2-digit" }) };
  });
  const eventTrend = chartMonths.map((month) => events.reduce((counts, event) => {
    if (monthKey(new Date(event.startsAt)) !== month.key) return counts;
    const state = event.status ?? (event.archived ? "archived" : event.published ? "published" : "draft");
    if (state === "published") counts.published += 1;
    else if (state === "archived") counts.archived += 1;
    else counts.draft += 1;
    return counts;
  }, { published: 0, draft: 0, archived: 0 }));
  const bookingTrend = chartMonths.map((month) => bookings.reduce((totals, booking) => {
    if (monthKey(new Date(booking.createdAt)) === month.key) {
      totals.bookings += 1;
      if (deriveBookingStatus(booking) === "paid") totals.revenue += booking.totalPence;
    }
    return totals;
  }, { bookings: 0, revenue: 0 }));
  const maxEventCount = Math.max(1, ...eventTrend.map((month) => month.published + month.draft + month.archived));
  const maxBookingCount = Math.max(1, ...bookingTrend.map((month) => month.bookings));
  const realMaxRevenue = Math.max(...bookingTrend.map((month) => month.revenue));
  const maxRevenue = Math.max(1, realMaxRevenue);
  const eventYTicks = maxEventCount <= 1 ? [1, 0] : [maxEventCount, Math.round(maxEventCount / 2), 0].filter((value, index, all) => all.indexOf(value) === index);
  const revenuePoints = bookingTrend.map((month, index) => `${36 + index * 69},${132 - month.revenue / maxRevenue * 92}`).join(" ");
  const recentBookings = [...bookings].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5);

  const bounds = periodBounds(period);
  const periodEvents = events.filter((event) => inRange(event.createdAt, bounds.start, bounds.end));
  const prevPeriodEvents = bounds.prevStart && bounds.prevEnd ? events.filter((event) => inRange(event.createdAt, bounds.prevStart!, bounds.prevEnd!)) : [];
  const periodBookings = bookings.filter((booking) => inRange(booking.createdAt, bounds.start, bounds.end));
  const prevPeriodBookings = bounds.prevStart && bounds.prevEnd ? bookings.filter((booking) => inRange(booking.createdAt, bounds.prevStart!, bounds.prevEnd!)) : [];
  const periodPaidBookings = periodBookings.filter((booking) => deriveBookingStatus(booking) === "paid");
  const prevPeriodPaidBookings = prevPeriodBookings.filter((booking) => deriveBookingStatus(booking) === "paid");

  const periodTotalEvents = periodEvents.length;
  const periodTicketsSold = periodPaidBookings.reduce((total, booking) => total + booking.totalGuests, 0);
  const periodTotalBookings = periodBookings.length;
  const periodRevenue = periodPaidBookings.reduce((total, booking) => total + booking.totalPence, 0);
  const prevTicketsSold = prevPeriodPaidBookings.reduce((total, booking) => total + booking.totalGuests, 0);
  const prevRevenue = prevPeriodPaidBookings.reduce((total, booking) => total + booking.totalPence, 0);

  const metricDeltas = {
    events: computeDelta(periodTotalEvents, bounds.prevStart ? prevPeriodEvents.length : null),
    tickets: computeDelta(periodTicketsSold, bounds.prevStart ? prevTicketsSold : null),
    bookings: computeDelta(periodTotalBookings, bounds.prevStart ? prevPeriodBookings.length : null),
    revenue: computeDelta(periodRevenue, bounds.prevStart ? prevRevenue : null),
  };

  function renderDelta(delta: ReturnType<typeof computeDelta>) {
    if (!delta) return null;
    if (delta.isNew) return <div className="metric-change"><b>New</b> {bounds.comparisonLabel}</div>;
    return <div className="metric-change"><b>{delta.percent >= 0 ? "↑" : "↓"} {Math.abs(delta.percent)}%</b> {bounds.comparisonLabel}</div>;
  }

  const identityName = identityEmail ? identityEmail.split("@")[0].replace(/[._-]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()) : "";

  const systemStatusPanel = (
    <section className="dashboard-panel dashboard-system-panel" aria-labelledby="system-status-title">
      <div className="dashboard-section-heading"><h3 id="system-status-title">System status</h3></div>
      {healthError ? <p className="system-status-row is-down"><span className="system-status-halo"><Pulse aria-hidden="true" size={16} /></span><span><strong>Status check failed</strong><small>Could not reach the health endpoint.</small></span></p>
        : !health ? <p className="system-status-row"><span className="system-status-halo"><Pulse aria-hidden="true" size={16} /></span><span><strong>Checking systems…</strong></span></p>
        : <p className={health.ok && health.databaseConnected ? "system-status-row is-up" : "system-status-row is-warn"}><span className="system-status-halo"><Pulse aria-hidden="true" size={16} /></span><span><strong>{health.ok && health.databaseConnected ? "All systems operational" : "Database connection needs attention"}</strong><small>Last checked: {new Date(health.checkedAt).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</small></span></p>}
    </section>
  );

  return <StaffShell active="overview" title="Overview">
    <section className="dashboard-page">
      <header className="dashboard-heading">
        <div><p className="eyebrow">Operations overview</p><h2>Welcome back{identityName ? `, ${identityName}` : ""}</h2><p>Here’s what’s happening with your events today.</p></div>
        <label className="dashboard-date-range"><CalendarDots aria-hidden="true" size={16} /><select value={period} onChange={(event) => setPeriod(event.target.value as Period)} aria-label="Reporting period">
          <option value="month">This month ({bounds.label})</option>
          <option value="30d">Last 30 days</option>
          <option value="all">All time</option>
        </select></label>
        <Link className="primary-button dashboard-create" href="/manage/cms#event-editor"><Plus aria-hidden="true" size={17} /> Create event</Link>
      </header>
      <div className="dashboard-priority-heading"><div><span className={dataDegraded ? "priority-indicator is-error" : "priority-indicator"} /><span>Needs attention right now</span></div><span>{dataDegraded ? "Could not verify" : attentionCount ? `${attentionCount} items` : "Nothing outstanding"}</span></div>
      {message && <p className="form-error dashboard-error" role="alert">{message}</p>}
      {dataDegraded && <p className="form-error dashboard-error" role="alert">Some dashboard data could not be loaded. Figures below may be incomplete. <button type="button" className="link-button" onClick={retryDashboard}>Retry</button></p>}
      {!report && !message && <p className="dashboard-loading" role="status">Loading your operations...</p>}
      {report && <>
        {systemUnhealthy && systemStatusPanel}
        <div className="dashboard-metrics">
          <article><span className="metric-icon blue"><CalendarDots aria-hidden="true" size={21} /></span><div><strong>{eventsError ? "—" : periodTotalEvents}</strong><small>Total events</small>{!eventsError && renderDelta(metricDeltas.events)}</div></article>
          <article><span className="metric-icon green"><Ticket aria-hidden="true" size={21} /></span><div><strong>{bookingsError ? "—" : periodTicketsSold.toLocaleString("en-GB")}</strong><small>Tickets sold</small>{!bookingsError && renderDelta(metricDeltas.tickets)}</div></article>
          <article><span className="metric-icon violet"><UsersThree aria-hidden="true" size={21} /></span><div><strong>{bookingsError ? "—" : periodTotalBookings.toLocaleString("en-GB")}</strong><small>Total bookings</small>{!bookingsError && renderDelta(metricDeltas.bookings)}</div></article>
          <article><span className="metric-icon amber"><span aria-hidden="true">£</span></span><div><strong>{bookingsError ? "—" : formatGBP(periodRevenue)}</strong><small>Total revenue</small>{!bookingsError && renderDelta(metricDeltas.revenue)}</div></article>
        </div>

        <section className="attention-panel" id="attention" aria-labelledby="attention-title">
          <div className="dashboard-section-heading"><div><p className="eyebrow">Priority queue</p><h3 id="attention-title">Needs attention <span>{dataDegraded ? "—" : attentionCount}</span></h3></div><span className={dataDegraded ? "attention-state is-error" : attentionCount ? "attention-state is-pending" : "attention-state"}>{dataDegraded ? "Could not load" : attentionCount ? "Action required" : "All clear"}</span></div>
          {dataDegraded ? <div className="attention-empty is-error"><WarningCircle aria-hidden="true" size={22} /><div><strong>Could not load draft events or pending bookings</strong><p>This is not confirmed to be clear — retry to check again.</p></div><button type="button" className="table-action" onClick={retryDashboard}>Retry</button></div> : attentionCount === 0 ? <div className="attention-empty"><CheckCircle aria-hidden="true" size={22} /><div><strong>You’re all caught up</strong><p>No draft events or unpaid bookings need a follow-up.</p></div></div> : <div className="attention-list">
            {draftEvents.slice(0, 3).map((event) => <Link href={`/manage/events/${event.id}`} className="attention-row" key={`draft-${event.id}`}><span className="attention-icon draft"><WarningCircle aria-hidden="true" size={18} /></span><span><strong>{event.title}</strong><small>Draft event · {shortDate(event.startsAt)}</small></span><span className="attention-link">Review <ArrowRight aria-hidden="true" size={15} /></span></Link>)}
            {pendingBookings.slice(0, 3).map((booking) => <Link href="/manage/bookings" className="attention-row" key={`booking-${booking.bookingId}`}><span className="attention-icon pending"><Clock aria-hidden="true" size={18} /></span><span><strong>{booking.name} · {formatGBP(booking.totalPence)}</strong><small>{BOOKING_STATUS_LABEL.pending_payment} · {booking.eventTitle}</small></span><span className="attention-link">Review <ArrowRight aria-hidden="true" size={15} /></span></Link>)}
          </div>}
        </section>

        <div className="dashboard-chart-grid">
          <section className="dashboard-panel dashboard-chart-panel" aria-labelledby="event-chart-title">
            <div className="dashboard-section-heading"><h3 id="event-chart-title">Event overview</h3><span className="chart-period">Last 6 months</span></div>
            <div className="chart-legend"><span><i className="legend-published" /> Published</span><span><i className="legend-draft" /> Drafts</span><span><i className="legend-archived" /> Archived</span></div>
            <div className="event-chart" role="img" aria-label="Event counts by status for the last six months">
              <div className="chart-y-labels">{eventYTicks.map((tick) => <span key={tick}>{tick}</span>)}</div>
              <div className="chart-columns">{eventTrend.map((month, index) => <div className="chart-month-column" key={chartMonths[index].key}><div className="stacked-bar" title={`${month.published} published, ${month.draft} drafts, ${month.archived} archived`}><i className="bar-published" style={{ height: `${month.published / maxEventCount * 100}%` }} /><i className="bar-draft" style={{ height: `${month.draft / maxEventCount * 100}%` }} /><i className="bar-archived" style={{ height: `${month.archived / maxEventCount * 100}%` }} /></div><small>{chartMonths[index].label}</small></div>)}</div>
            </div>
          </section>
          <section className="dashboard-panel dashboard-chart-panel" aria-labelledby="revenue-chart-title">
            <div className="dashboard-section-heading"><h3 id="revenue-chart-title">Bookings &amp; revenue</h3><span className="chart-period">Last 6 months</span></div>
            <div className="chart-legend"><span><i className="legend-revenue" /> Revenue</span><span><i className="legend-bookings" /> Bookings</span></div>
            {realMaxRevenue === 0 ? <p className="dashboard-empty-copy">No revenue yet — this chart will fill in once bookings are paid.</p> : <div className="revenue-chart" role="img" aria-label="Monthly bookings and revenue from booking records">
              <div className="chart-y-labels"><span>{formatGBP(maxRevenue)}</span><span>{formatGBP(Math.round(maxRevenue / 2))}</span><span>{formatGBP(0)}</span></div>
              <div className="revenue-chart-body"><div className="revenue-grid-lines"><i /><i /><i /></div><svg viewBox="0 0 420 150" preserveAspectRatio="none" aria-hidden="true"><polyline points={revenuePoints} /></svg><div className="revenue-bars">{bookingTrend.map((month, index) => <div className="revenue-month-column" key={chartMonths[index].key}><i style={{ height: `${month.bookings / maxBookingCount * 68}%` }} /><small>{chartMonths[index].label}</small></div>)}</div></div>
            </div>}
          </section>
          <section className="dashboard-panel dashboard-status-panel" aria-labelledby="status-chart-title">
            <div className="dashboard-section-heading"><h3 id="status-chart-title">Booking status</h3><Link href="/manage/bookings">View all <ArrowRight aria-hidden="true" size={14} /></Link></div>
            <div className="booking-status-chart"><div className="status-donut" style={{ background: bookingStatusTotal ? `conic-gradient(${donutStops})` : "#e8edef" }}><div><strong>{bookings.length}</strong><small>Bookings</small></div></div><div className="status-legend">{bookingStatuses.map((status) => <div key={status.label}><i style={{ background: status.color }} /><span>{status.label}</span><strong>{status.count}</strong></div>)}</div></div>
          </section>
        </div>

        <div className="dashboard-lower-grid">
          <section className="dashboard-panel" aria-labelledby="upcoming-title">
            <div className="dashboard-section-heading"><h3 id="upcoming-title">Upcoming events</h3><Link href="/manage/cms">View all <ArrowRight aria-hidden="true" size={15} /></Link></div>
            {upcomingEvents.length ? <div className="dashboard-event-list">{upcomingEvents.map((event) => <Link className="dashboard-event-row" href={`/manage/events/${event.id}`} key={event.id}><span className="event-date-block"><strong>{new Date(event.startsAt).toLocaleDateString("en-GB", { day: "2-digit" })}</strong><small>{new Date(event.startsAt).toLocaleDateString("en-GB", { month: "short" })}</small></span><span className="event-row-copy"><strong>{event.title}</strong><small>{event.venue} · {new Date(event.startsAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</small></span><span className={`event-status-label ${event.published ? "published" : "draft"}`}>{event.published ? "Published" : "Draft"}</span></Link>)}</div> : <p className="dashboard-empty-copy">No upcoming events yet.</p>}
          </section>
          <section className="dashboard-panel dashboard-recent-panel" aria-labelledby="recent-bookings-title">
            <div className="dashboard-section-heading"><h3 id="recent-bookings-title">Recent bookings</h3><Link href="/manage/bookings">View all <ArrowRight aria-hidden="true" size={15} /></Link></div>
            {recentBookings.length ? <div className="recent-booking-list">{recentBookings.map((booking) => { const status = deriveBookingStatus(booking); return <Link href="/manage/bookings" className="recent-booking-row" key={booking.bookingId}><span className="booking-avatar">{booking.name.trim().slice(0, 1).toUpperCase()}</span><span className="recent-booking-copy"><strong>{booking.name}</strong><small>{booking.bookingId.slice(0, 8).toUpperCase()} · {shortDate(booking.createdAt)}</small></span><strong className="recent-booking-amount">{formatGBP(booking.totalPence)}</strong><span className={`booking-payment-pill ${status === "paid" ? "paid" : "pending"}`}>{BOOKING_STATUS_LABEL[status]}</span></Link>; })}</div> : <p className="dashboard-empty-copy">No bookings are available to display.</p>}
          </section>
          <section className="dashboard-panel dashboard-actions-panel" aria-labelledby="quick-actions-title">
            <div className="dashboard-section-heading"><h3 id="quick-actions-title">Quick actions</h3></div>
            <div className="dashboard-quick-actions"><Link href="/manage/cms#event-editor"><Plus aria-hidden="true" size={17} /><span><strong>Create event</strong><small>Add a new event</small></span></Link><Link href="/manage/bookings"><ClipboardText aria-hidden="true" size={17} /><span><strong>Manage bookings</strong><small>View all bookings</small></span></Link><Link href="/manage/check-in"><QrCode aria-hidden="true" size={17} /><span><strong>Check-in</strong><small>Scan tickets at event</small></span></Link><Link href="/manage/operations"><ChartBar aria-hidden="true" size={17} /><span><strong>View reports</strong><small>Sales and attendance</small></span></Link></div>
            {report.activity.length > 0 && <div className="dashboard-activity-mini"><h4>Latest update</h4><strong>{report.activity[0].action.replace(/[._]/g, " ")}</strong><small>{new Date(report.activity[0].createdAt).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</small></div>}
          </section>
          {!systemUnhealthy && systemStatusPanel}
        </div>
      </>}
    </section>
  </StaffShell>;
}
