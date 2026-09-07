import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { cookies } from "next/headers";
import { isStaffSession } from "@/lib/auth";

export async function GET(_request: Request, context: { params: Promise<{ ticketCode: string }> }) {
  const { ticketCode } = await context.params;
  const session = (await cookies()).get("ticketing_staff")?.value;
  if (!(await isStaffSession(session, "check_in.manage"))) return NextResponse.json({ error: "Staff authentication required" }, { status: 401 });
  if (!ticketCode || ticketCode.length > 120) return NextResponse.json({ error: "Invalid ticket code" }, { status: 400 });
  const svg = await QRCode.toString(ticketCode, { type: "svg", errorCorrectionLevel: "M", margin: 2, width: 320 });
  return new NextResponse(svg, { headers: { "Content-Type": "image/svg+xml", "Cache-Control": "private, no-store" } });
}
