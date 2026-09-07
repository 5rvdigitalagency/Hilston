import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { isStaffSession } from "@/lib/auth";
import { databaseEnabled, listEventCategories } from "@/lib/db";

export async function GET() {
  const session = (await cookies()).get("ticketing_staff")?.value;
  if (!(await isStaffSession(session, "events.manage"))) return NextResponse.json({ error: "Staff authentication required" }, { status: 401 });
  if (!databaseEnabled) return NextResponse.json({ categories: [] });
  return NextResponse.json({ categories: await listEventCategories() });
}