import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { isStaffSession } from "@/lib/auth";
import { store } from "@/lib/store";

export async function DELETE(_request: Request, context: { params: Promise<{ eventId: string }> }) {
  const session = (await cookies()).get("ticketing_staff")?.value;
  if (!(await isStaffSession(session))) return NextResponse.json({ error: "Staff authentication required" }, { status: 401 });
  const { eventId } = await context.params;
  const index = store.events.findIndex((event) => event.id === eventId);
  if (index < 0) return NextResponse.json({ error: "Event not found" }, { status: 404 });
  const [event] = store.events.splice(index, 1);
  store.attendees = store.attendees.filter((attendee) => attendee.eventId !== eventId);
  return NextResponse.json({ deleted: event.id });
}
