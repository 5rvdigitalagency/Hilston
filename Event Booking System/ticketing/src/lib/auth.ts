import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { databaseEnabled, ensureBootstrapAdmin, getAccountByEmail, recordAccountSignIn } from "./db";

const configuredSecret = process.env.APP_SESSION_SECRET;
const secret = new TextEncoder().encode(configuredSecret || "development-only-change-me");
const staffEmail = process.env.STAFF_EMAIL;
const staffPassword = process.env.STAFF_PASSWORD;

export function checkStaffCredentials(email: string, password: string) {
  if (!staffEmail || !staffPassword) return false;
  return email.trim().toLowerCase() === staffEmail.toLowerCase() && password === staffPassword;
}

export async function createStaffSession(account?: { id: string; email: string; permissionKeys: string[] }) {
  if (!configuredSecret || !staffEmail) throw new Error("Staff authentication is not configured");
  return new SignJWT({ userId: account?.id, email: account?.email || staffEmail, permissionKeys: account?.permissionKeys || ["events.manage", "bookings.view", "check_in.manage"] })
    .setProtectedHeader({ alg: "HS256" }).setSubject("staff").setIssuedAt().setExpirationTime("8h").sign(secret);
}

export async function authenticateStaffAccount(email: string, password: string) {
  if (databaseEnabled) {
    if (staffEmail && staffPassword && email.trim().toLowerCase() === staffEmail.toLowerCase() && password === staffPassword) {
      const passwordHash = await bcrypt.hash(password, 12);
      await ensureBootstrapAdmin(staffEmail, passwordHash);
    }
    const account = await getAccountByEmail(email);
    if (account?.status === "active" && account.passwordHash && await bcrypt.compare(password, account.passwordHash)) {
      await recordAccountSignIn(account.id);
      return { id: account.id, email: account.email, permissionKeys: account.permissionKeys };
    }
  }
  if (checkStaffCredentials(email, password)) return { id: "bootstrap", email: staffEmail!, permissionKeys: ["events.manage", "bookings.view", "check_in.manage"] };
  return null;
}

export async function isStaffSession(token?: string, permission?: string) {
  if (!token) return false;
  if (!configuredSecret) return false;
  try {
    const result = await jwtVerify(token, secret);
    const permissions = Array.isArray(result.payload.permissionKeys) ? result.payload.permissionKeys : [];
    return result.payload.sub === "staff" && (!permission || permissions.includes(permission));
  } catch { return false; }
}

export async function createCustomerSession(account: { id: string; email: string; displayName: string }) {
  if (!configuredSecret) throw new Error("Account authentication is not configured");
  return new SignJWT({ email: account.email, displayName: account.displayName })
    .setProtectedHeader({ alg: "HS256" }).setSubject("customer").setIssuedAt().setExpirationTime("30d").sign(secret);
}

export async function customerSession(token?: string) {
  if (!token || !configuredSecret) return null;
  try {
    const result = await jwtVerify(token, secret);
    if (result.payload.sub !== "customer" || typeof result.payload.email !== "string" || typeof result.payload.userId === "string") return null;
    return { email: result.payload.email, displayName: typeof result.payload.displayName === "string" ? result.payload.displayName : "" };
  } catch { return null; }
}
