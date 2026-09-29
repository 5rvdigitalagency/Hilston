import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { isStaffSession, staffSessionInfo } from "@/lib/auth";
import { getEventScheduleForEdit, store } from "@/lib/store";
import { databaseEnabled, deleteEventCascade, getEventSessionsForEdit, setEventArchived, setEventCancelled, setEventPublished } from "@/lib/db";
import { eventPublishingEnabled } from "@/lib/event-publishing";

const patchSchema = z.union([z.object({ archived: z.boolean() }), z.object({ cancelled: z.boolean() }), z.object({ published: z.boolean() })]);

async function currentStaff() {
  return staffSessionInfo((await cookies()).get("ticketing_staff")?.value);
}

async function requireStaff() {
  const session = (await cookies()).get("ticketing_staff")?.value;
  return isStaffSession(session, "events.manage");
}

export async function GET(_request: Request, context: { params: Promise<{ eventId: string }> }) {
  if (!(await requireStaff())) return NextResponse.json({ error: "Staff authentication required" }, { status: 401 });
  const { eventId } = await context.params;
  if (!databaseEnabled) return NextResponse.json(getEventScheduleForEdit(eventId));
  const schedule = await getEventSessionsForEdit(eventId);
  return NextResponse.json(schedule);
}

export async function PATCH(request: Request, context: { params: Promise<{ eventId: string }> }) {
  if (!(await requireStaff())) return NextResponse.json({ error: "Staff authentication required" }, { status: 401 });
  const { eventId } = await context.params;
  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Set archived, cancelled or published to true or false." }, { status: 400 });

  if ("published" in parsed.data) {
    const published = parsed.data.published;
    if (published && eventPublishingEnabled() === false) return NextResponse.json({ error: "Publishing is disabled while the event system is in testing." }, { status: 403 });
    if (databaseEnabled === false) {
      const event = store.events.find((item) => item.id === eventId);
      if (event === undefined) return NextResponse.json({ error: "Event not found" }, { status: 404 });
      event.published = published;
      return NextResponse.json({ published });
    }
    try {
      await setEventPublished(eventId, published, await currentStaff());
      return NextResponse.json({ published });
    } catch (error) {
      if (error instanceof Error && error.message === "event_not_found") return NextResponse.json({ error: "Event not found" }, { status: 404 });
      if (error instanceof Error && error.message === "publish_requires_schedule") return NextResponse.json({ error: "Add at least one future session with a ticket type before publishing this event." }, { status: 409 });
      console.error("event publish toggle failed", error);
      return NextResponse.json({ error: "The event could not be updated." }, { status: 503 });
    }
  }

  if ("cancelled" in parsed.data) {
    if (!databaseEnabled) {
      const event = store.events.find((item) => item.id === eventId);
      if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });
      event.cancelled = parsed.data.cancelled;
      return NextResponse.json({ event });
    }
    try {
      await setEventCancelled(eventId, parsed.data.cancelled, await currentStaff());
      return NextResponse.json({ cancelled: parsed.data.cancelled });
    } catch (error) {
      if (error instanceof Error && error.message === "event_not_found") return NextResponse.json({ error: "Event not found" }, { status: 404 });
      console.error("event cancel failed", error);
      return NextResponse.json({ error: "The event could not be updated." }, { status: 503 });
    }
  }

  if (!databaseEnabled) {
    const event = store.events.find((item) => item.id === eventId);
    if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });
    event.archived = parsed.data.archived;
    if (parsed.data.archived) event.published = false;
    return NextResponse.json({ event });
  }

  try {
    await setEventArchived(eventId, parsed.data.archived, await currentStaff());
    return NextResponse.json({ archived: parsed.data.archived });
  } catch (error) {
    if (error instanceof Error && error.message === "event_not_found") return NextResponse.json({ error: "Event not found" }, { status: 404 });
    console.error("event archive failed", error);
    return NextResponse.json({ error: "The event could not be updated." }, { status: 503 });
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ eventId: string }> }) {
  if (!(await requireStaff())) return NextResponse.json({ error: "Staff authentication required" }, { status: 401 });
  const { eventId } = await context.params;

  if (!databaseEnabled) {
    const index = store.events.findIndex((event) => event.id === eventId);
    if (index < 0) return NextResponse.json({ error: "Event not found" }, { status: 404 });
    const [event] = store.events.splice(index, 1);
    store.attendees = store.attendees.filter((attendee) => attendee.eventId !== eventId);
    const sessionIds = store.sessions.filter((session) => session.eventId === eventId).map((session) => session.id);
    store.ticketTypes = store.ticketTypes.filter((ticketType) => !sessionIds.includes(ticketType.sessionId));
    store.sessions = store.sessions.filter((session) => session.eventId !== eventId);
    store.sessionBookings = store.sessionBookings.filter((booking) => booking.eventId !== eventId);
    return NextResponse.json({ deleted: event.id });
  }

  try {
    await deleteEventCascade(eventId, await currentStaff());
    return NextResponse.json({ deleted: eventId });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown";
    if (message === "event_not_found") return NextResponse.json({ error: "Event not found" }, { status: 404 });
    if (message === "event_has_bookings") return NextResponse.json({ error: "This event has bookings, so it cannot be deleted. Archive it instead to keep the guest records." }, { status: 409 });
    console.error("event delete failed", error);
    return NextResponse.json({ error: "The event could not be deleted." }, { status: 503 });
  }
}
