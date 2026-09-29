import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { createStaffSession, staffSessionInfo } from "@/lib/auth";
import { changeOwnPassword, databaseEnabled, getAccountByEmail, getStaffAuthState } from "@/lib/db";

const schema = z.object({ currentPassword: z.string().min(1).max(200), newPassword: z.string().min(12).max(200) });

export async function POST(request: Request) {
  if (databaseEnabled === false) return NextResponse.json({ error: "Password changes need the staff database." }, { status: 503 });
  const session = await staffSessionInfo((await cookies()).get("ticketing_staff")?.value);
  if (session === null || typeof session.userId !== "string") return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (parsed.success === false) return NextResponse.json({ error: "Your new password must be at least 12 characters." }, { status: 400 });
  if (parsed.data.newPassword === parsed.data.currentPassword) return NextResponse.json({ error: "Choose a password that is different from your current one." }, { status: 400 });
  const state = await getStaffAuthState(session.userId).catch(() => null);
  if (state === null || state.status !== "active" || state.sessionVersion !== session.sessionVersion) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
  const account = await getAccountByEmail(session.email);
  const currentOk = account !== null && account.id === session.userId && typeof account.passwordHash === "string" && await bcrypt.compare(parsed.data.currentPassword, account.passwordHash);
  if (currentOk === false || account === null) return NextResponse.json({ error: "Your current password is not correct." }, { status: 401 });
  const sessionVersion = await changeOwnPassword(account.id, await bcrypt.hash(parsed.data.newPassword, 12));
  const response = NextResponse.json({ ok: true });
  response.cookies.set("ticketing_staff", await createStaffSession({ id: account.id, email: account.email, permissionKeys: account.permissionKeys, sessionVersion, mustChangePassword: false }), { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", maxAge: 60 * 60 * 8, path: "/" });
  return response;
}
