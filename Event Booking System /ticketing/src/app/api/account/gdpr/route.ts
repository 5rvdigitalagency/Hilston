import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { customerSession } from "@/lib/auth";
import { createGdprRequest } from "@/lib/db";

const schema = z.object({ requestType: z.enum(["export", "erase"]) });

export async function POST(request: Request) {
  const session = await customerSession((await cookies()).get("ticketing_customer")?.value);
  if (!session) return NextResponse.json({ error: "Customer authentication required" }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Choose an export or erase request." }, { status: 400 });
  try { return NextResponse.json({ request: await createGdprRequest({ email: session.email, requestType: parsed.data.requestType }) }, { status: 201 }); }
  catch { return NextResponse.json({ error: "Your privacy request could not be recorded." }, { status: 503 }); }
}