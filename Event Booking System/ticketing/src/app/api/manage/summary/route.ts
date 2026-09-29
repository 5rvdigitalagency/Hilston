import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { isStaffSession } from "@/lib/auth";
import { databaseEnabled, listEventSubmissions } from "@/lib/db";

const demoGuests = [
  { name: "Demo Guest", email: "demo@example.com", event: "Demo event - not for sale", tickets: 3, paid: true, attending: "Confirmed" },
  { name: "Alex Morgan", email: "alex@example.com", event: "Demo event - not for sale", tickets: 2, paid: false, attending: "Awaiting reply" },
];

export async function GET() {
  const token = (await cookies()).get("ticketing_staff")?.value;
  if (!(await isStaffSession(token, "events.manage"))) return NextResponse.json({ error: "Staff authentication required" }, { status: 401 });
  if (databaseEnabled) {
    try { return NextResponse.json({ guests: await listEventSubmissions() }, { headers: { "Cache-Control": "private, no-store" } }); }
    catch { return NextResponse.json({ error: "Submissions are unavailable" }, { status: 503 }); }
  }
  return NextResponse.json({ guests: demoGuests }, { headers: { "Cache-Control": "private, no-store" } });
}
