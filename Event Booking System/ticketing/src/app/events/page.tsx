import Link from "next/link";
import { databaseEnabled, listEvents } from "@/lib/db";
import { stagingStorefrontEnabled } from "@/lib/event-publishing";
import { ensureDemoEvent, store } from "@/lib/store";

export const dynamic = "force-dynamic";

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date to confirm";
  return date.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

export default async function EventsPage() {
  const enabled = stagingStorefrontEnabled();
  let events = [] as Awaited<ReturnType<typeof listEvents>>;

  if (enabled) {
    if (databaseEnabled) events = await listEvents(false).catch(() => []);
    else {
      ensureDemoEvent();
      events = store.events.filter((event) => event.published && !event.archived);
    }
  }

  return <main className="auth-gate"><section className="auth-gate-panel">
    <p className="eyebrow">Hilston Park Tickets</p>
    <h1>Upcoming events</h1>
    <p>Ticketing preview environment. Events listed here are not published to the Hilston Park website.</p>
    {!enabled && <><h2>Events are not available for review.</h2><p>This ticketing storefront has not been authorised for this deployment.</p></>}
    {enabled && !events.length && <><h2>No upcoming events.</h2><p>Published ticketing events will appear here for staging review.</p></>}
    {enabled && events.map((event) => {
      const placesLeft = Math.max(0, event.capacity - event.attendeeCount - event.childCount);
      return <section key={event.id} className="cms-card">
        <p className="eyebrow">{formatDate(event.startsAt)}</p>
        <h2>{event.title}</h2>
        <p>{event.description}</p>
        <p>{event.venue} · {placesLeft > 0 ? `${placesLeft} places left` : "Fully booked"}</p>
      </section>;
    })}
    <Link className="secondary-link" href="/staff-login">Staff sign in</Link>
  </section></main>;
}