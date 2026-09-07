"use client";

import Link from "next/link";
import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import StaffShell from "../staff-shell";

type Guest = { id: string; name: string; email: string; event: string; tickets: number; paid: boolean; attending: string };

type BookingTicket = { id: string; ticketCode: string; status: string; checkedInAt: string | null };

type Booking = {
  bookingId: string;
  attendeeId: string | null;
  eventId: string;
  eventTitle: string;
  startsAt: string;
  venue: string;
  name: string;
  email: string;
  childCount: number;
  ticketCount: number;
  status: string;
  paid: boolean;
  totalPence: number;
  createdAt: string;
  confirmationStatus: string | null;
  confirmationSentAt: string | null;
  ticketUrl?: string;
  tickets: BookingTicket[];
};

type EventRecord = {
  id: string;
  title: string;
  description: string;
  startsAt: string;
  category: string;
  categoryId?: string;
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

const AUDIENCE_OPTIONS = [
  { value: "general", label: "Everyone" },
  { value: "adult_only", label: "Adults only" },
  { value: "kids_only", label: "Children only" },
  { value: "kids_parent_mandatory", label: "Children with parent or guardian" },
];

const EMPTY_FORM = {
  title: "",
  description: "",
  date: "",
  time: "10:00",
  venue: "Hilston Park",
  capacity: "50",
  categoryId: "",
  audiencePolicy: "general",
  minAge: "",
  maxAge: "",
};

function audienceLabel(value: string) {
  return AUDIENCE_OPTIONS.find((option) => option.value === value)?.label ?? value;
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date to confirm";
  return date.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "long", year: "numeric" });
}

function formatTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

export default function CmsPage() {
  const [form, setForm] = useState(EMPTY_FORM);
  const [events, setEvents] = useState<EventRecord[]>([]);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [editingEvent, setEditingEvent] = useState<EventRecord | null>(null);
  const [guests, setGuests] = useState<Guest[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [openBooking, setOpenBooking] = useState<string | null>(null);
  const [sendingConfirmation, setSendingConfirmation] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState("");
  const [mediaMaxMb, setMediaMaxMb] = useState(50);
  const [media, setMedia] = useState<File[]>([]);
  const [access, setAccess] = useState<"checking" | "allowed" | "denied">("checking");
  const [status, setStatus] = useState<{ tone: "success" | "error" | "warning"; message: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [loadingEvents, setLoadingEvents] = useState(true);

  const loadEvents = useCallback(() => {
    setLoadingEvents(true);
    return fetch("/api/events", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : { events: [] }))
      .then((result) => setEvents(Array.isArray(result.events) ? result.events : []))
      .catch(() => setEvents([]))
      .finally(() => setLoadingEvents(false));
  }, []);

  const loadBookings = useCallback(() => {
    return fetch("/api/manage/bookings", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : { bookings: [] }))
      .then((result) => setBookings(Array.isArray(result.bookings) ? result.bookings : []))
      .catch(() => setBookings([]));
  }, []);

  useEffect(() => {
    fetch("/api/auth/session", { cache: "no-store" })
      .then((response) => response.json())
      .then((result) => {
        if (!result.authenticated) return setAccess("denied");
        setAccess("allowed");
        if (result.mediaMaxMb) setMediaMaxMb(result.mediaMaxMb);
        loadEvents();
        loadBookings();
        fetch("/api/event-categories", { cache: "no-store" }).then((response) => response.ok ? response.json() : { categories: [] }).then((result) => setCategories(Array.isArray(result.categories) ? result.categories : [])).catch(() => setCategories([]));
        return fetch("/api/manage/summary", { cache: "no-store" })
          .then((response) => response.json())
          .then((summary) => setGuests(summary.guests || []));
      })
      .catch(() => setAccess("denied"));
  }, [loadEvents, loadBookings]);

  const counts = useMemo(() => ({
    published: events.filter((event) => event.published).length,
    drafts: events.filter((event) => !event.published).length,
  }), [events]);

  function update(field: keyof typeof EMPTY_FORM, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
    setStatus(null);
  }

  function upload(event: ChangeEvent<HTMLInputElement>) {
    const chosen = Array.from(event.target.files || []);
    const oversized = chosen.filter((file) => file.size > mediaMaxMb * 1024 * 1024);
    if (oversized.length) {
      setStatus({ tone: "error", message: `${oversized.map((file) => file.name).join(", ")} is larger than the ${mediaMaxMb} MB upload limit. Compress the file or choose a smaller one.` });
      event.target.value = "";
      setMedia([]);
      return;
    }
    setStatus(null);
    setMedia(chosen);
  }

  async function sendConfirmation(target: { attendeeId?: string | null; bookingId?: string }) {
    setStatus(null);
    setSendingConfirmation(target.bookingId || target.attendeeId || "");
    try {
      const body = target.bookingId ? { bookingId: target.bookingId } : { attendeeId: target.attendeeId };
      const response = await fetch("/api/manage/notifications", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const result = await response.json().catch(() => ({}));
      // A queued result means email delivery is not configured, so it must not look like a success.
      const tone = !response.ok ? "error" : result.status === "sent" ? "success" : "warning";
      setStatus({ tone, message: result.message || result.error || "Confirmation could not be sent." });
      if (result.status === "sent") loadBookings();
    } finally {
      setSendingConfirmation(null);
    }
  }

  /** Uploads straight to storage so large videos bypass the serverless request size limit. */
  async function uploadMedia(eventId: string, files: File[]) {
    for (const [index, file] of files.entries()) {
      setUploadProgress(`Uploading ${index + 1} of ${files.length}: ${file.name}`);
      const prepared = await fetch(`/api/events/${eventId}/media/upload-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: file.name, contentType: file.type, size: file.size }),
      });
      const preparedResult = await prepared.json().catch(() => ({}));
      if (!prepared.ok) throw new Error(preparedResult.error || "The upload could not be prepared.");

      const stored = await fetch(preparedResult.uploadUrl, { method: "PUT", headers: file.type ? { "Content-Type": file.type } : undefined, body: file });
      if (!stored.ok) throw new Error(`Storage rejected ${file.name}. It may exceed the storage file size limit.`);

      const registered = await fetch(`/api/events/${eventId}/media`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storageKey: preparedResult.storageKey, contentType: file.type }),
      });
      if (!registered.ok) {
        const registerResult = await registered.json().catch(() => ({}));
        throw new Error(registerResult.error || `${file.name} uploaded but could not be attached.`);
      }
    }
    setUploadProgress("");
  }

  async function setArchived(event: EventRecord, archived: boolean) {
    if (archived && !window.confirm(`Archive "${event.title}"? It will be removed from the public storefront but all bookings and tickets are kept.`)) return;
    setSaving(true);
    setStatus(null);
    try {
      const response = await fetch(`/api/events/${event.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ archived }) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) return setStatus({ tone: "error", message: result.error || "The event could not be updated." });
      setStatus({ tone: "success", message: archived ? `"${event.title}" is archived and no longer on the storefront.` : `"${event.title}" has been restored.` });
      loadEvents();
    } catch {
      setStatus({ tone: "error", message: "Network problem while updating. Please try again." });
    } finally {
      setSaving(false);
    }
  }

  async function deleteEvent(event: EventRecord) {
    if (!window.confirm(`Permanently delete "${event.title}"? This cannot be undone.`)) return;
    setSaving(true);
    setStatus(null);
    try {
      const response = await fetch(`/api/events/${event.id}`, { method: "DELETE" });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) return setStatus({ tone: "error", message: result.error || "The event could not be deleted." });
      setStatus({ tone: "success", message: `"${event.title}" has been deleted.` });
      loadEvents();
    } catch {
      setStatus({ tone: "error", message: "Network problem while deleting. Please try again." });
    } finally {
      setSaving(false);
    }
  }

  function startEditing(event: EventRecord) {
    const startsAt = new Date(event.startsAt);
    setEditingEvent(event);
    setForm({
      title: event.title,
      description: event.description,
      date: startsAt.toISOString().slice(0, 10),
      time: startsAt.toISOString().slice(11, 16),
      venue: event.venue,
      capacity: String(event.capacity),
      categoryId: event.categoryId || "",
      audiencePolicy: event.audiencePolicy,
      minAge: event.minAge === undefined || event.minAge === null ? "" : String(event.minAge),
      maxAge: event.maxAge === undefined || event.maxAge === null ? "" : String(event.maxAge),
    });
    setStatus(null);
    document.getElementById("event-editor")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function setPublication(event: EventRecord, published: boolean) {
    if (!published && !window.confirm(`Take "${event.title}" out of the public catalogue? It will remain available as a draft.`)) return;
    setSaving(true);
    setStatus(null);
    try {
      const response = await fetch("/api/events", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...event, id: event.id, published }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        setStatus({ tone: "error", message: result.error || "The event could not be updated." });
        return;
      }
      setStatus({ tone: "success", message: published ? `"${event.title}" is now published.` : `"${event.title}" has been taken down and saved as a draft.` });
      loadEvents();
    } catch {
      setStatus({ tone: "error", message: "Network problem while updating. Please try again." });
    } finally {
      setSaving(false);
    }
  }

  async function save(publish: boolean) {
    if (!form.title.trim() || !form.description.trim() || !form.date) {
      setStatus({ tone: "error", message: "Add an event name, description, and date before saving." });
      return;
    }
    const startsAt = new Date(`${form.date}T${form.time || "00:00"}:00`);
    if (Number.isNaN(startsAt.getTime())) {
      setStatus({ tone: "error", message: "That date and time combination is not valid." });
      return;
    }
    if (form.minAge !== "" && form.maxAge !== "" && Number(form.minAge) > Number(form.maxAge)) {
      setStatus({ tone: "error", message: "The minimum age cannot be higher than the maximum age." });
      return;
    }

    setSaving(true);
    setStatus(null);
    try {
      const response = await fetch("/api/events", {
        method: editingEvent ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(editingEvent ? { id: editingEvent.id } : {}),
          title: form.title.trim(),
          description: form.description.trim(),
          startsAt: startsAt.toISOString(),
          categoryId: form.categoryId || undefined,
          category: categories.find((category) => category.id === form.categoryId)?.name || editingEvent?.category || "Upcoming event",
          venue: form.venue.trim() || "Hilston Park",
          capacity: Number(form.capacity) || 1,
          audiencePolicy: form.audiencePolicy,
          minAge: form.minAge === "" ? undefined : Number(form.minAge),
          maxAge: form.maxAge === "" ? undefined : Number(form.maxAge),
          published: publish,
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        setStatus({ tone: "error", message: result.error || "The event could not be saved." });
        return;
      }
      if (media.length) {
        try {
          await uploadMedia(result.event.id, media);
        } catch (error) {
          setUploadProgress("");
          setStatus({ tone: "error", message: `Event saved, but media was not uploaded: ${error instanceof Error ? error.message : "please try again."}` });
          setMedia([]);
          await loadEvents();
          return;
        }
      }
      setStatus({
        tone: "success",
        message: publish ? (editingEvent ? "Event changes saved and published." : "Event published. It will appear on the storefront within a minute.") : (editingEvent ? "Event changes saved as a draft." : "Draft saved. Publish it when you are ready."),
      });
      setForm(EMPTY_FORM);
      setEditingEvent(null);
      setMedia([]);
      loadEvents();
    } catch {
      setStatus({ tone: "error", message: "Network problem while saving. Please try again." });
    } finally {
      setSaving(false);
    }
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    save(true);
  }

  if (access === "checking") {
    return (
      <main className="page-shell">
        <section className="content-section">
          <p className="eyebrow">Staff CMS</p>
          <h1>Checking access.</h1>
        </section>
      </main>
    );
  }

  if (access === "denied") {
    return (
      <main className="page-shell">
        <header className="subbar">
          <Link className="brand" href="/"><img className="brand-logo" src="/brand/hilston-park-logo.webp" alt="Hilston Park Tickets" /></Link>
          <span className="status-pill">Staff only</span>
        </header>
        <section className="content-section auth-layout">
          <p className="eyebrow">Restricted area</p>
          <h1>Staff access required.</h1>
          <p className="lead-copy">Sign in through the staff console before opening the event management workspace.</p>
          <Link className="primary-button" href="/manage">Go to staff login <span aria-hidden="true">→</span></Link>
        </section>
      </main>
    );
  }

  return (
    <StaffShell active="events" title="Events and bookings">
      <section className="cms-hero">
        <div>
          <p className="eyebrow">Events and operations</p>
          <h1>Your events, your way.</h1>
          <p>Build an event once, publish it to the storefront, and manage every guest from one place.</p>
        </div>
        <div className="cms-hero-stats">
          <div className="hero-stat">
            <strong>{counts.published}</strong>
            <span>Published</span>
          </div>
          <div className="hero-stat">
            <strong>{counts.drafts}</strong>
            <span>Drafts</span>
          </div>
          <div className="hero-stat">
            <strong>{guests.length}</strong>
            <span>Guests</span>
          </div>
        </div>
      </section>

      <section className="cms-content">
        {status && (
          <div className={`cms-banner ${status.tone}`} role="status" aria-live="polite">
            <span>{status.message}</span>
            <button type="button" aria-label="Dismiss message" onClick={() => setStatus(null)}>&times;</button>
          </div>
        )}
        <div className="cms-grid" id="event-editor">
          <form className="cms-card" onSubmit={onSubmit}>
            <div className="card-heading">
              <div>
                <p className="eyebrow">Create</p>
                <h2>{editingEvent ? "Edit event" : "New event"}</h2>
              </div>
            </div>
            <p className="panel-copy">Everything a guest needs to decide whether to book. Published events appear on the public site automatically.</p>

            <div className="cms-form">
              <label>
                Event name
                <input value={form.title} onChange={(event) => update("title", event.target.value)} placeholder="Autumn Woodland Trail" maxLength={120} required />
              </label>

              <label>
                What is happening?
                <textarea value={form.description} onChange={(event) => update("description", event.target.value)} rows={4} placeholder="Describe the experience, what is included, and what guests should bring." maxLength={2000} required />
                <small className="field-hint">{form.description.length}/2000</small>
              </label>

              <div className="form-two">
                <label>
                  Date
                  <input type="date" value={form.date} onChange={(event) => update("date", event.target.value)} required />
                </label>
                <label>
                  Start time
                  <input type="time" value={form.time} onChange={(event) => update("time", event.target.value)} required />
                </label>
              </div>

              <div className="form-two">
                <label>
                  Venue
                  <input value={form.venue} onChange={(event) => update("venue", event.target.value)} maxLength={120} />
                </label>
                <label>
                  Capacity
                  <input type="number" min={1} max={100000} value={form.capacity} onChange={(event) => update("capacity", event.target.value)} />
                </label>
              </div>

              <label>
                Event classification
                <select value={form.categoryId} onChange={(event) => update("categoryId", event.target.value)}>
                  <option value="">Upcoming event</option>
                  {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                </select>
              </label>

              <label>
                Who can apply?
                <select value={form.audiencePolicy} onChange={(event) => update("audiencePolicy", event.target.value)}>
                  {AUDIENCE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </label>

              <div className="form-two">
                <label>
                  Minimum age (optional)
                  <input type="number" min="0" max="120" placeholder="No minimum" value={form.minAge} onChange={(event) => update("minAge", event.target.value)} />
                </label>
                <label>
                  Maximum age (optional)
                  <input type="number" min="0" max="120" placeholder="No maximum" value={form.maxAge} onChange={(event) => update("maxAge", event.target.value)} />
                </label>
              </div>
            </div>

            <div className="button-row card-actions">
              <button className="primary-button" type="submit" disabled={saving}>
                {saving ? "Saving\u2026" : editingEvent ? "Save and publish" : "Save and publish"} <span aria-hidden="true">&rarr;</span>
              </button>
              <button className="secondary-button dark-text" type="button" disabled={saving} onClick={() => save(false)}>{editingEvent ? "Save as draft" : "Save draft"}</button>
              {editingEvent && <button className="secondary-button dark-text" type="button" disabled={saving} onClick={() => { setEditingEvent(null); setForm(EMPTY_FORM); setStatus(null); }}>Cancel edit</button>}
            </div>
          </form>

          <div className="cms-side">
            <div className="cms-card preview-card">
              <div className="card-heading">
                <div>
                  <p className="eyebrow">Live preview</p>
                  <h2>Guest view</h2>
                </div>
              </div>
              <article className="event-preview">
                <span className="preview-date">{form.date ? formatDate(`${form.date}T${form.time || "00:00"}:00`) : "Choose a date"}</span>
                <h3>{form.title || "Event name"}</h3>
                <p>{form.description || "Your description will appear here as guests will read it."}</p>
                <div className="preview-tags">
                  <span>{form.venue || "Hilston Park"}</span>
                  <span>{audienceLabel(form.audiencePolicy)}</span>
                  <span>{form.capacity || 0} places</span>
                </div>
              </article>
            </div>

            <div className="cms-card" id="media">
              <div className="card-heading">
                <div>
                  <p className="eyebrow">Images and video</p>
                  <h2>Event media</h2>
                </div>
              </div>
              <label className="upload-zone">
                <span className="upload-icon" aria-hidden="true">&#65291;</span>
                <strong>Choose images or videos</strong>
                <small>Images and video, up to {mediaMaxMb} MB each</small>
                <input type="file" multiple onChange={upload} />
              </label>
              {uploadProgress && <p className="panel-copy">{uploadProgress}</p>}
              {media.length > 0 && (
                <ul className="media-list">
                  {media.map((file) => <li key={`${file.name}-${file.lastModified}`}><span>&#10003;</span>{file.name}</li>)}
                </ul>
              )}
            </div>
          </div>
        </div>

        <section className="cms-card events-panel">
          <div className="card-heading">
            <div>
              <p className="eyebrow">Catalogue</p>
              <h2>Your events</h2>
            </div>
            <span className="status-pill">{events.length} total</span>
          </div>

          {loadingEvents && <p className="panel-copy">Loading events&#8230;</p>}

          {!loadingEvents && events.length === 0 && (
            <div className="events-empty">
              <span aria-hidden="true">&#9671;</span>
              <strong>No events yet</strong>
              <small>Create your first event with the form above and it will appear here.</small>
            </div>
          )}

          {!loadingEvents && events.length > 0 && (
            <ul className="event-rows">
              {events.map((event) => (
                <li key={event.id} className="event-row">
                  <div className="event-row-main">
                    <span className={event.archived ? "draft-dot" : event.published ? "live-dot" : "draft-dot"}>{event.archived ? "Archived" : event.published ? "Published" : "Draft"}</span>
                    <h3>{event.title}</h3>
                    <p>{formatDate(event.startsAt)} &middot; {formatTime(event.startsAt)} &middot; {event.venue}</p>
                  </div>
                  <div className="event-row-meta">
                    <strong>{(event.attendeeCount ?? 0) + (event.childCount ?? 0)}</strong>
                    <span>of {event.capacity} places</span>
                    <small>{audienceLabel(event.audiencePolicy)}</small>
                  </div>
                  <div className="event-row-actions">
                    <button className="table-action" type="button" disabled={saving} onClick={() => startEditing(event)}>Edit</button>
                    {!event.archived && <button className="table-action" type="button" disabled={saving} onClick={() => setPublication(event, !event.published)}>{event.published ? "Take down" : "Publish"}</button>}
                    <button className="table-action" type="button" disabled={saving} onClick={() => setArchived(event, !event.archived)}>{event.archived ? "Restore" : "Archive"}</button>
                    <button className="table-action danger" type="button" disabled={saving} onClick={() => deleteEvent(event)}>Delete</button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="cms-card submissions-panel" id="submissions">
          <div className="card-heading">
            <div>
              <p className="eyebrow">Guest management</p>
              <h2>Bookings and attendance</h2>
            </div>
            <span className="status-pill">{bookings.length} bookings</span>
          </div>

          {bookings.length === 0 && <p className="panel-copy">No bookings yet. When a guest books on the website they will appear here with their tickets.</p>}

          {bookings.length > 0 && (
            <ul className="booking-rows">
              {bookings.map((booking) => {
                const open = openBooking === booking.bookingId;
                return (
                  <li key={booking.bookingId} className={open ? "booking-row open" : "booking-row"}>
                    <button className="booking-summary" type="button" aria-expanded={open} onClick={() => setOpenBooking(open ? null : booking.bookingId)}>
                      <span className="booking-guest">
                        <strong>{booking.name}</strong>
                        <small>{booking.email}</small>
                      </span>
                      <span className="booking-event">{booking.eventTitle}</span>
                      <span className="booking-count">{booking.ticketCount} ticket{booking.ticketCount === 1 ? "" : "s"}</span>
                      <span className={booking.paid ? "paid" : "unpaid"}>{booking.paid ? "Paid" : "Not paid"}</span>
                      <span className="booking-toggle" aria-hidden="true">{open ? "\u2212" : "+"}</span>
                    </button>

                    {open && (
                      <div className="booking-detail">
                        <dl className="booking-facts">
                          <div><dt>Name</dt><dd>{booking.name}</dd></div>
                          <div><dt>Email</dt><dd><a href={`mailto:${booking.email}`}>{booking.email}</a></dd></div>
                          <div><dt>Event</dt><dd>{booking.eventTitle}</dd></div>
                          <div><dt>When</dt><dd>{formatDate(booking.startsAt)} &middot; {formatTime(booking.startsAt)}</dd></div>
                          <div><dt>Venue</dt><dd>{booking.venue}</dd></div>
                          <div><dt>Children included</dt><dd>{booking.childCount}</dd></div>
                          <div><dt>Booking status</dt><dd>{booking.status}</dd></div>
                          <div><dt>Payment</dt><dd>{booking.paid ? `Paid \u00a3${(booking.totalPence / 100).toFixed(2)}` : "Not paid"}</dd></div>
                          <div><dt>Booked on</dt><dd>{formatDate(booking.createdAt)} &middot; {formatTime(booking.createdAt)}</dd></div>
                          <div><dt>Confirmation email</dt><dd>{booking.confirmationStatus === "sent" ? `Sent ${booking.confirmationSentAt ? formatDate(booking.confirmationSentAt) : ""}` : booking.confirmationStatus || "Not sent"}</dd></div>
                        </dl>

                        <div className="booking-tickets">
                          <h4>Tickets and QR codes</h4>
                          {booking.tickets.length === 0 && <p className="panel-copy">No tickets were issued for this booking.</p>}
                          <ul>
                            {booking.tickets.map((ticket) => (
                              <li key={ticket.id}>
                                <img src={`/api/public/tickets/${encodeURIComponent(ticket.ticketCode)}/qr`} alt={`QR code for ${ticket.ticketCode}`} width={130} height={130} />
                                <strong>{ticket.ticketCode}</strong>
                                <small>{ticket.status === "checked_in" ? `Checked in${ticket.checkedInAt ? ` ${formatDate(ticket.checkedInAt)}` : ""}` : "Issued"}</small>
                              </li>
                            ))}
                          </ul>
                        </div>

                        <div className="booking-actions">
                          <button className="primary-button" type="button" disabled={sendingConfirmation === booking.bookingId} onClick={() => sendConfirmation({ bookingId: booking.bookingId })}>
                            {sendingConfirmation === booking.bookingId ? "Sending\u2026" : "Send confirmation and tickets"}
                          </button>
                          {booking.ticketUrl && (
                            <button className="secondary-button dark-text" type="button" onClick={() => {
                              navigator.clipboard.writeText(booking.ticketUrl!)
                                .then(() => setStatus({ tone: "success", message: "Ticket link copied. You can paste it into any email or message." }))
                                .catch(() => setStatus({ tone: "error", message: booking.ticketUrl! }));
                            }}>Copy ticket link</button>
                          )}
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="storefront-preview" id="publishing">
          <div>
            <p className="eyebrow">Publishing</p>
            <h2>Ready for the Hilston Park website</h2>
            <p>Publish event information here, then connect the Hilston Park website&apos;s event page and booking action to this ticketing system.</p>
          </div>
        </section>
      </section>

      <footer className="footer">
        <Link href="/manage">Dashboard</Link>
        <Link href="/">Ticketing home</Link>
      </footer>
    </StaffShell>
  );
}
