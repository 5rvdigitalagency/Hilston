import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { isStaffSession } from "@/lib/auth";
import { getOperationsReport } from "@/lib/db";

export async function GET() {
  const session = (await cookies()).get("ticketing_staff")?.value;
  if (!(await isStaffSession(session, "reports.sales.view"))) return NextResponse.json({ error: "Sales-report permission required" }, { status: 403 });
  try { return NextResponse.json(await getOperationsReport(), { headers: { "Cache-Control": "private, no-store" } }); }
  catch { return NextResponse.json({ error: "Reports are unavailable" }, { status: 503 }); }
}