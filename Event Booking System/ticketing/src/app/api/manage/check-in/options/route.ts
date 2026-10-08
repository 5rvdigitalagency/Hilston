import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { isStaffSession } from "@/lib/auth";
import { databaseEnabled, listEventSchedules, listEvents } from "@/lib/db";
import { computeDemoEventStatus, listStoreEventSchedules, store } from "@/lib/store";

type CheckInOption = {
  id: string;
  title: string;
  sessions: { id: string; startsAt: string; endsAt: string | null }[];
};

export async function GET() {
  const session = (await cookies()).get("ticketing_staff")?.value;
  if (!(await isStaffSession(session, "check_in.manage"))) {
    return NextResponse.json({ error: "Staff authentication required" }, { status: 401 });
  }

  try {
    const events = databaseEnabled
      ? (await listEvents(true)).filter((event) => !event.archived && !event.cancelled)
      : store.events.filter((event) => {
        const status = event.status ?? computeDemoEventStatus(event);
        return status !== "archived" && status !== "cancelled";
      });
    const eventIds = events.map((event) => event.id);
    const schedules = databaseEnabled ? await listEventSchedules(eventIds) : listStoreEventSchedules(eventIds);
    const options: CheckInOption[] = events.map((event) => ({
      id: event.id,
      title: event.title,
      sessions: (schedules[event.id] || []).map((session) => ({ id: session.id, startsAt: session.startsAt, endsAt: session.endsAt })),
    })).filter((event) => event.sessions.length > 0);
    return NextResponse.json({ options });
  } catch {
    return NextResponse.json({ error: "Check-in options are unavailable." }, { status: 503 });
  }
}
