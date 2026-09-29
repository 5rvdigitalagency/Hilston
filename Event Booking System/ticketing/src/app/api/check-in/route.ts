import { NextResponse } from "next/server";
import { cookies, headers } from "next/headers";
import { isStaffSession, staffSessionInfo } from "@/lib/auth";
import { checkInTicket as checkInMemory, ensureDemoTickets } from "@/lib/store";
import { checkInTicket as checkInDatabase, databaseEnabled, ensureStaffUser, getTicketScanDetails } from "@/lib/db";
import { z } from "zod";
import { checkInKey } from "@/lib/rate-limit";
import { checkDatabaseRateLimit } from "@/lib/db";

const schema = z.object({ ticketCode: z.string().trim().min(4).max(120), sessionId: z.string().uuid().optional() });

export async function POST(request: Request) {
  const session = (await cookies()).get("ticketing_staff")?.value;
  if (!(await isStaffSession(session, "check_in.manage"))) return NextResponse.json({ error: "Staff authentication required" }, { status: 401 });
  const staff = await staffSessionInfo(session);
  const rate = await checkDatabaseRateLimit(checkInKey(staff?.userId || staff?.email || "bootstrap"), 120, 60 * 1000);
  if (!rate.allowed) return NextResponse.json({ error: "Too many check-in attempts. Please try again shortly." }, { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter a ticket code" }, { status: 400 });
  if (parsed.data.sessionId && databaseEnabled) {
    const scan = await getTicketScanDetails(parsed.data.ticketCode);
    if (scan && scan.sessionId !== parsed.data.sessionId) {
      return NextResponse.json({
        error: "This ticket is for a different event session.",
        mismatch: true,
        eventTitle: scan.eventTitle,
        sessionStartsAt: scan.sessionStartsAt,
      }, { status: 409 });
    }
  }
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
    return NextResponse.json({ ok: true, ticket, guestName: scan?.guestName, eventTitle: scan?.eventTitle, sessionStartsAt: scan?.sessionStartsAt });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Check-in failed";
    if (message.includes("ticket_not_found")) return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    if (message.includes("ticket_cancelled")) return NextResponse.json({ error: "This ticket belongs to a cancelled booking. Do not admit." }, { status: 409 });
    if (message.includes("ticket_already_checked_in")) {
      const scan = await getTicketScanDetails(parsed.data.ticketCode).catch(() => null);
      return NextResponse.json({
        error: "This ticket has already been checked in",
        firstScannedAt: scan?.checkedInAt,
        scannedBy: scan?.scannedBy,
        guestName: scan?.guestName,
        eventTitle: scan?.eventTitle,
        sessionStartsAt: scan?.sessionStartsAt,
      }, { status: 409 });
    }
    return NextResponse.json({ error: "Check-in failed" }, { status: 500 });
  }
}
