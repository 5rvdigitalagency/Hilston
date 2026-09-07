import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { isStaffSession } from "@/lib/auth";
import { store } from "@/lib/store";
import { databaseEnabled, deleteEventCascade, setEventArchived } from "@/lib/db";

const patchSchema = z.object({ archived: z.boolean() });

async function requireStaff() {
  const session = (await cookies()).get("ticketing_staff")?.value;
  return isStaffSession(session, "events.manage");
}

export async function PATCH(request: Request, context: { params: Promise<{ eventId: string }> }) {
  if (!(await requireStaff())) return NextResponse.json({ error: "Staff authentication required" }, { status: 401 });
  const { eventId } = await context.params;
  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Set archived to true or false." }, { status: 400 });

  if (!databaseEnabled) {
    const event = store.events.find((item) => item.id === eventId);
    if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });
    event.archived = parsed.data.archived;
    if (parsed.data.archived) event.published = false;
    return NextResponse.json({ event });
  }

  try {
    await setEventArchived(eventId, parsed.data.archived);
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
    return NextResponse.json({ deleted: event.id });
  }

  try {
    await deleteEventCascade(eventId);
    return NextResponse.json({ deleted: eventId });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown";
    if (message === "event_not_found") return NextResponse.json({ error: "Event not found" }, { status: 404 });
    if (message === "event_has_bookings") return NextResponse.json({ error: "This event has bookings, so it cannot be deleted. Archive it instead to keep the guest records." }, { status: 409 });
    console.error("event delete failed", error);
    return NextResponse.json({ error: "The event could not be deleted." }, { status: 503 });
  }
}
