"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import StaffShell from "../../staff-shell";

type EventRecord = {
  id: string;
  title: string;
  description: string;
  startsAt: string;
  category: string;
  venue: string;
  capacity: number;
  audiencePolicy: string;
  minAge?: number;
  maxAge?: number;
  published: boolean;
  archived?: boolean;
  attendeeCount?: number;
  childCount?: number;
};

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Date to confirm" : date.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

function formatTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Time to confirm" : date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

function statusLabel(event: EventRecord) {
  return event.archived ? "Archived" : event.published ? "Published" : "Draft";
}

export default function EventDetailPage({ params }: { params: Promise<{ eventId: string }> }) {
  const [event, setEvent] = useState<EventRecord | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    params.then(({ eventId: resolvedId }) => {
      return fetch("/api/events", { cache: "no-store" }).then((response) => response.json()).then((result) => {
        setEvent(Array.isArray(result?.events) ? result.events.find((item: EventRecord) => item.id === resolvedId) || null : null);
      });
    })
      .catch(() => setEvent(null))
      .finally(() => setLoading(false));
  }, [params]);

  return (
    <StaffShell active="events" title="Event details">
      <section className="cms-content event-detail-page">
        <Link className="back-link" href="/manage/cms">&larr; Back to events</Link>
        {loading && <section className="cms-card"><p className="panel-copy">Loading event...</p></section>}
        {!loading && !event && <section className="cms-card"><h2>Event not found</h2><p className="panel-copy">This event may have been removed or is not available to your staff account.</p></section>}
        {!loading && event && (
          <>
            <section className="event-detail-hero">
              <div>
                <span className={`event-status ${event.archived ? "archived" : event.published ? "published" : "draft"}`}><span aria-hidden="true">&#9679;</span>{statusLabel(event)}</span>
                <p className="eyebrow">{event.category}</p>
                <h1>{event.title}</h1>
                <p>{formatDate(event.startsAt)} at {formatTime(event.startsAt)} &middot; {event.venue}</p>
              </div>
              <div className="event-detail-actions"><Link className="primary-button" href={`/manage/cms?edit=${event.id}`}>Edit event</Link><Link className="secondary-button dark-text" href={`/manage/bookings?eventId=${event.id}`}>View bookings</Link></div>
            </section>

            <nav className="detail-tabs" aria-label="Event management sections">
              <a className="active" href="#overview">Overview</a><a href="#schedule">Schedule</a><a href="#tickets">Tickets</a><Link href={`/manage/bookings?eventId=${event.id}`}>Bookings</Link>
            </nav>

            <div className="event-detail-grid" id="overview">
              <section className="cms-card"><p className="eyebrow">Event information</p><h2>Overview</h2><p className="event-description">{event.description}</p><dl className="event-facts"><div><dt>Category</dt><dd>{event.category}</dd></div><div><dt>Venue</dt><dd>{event.venue}</dd></div><div><dt>Booking eligibility</dt><dd>{event.audiencePolicy}</dd></div><div><dt>Age range</dt><dd>{event.minAge ?? 0} to {event.maxAge ?? "No limit"}</dd></div></dl></section>
              <section className="cms-card"><p className="eyebrow">Capacity</p><h2>Attendance</h2><strong className="detail-number">{(event.attendeeCount ?? 0) + (event.childCount ?? 0)}</strong><p className="panel-copy">of {event.capacity} places currently booked</p><div className="capacity-track"><span style={{ width: `${Math.min(100, (((event.attendeeCount ?? 0) + (event.childCount ?? 0)) / Math.max(1, event.capacity)) * 100)}%` }} /></div></section>
              <section className="cms-card" id="schedule"><p className="eyebrow">Schedule</p><h2>Event sessions</h2><p className="panel-copy">{formatDate(event.startsAt)}<br />{formatTime(event.startsAt)} at {event.venue}</p><Link className="secondary-button dark-text" href={`/manage/cms?edit=${event.id}&step=1`}>Manage schedule</Link></section>
              <section className="cms-card" id="tickets"><p className="eyebrow">Ticketing</p><h2>Ticket types</h2><p className="panel-copy">Ticket types and prices will appear here once configured for this event.</p><Link className="secondary-button dark-text" href={`/manage/cms?edit=${event.id}&step=3`}>Configure tickets</Link></section>
            </div>
          </>
        )}
      </section>
    </StaffShell>
  );
}
