import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { isStaffSession } from "@/lib/auth";
import { eventMediaMaxSize } from "@/lib/supabase";

export async function GET() {
  const token = (await cookies()).get("ticketing_staff")?.value;
  return NextResponse.json({
    authenticated: await isStaffSession(token, "events.manage"),
    mediaMaxMb: Math.floor(eventMediaMaxSize / (1024 * 1024)),
  }, { headers: { "Cache-Control": "no-store" } });
}
