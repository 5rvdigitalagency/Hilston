import { NextResponse } from "next/server";
import { addEvent, ensureDemoEvent, store } from "@/lib/store";
import { isStaffSession } from "@/lib/auth";
import { cookies } from "next/headers";
import { z } from "zod";
import { databaseEnabled, insertEvent, listEvents } from "@/lib/db";

const eventSchema = z.object({
  title: z.string().trim().min(2).max(120),
  description: z.string().trim().min(2).max(2000),
  startsAt: z.string().datetime(),
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
  const staff = await isStaffSession(session);
  if (databaseEnabled) return NextResponse.json({ events: await listEvents(staff) });
  return NextResponse.json({ events: staff ? store.events : store.events.filter((event) => event.published) });
}

export async function POST(request: Request) {
  const session = (await cookies()).get("ticketing_staff")?.value;
  if (!(await isStaffSession(session))) return NextResponse.json({ error: "Staff authentication required" }, { status: 401 });
  const parsed = eventSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Please check the event details", fields: parsed.error.flatten().fieldErrors }, { status: 400 });
  if (databaseEnabled) return NextResponse.json({ event: await insertEvent(parsed.data) }, { status: 201 });
  return NextResponse.json({ event: addEvent(parsed.data) }, { status: 201 });
}
