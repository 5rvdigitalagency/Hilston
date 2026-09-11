import { NextResponse } from "next/server";
import { databaseEnabled, describeDatabaseUrl, listEventMedia, listEvents } from "@/lib/db";
import { ensureDemoEvent, store } from "@/lib/store";
import { createEventMediaUrl } from "@/lib/supabase";
import { eventPublishingEnabled, publicEventsCorsHeaders } from "@/lib/event-publishing";

export async function OPTIONS(request: Request) {
  return new NextResponse(null, { status: 204, headers: publicEventsCorsHeaders(request) });
}

export async function GET(request: Request) {
  const corsHeaders = publicEventsCorsHeaders(request);
  if (!eventPublishingEnabled()) {
    return NextResponse.json({ events: [] }, { headers: { ...corsHeaders, "Cache-Control": "no-store" } });
  }
  const debug = new URL(request.url).searchParams.has("debug");
  if (databaseEnabled) {
    try {
      const events = await listEvents(false);
      const eventsWithMedia = await Promise.all(events.map(async (event) => {
        const media = await listEventMedia(event.id);
        const attachments = await Promise.all(media.map(async (item) => ({ contentType: item.contentType, url: await createEventMediaUrl(item.storageKey) })));
        // Guests see remaining places, not how many people have booked.
        const { attendeeCount, childCount, ...publicEvent } = event;
        const placesLeft = Math.max(0, (event.capacity || 0) - (attendeeCount + childCount));
        return { ...publicEvent, placesLeft, soldOut: placesLeft === 0, imageUrl: attachments.find((item) => item.contentType.startsWith("image/"))?.url, attachments };
      }));
      return NextResponse.json({ events: eventsWithMedia }, { headers: { ...corsHeaders, "Cache-Control": "no-store" } });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error("public/events: database read failed", message);
      if (process.env.DEMO_MODE === "false") return NextResponse.json({ error: "Event catalogue unavailable", ...(debug ? { detail: message, connection: describeDatabaseUrl() } : {}) }, { status: 503, headers: corsHeaders });
    }
  }

  ensureDemoEvent();
  return NextResponse.json({ events: store.events.filter((event) => event.published) }, { headers: { ...corsHeaders, "Cache-Control": "no-store" } });
}