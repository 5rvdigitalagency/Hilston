import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { isStaffSession, staffSessionInfo } from "@/lib/auth";
import { cancelBooking, databaseEnabled } from "@/lib/db";

const schema = z.object({ status: z.literal("cancelled") });

export async function PATCH(request: Request, context: { params: Promise<{ bookingId: string }> }) {
  const token = (await cookies()).get("ticketing_staff")?.value;
  if ((await isStaffSession(token, "payments.manage")) === false) return NextResponse.json({ error: "You don't have permission to cancel bookings." }, { status: 403 });
  if (databaseEnabled === false) return NextResponse.json({ error: "Booking storage is unavailable." }, { status: 503 });
  const { bookingId } = await context.params;
  if (z.string().uuid().safeParse(bookingId).success === false) return NextResponse.json({ error: "Booking not found." }, { status: 404 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (parsed.success === false) return NextResponse.json({ error: "Only cancelling a booking is supported." }, { status: 400 });
  try {
    const summary = await cancelBooking(bookingId, await staffSessionInfo(token));
    const refundNeeded = summary.provider !== null && summary.provider !== "mock";
    return NextResponse.json({
      ok: true,
      ticketsReleased: summary.tickets,
      message: refundNeeded
        ? `Booking cancelled and ${summary.tickets} ${summary.tickets === 1 ? "place" : "places"} released. Refund the payment in the ${summary.provider} dashboard; refunds are not automatic yet.`
        : `Booking cancelled and ${summary.tickets} ${summary.tickets === 1 ? "place" : "places"} released.`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "booking_not_found") return NextResponse.json({ error: "Booking not found." }, { status: 404 });
    if (message === "booking_already_cancelled") return NextResponse.json({ error: "This booking is already cancelled." }, { status: 409 });
    if (message === "booking_checked_in") return NextResponse.json({ error: "A ticket on this booking has already been checked in, so it can't be cancelled." }, { status: 409 });
    console.error("booking cancel failed", error);
    return NextResponse.json({ error: "The booking could not be cancelled." }, { status: 503 });
  }
}
