import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { isStaffSession, staffSessionInfo } from "@/lib/auth";
import { eventMediaMaxSize } from "@/lib/supabase";

export async function GET() {
  const token = (await cookies()).get("ticketing_staff")?.value;
  const info = await staffSessionInfo(token);
  return NextResponse.json({
    authenticated: await isStaffSession(token, "events.manage"),
    mediaMaxMb: Math.floor(eventMediaMaxSize / (1024 * 1024)),
    email: info?.email || "",
    isAdmin: info?.isAdmin ?? false,
  }, { headers: { "Cache-Control": "no-store" } });
}
