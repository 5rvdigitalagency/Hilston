import { NextResponse } from "next/server";
import { checkStaffCredentials, createStaffSession } from "@/lib/auth";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body.email !== "string" || typeof body.password !== "string" || !checkStaffCredentials(body.email, body.password)) {
    return NextResponse.json({ error: "Invalid staff credentials" }, { status: 401 });
  }
  const response = NextResponse.json({ ok: true });
  response.cookies.set("ticketing_staff", await createStaffSession(), { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", maxAge: 60 * 60 * 8, path: "/" });
  return response;
}
