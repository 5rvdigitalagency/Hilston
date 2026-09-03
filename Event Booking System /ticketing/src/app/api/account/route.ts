import { NextResponse } from "next/server";
import { cookies, headers } from "next/headers";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { createCustomerAccount, getAccountByEmail, isBlockedEmailDomain, logRegistrationAttempt } from "@/lib/db";
import { createCustomerSession, customerSession } from "@/lib/auth";

const signUpSchema = z.object({ action: z.literal("signup"), displayName: z.string().trim().min(2).max(120), email: z.string().email().max(254), password: z.string().min(12).max(200) });
const signInSchema = z.object({ action: z.literal("signin"), email: z.string().email().max(254), password: z.string().min(1).max(200) });

export async function GET() {
  const session = await customerSession((await cookies()).get("ticketing_customer")?.value);
  return NextResponse.json({ authenticated: Boolean(session), account: session }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = z.union([signUpSchema, signInSchema]).safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Please check your account details." }, { status: 400 });
  try {
    let account;
    if (parsed.data.action === "signup") {
      const requestHeaders = await headers();
      const signupIp = requestHeaders.get("x-forwarded-for");
      const userAgent = requestHeaders.get("user-agent");

      if (await isBlockedEmailDomain(parsed.data.email)) {
        await logRegistrationAttempt({ email: parsed.data.email, ip: signupIp, userAgent, reason: "blocked_email_domain" });
        return NextResponse.json({ error: "This email provider is not accepted. Please use a permanent email address." }, { status: 422 });
      }

      const existing = await getAccountByEmail(parsed.data.email);
      if (existing) {
        await logRegistrationAttempt({ email: parsed.data.email, ip: signupIp, userAgent, reason: "duplicate_email" });
        return NextResponse.json({ error: "An account already exists for this email." }, { status: 409 });
      }
      account = await createCustomerAccount({ email: parsed.data.email, displayName: parsed.data.displayName, passwordHash: await bcrypt.hash(parsed.data.password, 12) });
    } else {
      const existing = await getAccountByEmail(parsed.data.email);
      if (!existing?.passwordHash || existing.status !== "active" || !(await bcrypt.compare(parsed.data.password, existing.passwordHash))) return NextResponse.json({ error: "Email or password was not recognised." }, { status: 401 });
      account = { id: existing.id, email: existing.email, displayName: existing.displayName || "Customer" };
    }
    const response = NextResponse.json({ account: { email: account.email, displayName: account.displayName } });
    response.cookies.set("ticketing_customer", await createCustomerSession(account), { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", maxAge: 60 * 60 * 24 * 30, path: "/" });
    return response;
  } catch {
    return NextResponse.json({ error: "The account could not be created." }, { status: 503 });
  }
}