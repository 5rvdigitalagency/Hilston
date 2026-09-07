import { NextResponse } from "next/server";
import { addEvent, ensureDemoEvent, store, updateEvent as updateStoredEvent } from "@/lib/store";
import { isStaffSession } from "@/lib/auth";
import { cookies } from "next/headers";
import { z } from "zod";
import { databaseEnabled, insertEvent, listEvents, updateEvent } from "@/lib/db";

const eventSchema = z.object({
  title: z.string().trim().min(2).max(120),
  description: z.string().trim().min(2).max(2000),
  startsAt: z.string().datetime(),
  category: z.string().trim().min(2).max(60).default("Upcoming event"),
  categoryId: z.string().uuid().optional(),
  venue: z.string().trim().min(2).max(120),
  capacity: z.number().int().positive().max(100000),
  audiencePolicy: z.enum(["general", "adult_only", "kids_only", "kids_parent_mandatory"]),
  minAge: z.number().int().min(0).max(120).optional(),
  maxAge: z.number().int().min(0).max(120).optional(),
  published: z.boolean().default(false),
});

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
  return NextResponse.json({ events: staff ? store.events : store.events.filter((event) => event.published) });
}


export async function POST(request: Request) {
  const session = (await cookies()).get("ticketing_staff")?.value;
  if (!(await isStaffSession(session, "events.manage"))) return NextResponse.json({ error: "Staff authentication required" }, { status: 401 });
  const parsed = eventSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Please check the event details", fields: parsed.error.flatten().fieldErrors }, { status: 400 });
  if (databaseEnabled) return NextResponse.json({ event: await insertEvent(parsed.data) }, { status: 201 });
  if (process.env.NODE_ENV === "production" || process.env.DEMO_MODE === "false") return NextResponse.json({ error: "Event storage is not configured. Add a valid remote DATABASE_URL before creating events." }, { status: 503 });
  return NextResponse.json({ event: addEvent(parsed.data) }, { status: 201 });
}

export async function PATCH(request: Request) {
  const session = (await cookies()).get("ticketing_staff")?.value;
  if (!(await isStaffSession(session, "events.manage"))) return NextResponse.json({ error: "Staff authentication required" }, { status: 401 });
  const body = await request.json().catch(() => null);
  const id = body && typeof body.id === "string" ? body.id : "";
  const parsed = eventSchema.safeParse(body);
  if (!id || !parsed.success) return NextResponse.json({ error: "Please check the event details", fields: parsed.success ? undefined : parsed.error.flatten().fieldErrors }, { status: 400 });
  if (databaseEnabled) {
    try {
      const event = await updateEvent(id, parsed.data);
      if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });
      return NextResponse.json({ event });
    } catch (error) {
      console.error("events: update failed", error);
      return NextResponse.json({ error: "The event could not be updated. Please try again." }, { status: 503 });
    }
  }
  if (process.env.NODE_ENV === "production" || process.env.DEMO_MODE === "false") return NextResponse.json({ error: "Event storage is not configured. Add a valid remote DATABASE_URL before editing events." }, { status: 503 });
  const event = updateStoredEvent(id, parsed.data);
  if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });
  return NextResponse.json({ event });
}
