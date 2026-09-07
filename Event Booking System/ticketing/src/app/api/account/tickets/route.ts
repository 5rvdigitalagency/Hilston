import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { customerSession } from "@/lib/auth";
import { listCustomerTickets } from "@/lib/db";

export async function GET() {
  const session = await customerSession((await cookies()).get("ticketing_customer")?.value);
  if (!session) return NextResponse.json({ error: "Customer authentication required" }, { status: 401 });
  return NextResponse.json({ tickets: await listCustomerTickets(session.email) }, { headers: { "Cache-Control": "private, no-store" } });
}