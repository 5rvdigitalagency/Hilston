import { SignJWT, jwtVerify } from "jose";

const secret = new TextEncoder().encode(process.env.APP_SESSION_SECRET || "development-only-change-me");
const staffEmail = process.env.STAFF_EMAIL || "staff@hilstonpark.test";
const staffPassword = process.env.STAFF_PASSWORD || "ChangeMe-OnlyForLocal-2026!";

export function checkStaffCredentials(email: string, password: string) {
  return email.trim().toLowerCase() === staffEmail.toLowerCase() && password === staffPassword;
}

export async function createStaffSession() {
  return new SignJWT({ email: staffEmail, permissionKeys: ["events.manage", "attendees.view"] })
    .setProtectedHeader({ alg: "HS256" }).setSubject("staff").setIssuedAt().setExpirationTime("8h").sign(secret);
}

export async function isStaffSession(token?: string) {
  if (!token) return false;
  try { const result = await jwtVerify(token, secret); return result.payload.sub === "staff"; } catch { return false; }
}
