import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { isStaffSession } from "@/lib/auth";
import { addAttendee, store } from "@/lib/store";
import { z } from "zod";
import { databaseEnabled, insertAttendee, listEvents } from "@/lib/db";

const attendeeSchema = z.object({ name: z.string().trim().min(2).max(120), email: z.string().email().max(254), childCount: z.number().int().min(0).max(100) });
const CORS = { "Access-Control-Allow-Origin": "https://hilston-park.vercel.app", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type" };

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function GET(_request: Request, context: { params: Promise<{ eventId: string }> }) {
  const session = (await cookies()).get("ticketing_staff")?.value;
  if (!(await isStaffSession(session, "bookings.view"))) return NextResponse.json({ error: "Staff authentication required" }, { status: 401 });
  const { eventId } = await context.params;
  return NextResponse.json({ attendees: store.attendees.filter((attendee) => attendee.eventId === eventId) });
}

export async function POST(request: Request, context: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await context.params;
  if (databaseEnabled) {
    const event = (await listEvents()).find((item) => item.id === eventId);
    if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404, headers: CORS });
    const parsed = attendeeSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Please check attendee details" }, { status: 400, headers: CORS });
    if (event.attendeeCount + event.childCount + parsed.data.childCount + 1 > event.capacity) return NextResponse.json({ error: "This event is full" }, { status: 409, headers: CORS });
    return NextResponse.json({ attendee: await insertAttendee({ ...parsed.data, eventId }) }, { status: 201, headers: CORS });
  }
  const event = store.events.find((item) => item.id === eventId && item.published);
  if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404, headers: CORS });
  const parsed = attendeeSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Please check attendee details" }, { status: 400, headers: CORS });
  if (event.attendeeCount + event.childCount + parsed.data.childCount + 1 > event.capacity) return NextResponse.json({ error: "This event is full" }, { status: 409, headers: CORS });
  return NextResponse.json({ attendee: addAttendee({ ...parsed.data, eventId }) }, { status: 201, headers: CORS });
}
