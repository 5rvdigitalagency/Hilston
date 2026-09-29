import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { isStaffSession } from "@/lib/auth";
import { orgSettings } from "@/lib/db";
import { buildTicketPdf } from "@/lib/ticket-pdf";

export const dynamic = "force-dynamic";

// AC-15: the sample layout must carry a PREVIEW watermark that live tickets do not have.
export async function GET() {
  const session = (await cookies()).get("ticketing_staff")?.value;
  if (!(await isStaffSession(session, "events.manage"))) return NextResponse.json({ error: "Staff authentication required" }, { status: 401 });

  const org = await orgSettings();
  const pdf = await buildTicketPdf({
    org,
    eventTitle: "Sample event",
    startsAt: new Date().toISOString(),
    venue: "Sample venue",
    guestName: "Sample guest",
    ticketCodes: [`${org.ticketPrefix}-SAMPLE123456`],
    preview: true,
  });

  return new NextResponse(new Uint8Array(pdf), {
    headers: { "Content-Type": "application/pdf", "Cache-Control": "private, no-store", "Content-Disposition": 'inline; filename="ticket-preview.pdf"' },
  });
}
