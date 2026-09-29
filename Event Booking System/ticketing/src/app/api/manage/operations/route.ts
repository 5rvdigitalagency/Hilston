import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { isStaffSession } from "@/lib/auth";
import { databaseEnabled, getOperationsReport } from "@/lib/db";
import { store } from "@/lib/store";

export async function GET() {
  const session = (await cookies()).get("ticketing_staff")?.value;
  if (!(await isStaffSession(session, "reports.sales.view"))) return NextResponse.json({ error: "Sales-report permission required" }, { status: 403 });
  if (!databaseEnabled) {
    const publishedEvents = store.events.filter((event) => event.published && !event.archived).length;
    return NextResponse.json({ sales: { bookings: 0, current_revenue_pence: 0, projected_revenue_pence: 0 }, publishedEvents, activity: [] }, { headers: { "Cache-Control": "private, no-store" } });
  }
  try { return NextResponse.json(await getOperationsReport(), { headers: { "Cache-Control": "private, no-store" } }); }
  catch { return NextResponse.json({ error: "Reports are unavailable" }, { status: 503 }); }
}