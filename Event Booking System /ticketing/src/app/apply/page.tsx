"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";

type EventRecord = { id: string; title: string; startsAt: string; venue: string; audiencePolicy: string; capacity: number };

export default function ApplyPage() {
  const [events, setEvents] = useState<EventRecord[]>([]);
  const [eventId, setEventId] = useState("");
  const [form, setForm] = useState({ name: "", email: "", childCount: "0" });
  const [message, setMessage] = useState("Loading available events...");
  useEffect(() => { fetch("/api/events").then((response) => response.json()).then((result) => { setEvents(result.events || []); setMessage(result.events?.length ? "" : "No published events are available yet."); }).catch(() => setMessage("Events are temporarily unavailable.")); }, []);
  async function submit(event: FormEvent) { event.preventDefault(); setMessage(""); const response = await fetch(`/api/events/${eventId}/attendees`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, childCount: Number(form.childCount) }) }); const result = await response.json(); setMessage(response.ok ? "Application received. The booking confirmation flow will be connected to Stripe next." : result.error || "Application could not be submitted."); }

  return <main className="page-shell"><header className="subbar"><Link className="brand" href="/"><span className="brand-mark">HP</span><span>Hilston Park <em>Tickets</em></span></Link><Link className="account-link" href="/account">Sign in <span aria-hidden="true">↗</span></Link></header><section className="content-section enquiry-layout"><p className="eyebrow">Public applications</p><h1>Apply for an event.</h1><p className="lead-copy">Choose a published event and tell the team who is attending. Payment and ticket issuing will be added through the server-side Stripe flow.</p><form className="enquiry-form" onSubmit={submit}><label>Event<select value={eventId} onChange={(e) => setEventId(e.target.value)} required><option value="" disabled>{events.length ? "Select an event" : "No events available"}</option>{events.map((item) => <option value={item.id} key={item.id}>{item.title} · {new Date(item.startsAt).toLocaleDateString("en-GB")}</option>)}</select></label><label>Lead attendee name<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></label><label>Email<input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></label><label>Number of children<input type="number" min="0" max="100" value={form.childCount} onChange={(e) => setForm({ ...form, childCount: e.target.value })} required /></label>{message && <p className="form-note" role="status">{message}</p>}<button className="primary-button" type="submit" disabled={!events.length}>Submit application <span aria-hidden="true">→</span></button></form></section><footer className="footer"><Link href="/events">Browse events</Link><Link href="/">Back to ticketing</Link></footer></main>;
}
