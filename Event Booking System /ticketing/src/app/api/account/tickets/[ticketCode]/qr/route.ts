import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import QRCode from "qrcode";
import { customerSession } from "@/lib/auth";
import { customerOwnsTicket } from "@/lib/db";

export async function GET(_request: Request, context: { params: Promise<{ ticketCode: string }> }) {
  const session = await customerSession((await cookies()).get("ticketing_customer")?.value);
  if (!session) return NextResponse.json({ error: "Customer authentication required" }, { status: 401 });
  const { ticketCode } = await context.params;
  if (!ticketCode || ticketCode.length > 120 || !(await customerOwnsTicket(session.email, ticketCode))) return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
  const svg = await QRCode.toString(ticketCode, { type: "svg", errorCorrectionLevel: "M", margin: 2, width: 320 });
  return new NextResponse(svg, { headers: { "Content-Type": "image/svg+xml", "Cache-Control": "private, no-store" } });
}