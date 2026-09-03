import { NextResponse } from "next/server";
import { authenticateStaffAccount, createStaffSession } from "@/lib/auth";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body.email !== "string" || typeof body.password !== "string") {
    return NextResponse.json({ error: "Invalid staff credentials" }, { status: 401 });
  }
  try {
    const account = await authenticateStaffAccount(body.email, body.password);
    if (!account) return NextResponse.json({ error: "Invalid staff credentials" }, { status: 401 });
    const response = NextResponse.json({ ok: true });
    response.cookies.set("ticketing_staff", await createStaffSession(account), { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", maxAge: 60 * 60 * 8, path: "/" });
    return response;
  } catch {
    return NextResponse.json({ error: "Staff authentication is not configured" }, { status: 503 });
  }
}
