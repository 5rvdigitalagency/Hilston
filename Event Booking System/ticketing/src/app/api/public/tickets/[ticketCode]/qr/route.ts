import { NextResponse } from "next/server";
import QRCode from "qrcode";

// The ticket code is the bearer secret, so this renders a QR for a well-formed code only.
const TICKET_CODE = /^[A-Z0-9-]{6,40}$/;

export async function GET(_request: Request, context: { params: Promise<{ ticketCode: string }> }) {
  const { ticketCode } = await context.params;
  const code = decodeURIComponent(ticketCode || "").toUpperCase();
  if (!TICKET_CODE.test(code)) return NextResponse.json({ error: "Invalid ticket code" }, { status: 400 });
  const png = await QRCode.toBuffer(code, { type: "png", errorCorrectionLevel: "M", margin: 2, width: 360 });
  return new NextResponse(new Uint8Array(png), {
    // FR-PR-04: ticket URLs must not be cached by shared caches.
    headers: { "Content-Type": "image/png", "Cache-Control": "private, no-store", "Content-Disposition": `inline; filename="ticket-${code}.png"` },
  });
}
