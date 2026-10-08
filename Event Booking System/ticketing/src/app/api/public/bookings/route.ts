import { NextResponse } from "next/server";
import { z } from "zod";
import { createMockBooking, databaseEnabled } from "@/lib/db";
import { deliverBookingEmails, emailEnabled } from "@/lib/booking-delivery";
import { publicEventsCorsHeaders, publicEventsFeedAuthorized } from "@/lib/event-publishing";

const bookingSchema = z.object({ eventId: z.string().uuid(), name: z.string().trim().min(2).max(120), email: z.string().email().max(254), childCount: z.number().int().min(0).max(100), paymentMode: z.literal("test") });

export async function OPTIONS(request: Request) {
  return new NextResponse(null, { status: 204, headers: publicEventsCorsHeaders(request, "POST, OPTIONS") });
}

export async function POST(request: Request) {
  const corsHeaders = publicEventsCorsHeaders(request, "POST, OPTIONS");
  if (!publicEventsFeedAuthorized(request)) return NextResponse.json({ error: "Booking service unavailable." }, { status: 404, headers: corsHeaders });
  if (!databaseEnabled) return NextResponse.json({ error: "Booking storage is unavailable." }, { status: 503, headers: corsHeaders });
  const parsed = bookingSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Please check the booking details." }, { status: 400, headers: corsHeaders });
  try {
    const staffEmail = process.env.STAFF_EMAIL;
    const booking = await createMockBooking({ ...parsed.data, staffEmail });
    const delivery = emailEnabled ? await deliverBookingEmails(booking.bookingId, staffEmail) : { emailed: false as const };
    const notifications = !emailEnabled ? "not_configured" : delivery.emailed ? "sent" : "failed";
    return NextResponse.json({ booking, notifications }, { status: 201, headers: corsHeaders });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Booking could not be confirmed";
    if (message.includes("event_not_found")) return NextResponse.json({ error: "This event is no longer available." }, { status: 404, headers: corsHeaders });
    if (message.includes("event_full")) return NextResponse.json({ error: "This event no longer has enough spaces for this booking." }, { status: 409, headers: corsHeaders });
    console.error("public booking failed", error);
    return NextResponse.json({ error: "Booking could not be confirmed. Please try again." }, { status: 503, headers: corsHeaders });
  }
}