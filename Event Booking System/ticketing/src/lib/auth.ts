import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { databaseEnabled, ensureBootstrapAdmin, getAccountByEmail, getStaffAuthState, recordAccountSignIn } from "./db";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const configuredSecret = process.env.APP_SESSION_SECRET;
const secret = new TextEncoder().encode(configuredSecret || "development-only-change-me");
const staffEmail = process.env.STAFF_EMAIL;
const staffPassword = process.env.STAFF_PASSWORD;

// Mirrors the full permission set the DB-backed "Admin" role receives (see database/admin-workspace.sql),
// since the env-based bootstrap account is the break-glass admin used when no database is configured.
const BOOTSTRAP_ADMIN_PERMISSIONS = [
  "events.manage", "inventory.manage", "bookings.view", "payments.manage", "check_in.manage",
  "reports.sales.view", "reports.revenue.view", "reports.forecast.view", "users.manage",
  "settings.manage", "gdpr.manage", "admin.manage", "roles.manage", "event_categories.manage",
  "tickets.history.view",
];

export function checkStaffCredentials(email: string, password: string) {
  if (!staffEmail || !staffPassword) return false;
  return email.trim().toLowerCase() === staffEmail.toLowerCase() && password === staffPassword;
}

export type StaffAccountSession = { id: string; email: string; permissionKeys: string[]; sessionVersion?: number; mustChangePassword?: boolean };

export async function createStaffSession(account?: StaffAccountSession) {
  if (!configuredSecret || !staffEmail) throw new Error("Staff authentication is not configured");
  return new SignJWT({ userId: account?.id, email: account?.email || staffEmail, permissionKeys: account?.permissionKeys || BOOTSTRAP_ADMIN_PERMISSIONS, sv: account?.sessionVersion ?? 0, mcp: account?.mustChangePassword === true })
    .setProtectedHeader({ alg: "HS256" }).setSubject("staff").setIssuedAt().setExpirationTime("8h").sign(secret);
}

export async function authenticateStaffAccount(email: string, password: string): Promise<StaffAccountSession | null> {
  if (databaseEnabled) {
    if (staffEmail && staffPassword && email.trim().toLowerCase() === staffEmail.toLowerCase() && password === staffPassword) {
      const passwordHash = await bcrypt.hash(password, 12);
      await ensureBootstrapAdmin(staffEmail, passwordHash);
    }
    const account = await getAccountByEmail(email);
    if (account?.status === "active" && account.passwordHash && await bcrypt.compare(password, account.passwordHash)) {
      const state = await getStaffAuthState(account.id);
      await recordAccountSignIn(account.id);
      return { id: account.id, email: account.email, permissionKeys: account.permissionKeys, sessionVersion: state?.sessionVersion ?? 0, mustChangePassword: state?.mustChangePassword === true };
    }
    // With a database, accounts are the only source of truth: disabling or resetting the env login must stick.
    return null;
  }
  if (checkStaffCredentials(email, password)) return { id: "bootstrap", email: staffEmail as string, permissionKeys: BOOTSTRAP_ADMIN_PERMISSIONS };
  return null;
}

export async function isStaffSession(token?: string, permission?: string) {
  if (!token) return false;
  if (!configuredSecret) return false;
  try {
    const result = await jwtVerify(token, secret);
    const permissions = Array.isArray(result.payload.permissionKeys) ? result.payload.permissionKeys : [];
    if (result.payload.sub !== "staff" || (permission && permissions.includes(permission) === false)) return false;
    if (result.payload.mcp === true) return false;
    if (databaseEnabled === false) return true;
    const userId = result.payload.userId;
    if (typeof userId !== "string" || UUID_PATTERN.test(userId) === false) return false;
    // Disabling or resetting a password bumps session_version, ending existing sessions immediately.
    const state = await getStaffAuthState(userId).catch(() => null);
    if (state === null || state.status !== "active") return false;
    return state.sessionVersion === (typeof result.payload.sv === "number" ? result.payload.sv : 0);
  } catch { return false; }
}

/** Decodes the staff JWT for display purposes (topbar identity) without asserting a specific permission. */
export async function staffSessionInfo(token?: string) {
  if (!token || !configuredSecret) return null;
  try {
    const result = await jwtVerify(token, secret);
    if (result.payload.sub !== "staff") return null;
    const permissions = Array.isArray(result.payload.permissionKeys) ? result.payload.permissionKeys.filter((key): key is string => typeof key === "string") : [];
    return { email: typeof result.payload.email === "string" ? result.payload.email : "", userId: typeof result.payload.userId === "string" ? result.payload.userId : null, isAdmin: permissions.includes("admin.manage"), permissionKeys: permissions, mustChangePassword: result.payload.mcp === true, sessionVersion: typeof result.payload.sv === "number" ? result.payload.sv : 0 };
  } catch { return null; }
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
