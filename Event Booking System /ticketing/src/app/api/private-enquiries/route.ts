import { NextResponse } from "next/server";
import { z } from "zod";

const enquirySchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().email().max(254),
  eventType: z.enum(["Corporate event", "School trip", "Wedding or private party", "Group accommodation"]),
  message: z.string().trim().min(10).max(4000),
  consent: z.literal(true),
});

const enquiries: Array<{ id: string; name: string; email: string; eventType: string; message: string; createdAt: string }> = [];

export async function POST(request: Request) {
  const parsed = enquirySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Please complete every enquiry field and accept consent." }, { status: 400 });
  const enquiry = { id: crypto.randomUUID(), ...parsed.data, createdAt: new Date().toISOString() };
  enquiries.push(enquiry);
  return NextResponse.json({ enquiry: { id: enquiry.id, createdAt: enquiry.createdAt }, message: "Your enquiry has been received." }, { status: 201 });
}
