"use client";

import { useEffect, useState } from "react";

type EventRecord = { id: string; title: string; description: string; startsAt: string; venue: string; capacity: number; attendeeCount: number; childCount: number; audiencePolicy: string };

export default function EventCatalogue() {
  const [events, setEvents] = useState<EventRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  useEffect(() => { fetch("/api/events", { headers: { Accept: "application/json" } }).then((response) => { if (!response.ok) throw new Error("Unavailable"); return response.json(); }).then((result) => setEvents(result.events || [])).catch(() => setError(true)).finally(() => setLoading(false)); }, []);
  if (loading) return <div className="empty-state compact"><div className="empty-icon" aria-hidden="true">...</div><h3>Checking the event catalogue</h3><p>Loading published events and current availability.</p></div>;
  if (error) return <div className="empty-state compact"><h3>Event catalogue unavailable</h3><p>Please try again shortly.</p></div>;
  if (!events.length) return <div className="empty-state compact"><div className="empty-icon" aria-hidden="true">✦</div><h3>No public events are available yet</h3><p>Published events will appear here with their audience guidance, sessions, ticket types, and availability.</p></div>;
  return <div className="catalogue-cards">{events.map((item) => <article className="catalogue-card" key={item.id}><span className="event-card-kicker">{item.audiencePolicy.replaceAll("_", " ")}</span><h3>{item.title}</h3><p>{item.description}</p><div className="catalogue-meta"><span>{new Date(item.startsAt).toLocaleString("en-GB")}</span><span>{item.venue}</span><span>{item.capacity - item.attendeeCount} places available</span></div><a className="primary-button" href={`/apply?event=${encodeURIComponent(item.id)}`}>Apply for this event <span aria-hidden="true">→</span></a></article>)}</div>;
}
