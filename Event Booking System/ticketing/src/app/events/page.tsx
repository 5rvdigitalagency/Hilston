import Link from "next/link";
import { databaseEnabled, listEventMedia, listEventSchedules, listEvents } from "@/lib/db";
import { stagingStorefrontEnabled } from "@/lib/event-publishing";
import { computeDemoEventStatus, ensureDemoEvent, listStoreEventSchedules, store } from "@/lib/store";
import { createEventMediaUrl } from "@/lib/supabase";
import EventCatalogue from "./event-catalogue";

export const dynamic = "force-dynamic";

export default async function EventsPage() {
  const enabled = stagingStorefrontEnabled();
  let events = [] as Awaited<ReturnType<typeof listEvents>>;
  let schedules: Awaited<ReturnType<typeof listEventSchedules>> = {};
  let images: Record<string, string> = {};

  if (enabled) {
    if (databaseEnabled) {
      events = await listEvents(false).catch(() => []);
      schedules = await listEventSchedules(events.map((event) => event.id)).catch(() => ({}));
      const mediaEntries = await Promise.all(events.map(async (event) => {
        const media = await listEventMedia(event.id).catch(() => []);
        const image = media.find((item) => item.contentType.startsWith("image/"));
        return image ? [event.id, await createEventMediaUrl(image.storageKey)] as const : null;
      }));
      images = Object.fromEntries(mediaEntries.filter((entry): entry is readonly [string, string] => entry !== null));
    } else {
      ensureDemoEvent();
      events = store.events.filter((event) => event.published && !event.archived);
      schedules = listStoreEventSchedules(events.map((event) => event.id));
    }
  }

  const upcomingEvents = events.flatMap((event) => {
    const status = event.status ?? computeDemoEventStatus(event);
    return status === "published" || status === "sold_out" ? [{ ...event, status, sessions: schedules[event.id] || [], imageUrl: images[event.id] }] : [];
  });

  return <main className="page-shell">
    <header className="topbar">
      <Link className="brand" href="/events" aria-label="Hilston Park events">
        <img className="brand-logo" src="/brand/hilston-park-logo.webp" alt="Hilston Park" />
      </Link>
      <span className="storefront-preview-label">Ticketing preview</span>
      <Link className="account-link" href="/staff-login">Staff sign in</Link>
    </header>
    <section className="page-intro events-intro">
      <p className="eyebrow">Hilston Park</p>
      <h1>What’s on</h1>
      <p>Explore upcoming events at Hilston Park.</p>
    </section>
    <section className="catalogue events-catalogue">
      <div className="section-heading">
        <div><p className="eyebrow">The programme</p><h2>Upcoming events</h2></div>
        <span className="status-pill">Preview only</span>

      </div>
      {!enabled && <div className="empty-state"><h3>Events are not available for review.</h3><p>This ticketing storefront has not been authorised for this deployment.</p></div>}
      {enabled && !upcomingEvents.length && <div className="empty-state"><h3>No upcoming events</h3><p>Published events will appear here when they are ready for the preview storefront.</p></div>}
      {enabled && upcomingEvents.length > 0 && <EventCatalogue events={upcomingEvents} />}
    </section>
    <footer className="footer"><span>Hilston Park ticketing preview</span><span>Not connected to the live website</span></footer>
  </main>;
}