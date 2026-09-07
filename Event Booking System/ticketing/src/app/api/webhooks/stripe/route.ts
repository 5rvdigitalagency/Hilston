import { NextResponse } from "next/server";
import Stripe from "stripe";

export async function POST(request: Request) {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secretKey || !webhookSecret) return NextResponse.json({ error: "Stripe webhooks are not configured" }, { status: 503 });

  const signature = request.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "Missing Stripe signature" }, { status: 400 });
  const stripe = new Stripe(secretKey);
  let event: Stripe.Event;
  try { event = stripe.webhooks.constructEvent(await request.text(), signature, webhookSecret); } catch { return NextResponse.json({ error: "Invalid Stripe signature" }, { status: 400 }); }

  if (event.type === "payment_intent.succeeded") {
    const paymentIntent = event.data.object as Stripe.PaymentIntent;
    const bookingId = paymentIntent.metadata.bookingId;
    if (!bookingId) return NextResponse.json({ error: "Payment is missing booking reference" }, { status: 422 });
    // TODO: In the database transaction, consume this event once, confirm the booking,
    // issue tickets, and enqueue idempotent buyer/operations notifications.
  }

  return NextResponse.json({ received: true });
}
