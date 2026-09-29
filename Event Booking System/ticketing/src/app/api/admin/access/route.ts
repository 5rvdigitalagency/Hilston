import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { isStaffSession, staffSessionInfo } from "@/lib/auth";
import { createEventCategory, createRole, createStaffAccount, databaseEnabled, deleteEventCategory, listAccessControl, listStaffAccounts, resetStaffPassword, setRolePermissions, setStaffAccountStatus, setStaffDisplayName, updateEventCategory } from "@/lib/db";

const slug = z.string().trim().toLowerCase().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const categorySchema = z.object({ action: z.literal("createCategory"), name: z.string().trim().min(2).max(60), slug });
const updateCategorySchema = z.object({ action: z.literal("updateCategory"), id: z.string().uuid(), name: z.string().trim().min(2).max(60), slug, sortOrder: z.number().int().min(0).max(100000) });
const deleteCategorySchema = z.object({ action: z.literal("deleteCategory"), id: z.string().uuid() });
const roleSchema = z.object({ action: z.literal("createRole"), name: z.string().trim().min(2).max(60), permissionIds: z.array(z.string().uuid()).max(100) });
const permissionsSchema = z.object({ action: z.literal("setRolePermissions"), roleId: z.string().uuid(), permissionIds: z.array(z.string().uuid()).max(100) });
const staffNameSchema = z.object({ action: z.literal("renameStaff"), userId: z.string().uuid(), displayName: z.string().trim().min(2).max(120) });
const staffStatusSchema = z.object({ action: z.literal("setStaffStatus"), userId: z.string().uuid(), status: z.enum(["active", "disabled"]) });
const staffPasswordSchema = z.object({ action: z.literal("resetStaffPassword"), userId: z.string().uuid(), password: z.string().min(12).max(200) });
const staffSchema = z.object({ action: z.literal("createStaff"), email: z.string().email().max(254), displayName: z.string().trim().min(2).max(120), password: z.string().min(12).max(200), roleId: z.string().uuid() });

async function requireAdmin() {
  const session = (await cookies()).get("ticketing_staff")?.value;
  return isStaffSession(session, "admin.manage");
}

export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Staff authentication required" }, { status: 401 });
  if (!databaseEnabled) return NextResponse.json({ error: "Admin storage is unavailable" }, { status: 503 });
  const [access, staff, current] = await Promise.all([listAccessControl(), listStaffAccounts(), staffSessionInfo((await cookies()).get("ticketing_staff")?.value)]);
  return NextResponse.json({ ...access, staff, currentUserId: current?.userId ?? null }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: Request) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Staff authentication required" }, { status: 401 });
  if (!databaseEnabled) return NextResponse.json({ error: "Admin storage is unavailable" }, { status: 503 });
  const body = await request.json().catch(() => null);
  const parsed = z.union([categorySchema, updateCategorySchema, deleteCategorySchema, roleSchema, permissionsSchema, staffSchema, staffStatusSchema, staffPasswordSchema, staffNameSchema]).safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Please check the admin settings" }, { status: 400 });
  try {
    if (parsed.data.action === "createCategory") return NextResponse.json({ category: await createEventCategory(parsed.data) }, { status: 201 });
    if (parsed.data.action === "updateCategory") return NextResponse.json({ category: await updateEventCategory(parsed.data) });
    if (parsed.data.action === "deleteCategory") { await deleteEventCategory(parsed.data.id); return NextResponse.json({ ok: true }); }
    if (parsed.data.action === "createRole") return NextResponse.json({ role: await createRole(parsed.data) }, { status: 201 });
    if (parsed.data.action === "setStaffStatus" || parsed.data.action === "resetStaffPassword" || parsed.data.action === "renameStaff") {
      const actor = await staffSessionInfo((await cookies()).get("ticketing_staff")?.value);
      if (parsed.data.action === "renameStaff") {
        await setStaffDisplayName(parsed.data.userId, parsed.data.displayName, actor);
        return NextResponse.json({ ok: true });
      }
      if (parsed.data.action === "setStaffStatus") {
        if (parsed.data.status === "disabled" && actor?.userId === parsed.data.userId) return NextResponse.json({ error: "You cannot disable your own account." }, { status: 409 });
        await setStaffAccountStatus(parsed.data.userId, parsed.data.status, actor);
      } else {
        await resetStaffPassword(parsed.data.userId, await bcrypt.hash(parsed.data.password, 12), actor);
      }
      return NextResponse.json({ ok: true });
    }
    if (parsed.data.action === "createStaff") return NextResponse.json({ user: await createStaffAccount({ ...parsed.data, passwordHash: await bcrypt.hash(parsed.data.password, 12) }) }, { status: 201 });
    await setRolePermissions(parsed.data.roleId, parsed.data.permissionIds);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Admin update failed";
    if (message.includes("staff_not_found")) return NextResponse.json({ error: "That staff account was not found." }, { status: 404 });
    if (message.includes("role_locked")) return NextResponse.json({ error: "The Admin role is locked and always has full access." }, { status: 409 });
    if (message.includes("category_in_use")) return NextResponse.json({ error: "This classification is assigned to one or more events. Reassign those events before removing it." }, { status: 409 });
    return NextResponse.json({ error: "The admin settings could not be saved." }, { status: 503 });
  }
}