import { NextResponse } from "next/server";
import { addEvent, computeDemoEventStatus, ensureDemoEvent, store, updateEvent as updateStoredEvent } from "@/lib/store";
import { isStaffSession, staffSessionInfo } from "@/lib/auth";
import { cookies } from "next/headers";
import { eventInputSchema, eventIssues, zodIssues, type ValidationIssue } from "@/lib/event-validation";
import { databaseEnabled, insertEvent, listEvents, updateEvent } from "@/lib/db";
import { eventPublishingEnabled } from "@/lib/event-publishing";

function invalid(issues: ValidationIssue[]) {
  const first = issues[0];
  return NextResponse.json({ error: first?.message || "Please check the event details", field: first?.field, step: first?.step, issues }, { status: 400 });
}

export async function GET() {
  ensureDemoEvent();
  const session = (await cookies()).get("ticketing_staff")?.value;
  const staff = await isStaffSession(session, "events.manage");
  if (databaseEnabled) {
    try { return NextResponse.json({ events: await listEvents(staff) }); }
    catch {
      if (process.env.DEMO_MODE === "false") return NextResponse.json({ error: "Event catalogue unavailable" }, { status: 503 });
    }
  }
  const visibleEvents = staff ? store.events : store.events.filter((event) => event.published);
  return NextResponse.json({ events: visibleEvents.map((event) => ({ ...event, status: computeDemoEventStatus(event) })) });
}


export async function POST(request: Request) {
  const session = (await cookies()).get("ticketing_staff")?.value;
  if (!(await isStaffSession(session, "events.manage"))) return NextResponse.json({ error: "Staff authentication required" }, { status: 401 });
  const parsed = eventInputSchema.safeParse(await request.json().catch(() => null));
  if (parsed.success === false) return invalid(zodIssues(parsed.error));
  const issues = eventIssues(parsed.data, { requireFuture: true });
  if (issues.length) return invalid(issues);
  if (parsed.data.published && !eventPublishingEnabled()) {
    return NextResponse.json({ error: "Publishing is disabled while the event system is in testing." }, { status: 403 });
  }
  if (databaseEnabled) {
    try {
      return NextResponse.json({ event: await insertEvent(parsed.data, await staffSessionInfo(session)) }, { status: 201 });
    } catch (error) {
      if (error instanceof Error && error.message === "publish_requires_schedule") return NextResponse.json({ error: "Add at least one ticket type before publishing this event." }, { status: 409 });
      console.error("events: create failed", error);
      return NextResponse.json({ error: "The event could not be created. Please try again." }, { status: 503 });
    }
  }
  if (process.env.NODE_ENV === "production" || process.env.DEMO_MODE === "false") return NextResponse.json({ error: "Event storage is not configured. Add a valid remote DATABASE_URL before creating events." }, { status: 503 });
  return NextResponse.json({ event: addEvent(parsed.data) }, { status: 201 });
}

export async function PATCH(request: Request) {
  const session = (await cookies()).get("ticketing_staff")?.value;
  if (!(await isStaffSession(session, "events.manage"))) return NextResponse.json({ error: "Staff authentication required" }, { status: 401 });
  const body = await request.json().catch(() => null);
  const id = body && typeof body.id === "string" ? body.id : "";
  const parsed = eventInputSchema.safeParse(body);
  if (!id) return NextResponse.json({ error: "Event id is required" }, { status: 400 });
  if (parsed.success === false) return invalid(zodIssues(parsed.error));
  const existingEvents = databaseEnabled ? await listEvents(true).catch(() => []) : store.events;
  const existingEvent = existingEvents.find((event) => event.id === id);
  if (!existingEvent) return NextResponse.json({ error: "Event not found" }, { status: 404 });
  const dateChanged = new Date(existingEvent.startsAt).getTime() !== new Date(parsed.data.startsAt).getTime();
  // Unchanged past dates stay editable; only a moved date must be in the future.
  const issues = eventIssues(parsed.data, { requireFuture: dateChanged });
  if (issues.length) return invalid(issues);
  const validatedEvent = parsed.data;
  if (validatedEvent.published && !eventPublishingEnabled()) {
    return NextResponse.json({ error: "Publishing is disabled while the event system is in testing." }, { status: 403 });
  }
  if (databaseEnabled) {
    try {
      const event = await updateEvent(id, validatedEvent, await staffSessionInfo(session));
      if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });
      return NextResponse.json({ event });
    } catch (error) {
      if (error instanceof Error && error.message === "event_schedule_locked") return NextResponse.json({ error: "This event already has bookings, so its schedule and ticket types cannot be replaced." }, { status: 409 });
      if (error instanceof Error && error.message === "publish_requires_schedule") return NextResponse.json({ error: "Add at least one future session with a ticket type before publishing this event." }, { status: 409 });
      console.error("events: update failed", error);
      return NextResponse.json({ error: "The event could not be updated. Please try again." }, { status: 503 });
    }
  }
  if (process.env.NODE_ENV === "production" || process.env.DEMO_MODE === "false") return NextResponse.json({ error: "Event storage is not configured. Add a valid remote DATABASE_URL before editing events." }, { status: 503 });
  const event = updateStoredEvent(id, validatedEvent);
  if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });
  return NextResponse.json({ event });
}
