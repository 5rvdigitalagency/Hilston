import { NextResponse } from "next/server";
import { cookies, headers } from "next/headers";
import { isStaffSession } from "@/lib/auth";
import { checkInTicket as checkInMemory, ensureDemoTickets } from "@/lib/store";
import { checkInTicket as checkInDatabase, databaseEnabled, ensureStaffUser, getTicketScanDetails } from "@/lib/db";
import { z } from "zod";

const schema = z.object({ ticketCode: z.string().trim().min(4).max(120) });

export async function POST(request: Request) {
  const session = (await cookies()).get("ticketing_staff")?.value;
  if (!(await isStaffSession(session, "check_in.manage"))) return NextResponse.json({ error: "Staff authentication required" }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter a ticket code" }, { status: 400 });
  if (parsed.data.ticketCode.toUpperCase().startsWith("DEMO-") || !databaseEnabled || process.env.DEMO_MODE !== "false") {
    ensureDemoTickets();
    const result = checkInMemory(parsed.data.ticketCode);
    return result.ok ? NextResponse.json({ ok: true, ticket: result.ticket }) : NextResponse.json({ error: result.error }, { status: 409 });
  }
  const staffEmail = process.env.STAFF_EMAIL;
  if (!staffEmail) return NextResponse.json({ error: "Staff identity is not configured" }, { status: 503 });
  try {
    const requestHeaders = await headers();
    const staffUserId = await ensureStaffUser(staffEmail);
    const ticket = await checkInDatabase(parsed.data.ticketCode, staffUserId, requestHeaders.get("x-forwarded-for"), requestHeaders.get("user-agent"));
    const scan = await getTicketScanDetails(parsed.data.ticketCode);
    return NextResponse.json({ ok: true, ticket, guestName: scan?.guestName, eventTitle: scan?.eventTitle });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Check-in failed";
    if (message.includes("ticket_not_found")) return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    if (message.includes("ticket_already_checked_in")) {
      const scan = await getTicketScanDetails(parsed.data.ticketCode).catch(() => null);
      return NextResponse.json({
        error: "This ticket has already been checked in",
        firstScannedAt: scan?.checkedInAt,
        scannedBy: scan?.scannedBy,
        guestName: scan?.guestName,
        eventTitle: scan?.eventTitle,
      }, { status: 409 });
    }
    return NextResponse.json({ error: "Check-in failed" }, { status: 500 });
  }
}
