import { NextResponse } from "next/server";
import { authenticateStaffAccount, createStaffSession } from "@/lib/auth";
import { databaseEnabled, loginLockState, recordLoginAttempt, writeAuditLog } from "@/lib/db";
import { requestIp } from "@/lib/rate-limit";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body.email !== "string" || typeof body.password !== "string") {
    return NextResponse.json({ error: "Invalid staff credentials" }, { status: 401 });
  }
  const ip = requestIp(request);
  if (databaseEnabled) {
    const lock = await loginLockState("staff", body.email, ip).catch((error) => { console.error("login lock check failed", error); return { locked: false, retryAfterSeconds: 0 }; });
    if (lock.locked) {
      const minutes = Math.ceil(lock.retryAfterSeconds / 60);
      return NextResponse.json({ error: `Too many unsuccessful sign-in attempts. Try again in ${minutes} ${minutes === 1 ? "minute" : "minutes"}.` }, { status: 429, headers: { "Retry-After": String(lock.retryAfterSeconds) } });
    }
  }
  try {
    const account = await authenticateStaffAccount(body.email, body.password);
    if (databaseEnabled) {
      await recordLoginAttempt("staff", body.email, ip, Boolean(account)).catch((error) => console.error("login attempt log failed", error));
      if (account === null) {
        const after = await loginLockState("staff", body.email, ip).catch(() => ({ locked: false, retryAfterSeconds: 0, reason: null }));
        if (after.locked) await writeAuditLog("staff.login_locked", { staff: body.email.trim().toLowerCase(), ip, reason: after.reason }).catch(() => undefined);
      }
    }
    if (!account) return NextResponse.json({ error: "Invalid staff credentials" }, { status: 401 });
    const response = NextResponse.json({ ok: true, mustChangePassword: account.mustChangePassword === true });
    response.cookies.set("ticketing_staff", await createStaffSession(account), { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", maxAge: 60 * 60 * 8, path: "/" });
    return response;
  } catch {
    return NextResponse.json({ error: "Staff authentication is not configured" }, { status: 503 });
  }
}
