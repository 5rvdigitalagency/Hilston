import { NextResponse } from "next/server";
import Stripe from "stripe";
import { z } from "zod";

const checkoutSchema = z.object({
  bookingId: z.string().uuid(),
  amountPence: z.number().int().positive(),
  customerEmail: z.string().email(),
});

export async function POST(request: Request) {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) return NextResponse.json({ error: "Online payments are not configured yet" }, { status: 503 });
  const parsed = checkoutSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid checkout request" }, { status: 400 });

  const stripe = new Stripe(secretKey);
  const paymentIntent = await stripe.paymentIntents.create({
    amount: parsed.data.amountPence,
    currency: "gbp",
    receipt_email: parsed.data.customerEmail,
    metadata: { bookingId: parsed.data.bookingId },
    automatic_payment_methods: { enabled: true },
  }, { idempotencyKey: `booking-${parsed.data.bookingId}` });

  return NextResponse.json({ paymentIntentId: paymentIntent.id, clientSecret: paymentIntent.client_secret });
}
