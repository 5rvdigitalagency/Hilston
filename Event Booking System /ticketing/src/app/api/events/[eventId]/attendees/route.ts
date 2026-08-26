import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { isStaffSession } from "@/lib/auth";
import { addAttendee, store } from "@/lib/store";
import { z } from "zod";
import { databaseEnabled, insertAttendee, listEvents } from "@/lib/db";

const attendeeSchema = z.object({ name: z.string().trim().min(2).max(120), email: z.string().email().max(254), childCount: z.number().int().min(0).max(100) });

export async function GET(_request: Request, context: { params: Promise<{ eventId: string }> }) {
  const session = (await cookies()).get("ticketing_staff")?.value;
  if (!(await isStaffSession(session))) return NextResponse.json({ error: "Staff authentication required" }, { status: 401 });
  const { eventId } = await context.params;
  return NextResponse.json({ attendees: store.attendees.filter((attendee) => attendee.eventId === eventId) });
}

export async function POST(request: Request, context: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await context.params;
  if (databaseEnabled) {
    const event = (await listEvents()).find((item) => item.id === eventId);
    if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });
    const parsed = attendeeSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Please check attendee details" }, { status: 400 });
    if (event.attendeeCount >= event.capacity) return NextResponse.json({ error: "This event is full" }, { status: 409 });
    return NextResponse.json({ attendee: await insertAttendee({ ...parsed.data, eventId }) }, { status: 201 });
  }
  const event = store.events.find((item) => item.id === eventId && item.published);
  if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });
  const parsed = attendeeSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Please check attendee details" }, { status: 400 });
  if (event.attendeeCount >= event.capacity) return NextResponse.json({ error: "This event is full" }, { status: 409 });
  return NextResponse.json({ attendee: addAttendee({ ...parsed.data, eventId }) }, { status: 201 });
}
