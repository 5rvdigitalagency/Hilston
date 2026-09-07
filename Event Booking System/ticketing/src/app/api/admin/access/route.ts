import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { isStaffSession } from "@/lib/auth";
import { createEventCategory, createRole, createStaffAccount, databaseEnabled, deleteEventCategory, listAccessControl, setRolePermissions, updateEventCategory } from "@/lib/db";

const slug = z.string().trim().toLowerCase().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const categorySchema = z.object({ action: z.literal("createCategory"), name: z.string().trim().min(2).max(60), slug });
const updateCategorySchema = z.object({ action: z.literal("updateCategory"), id: z.string().uuid(), name: z.string().trim().min(2).max(60), slug, sortOrder: z.number().int().min(0).max(100000) });
const deleteCategorySchema = z.object({ action: z.literal("deleteCategory"), id: z.string().uuid() });
const roleSchema = z.object({ action: z.literal("createRole"), name: z.string().trim().min(2).max(60), permissionIds: z.array(z.string().uuid()).max(100) });
const permissionsSchema = z.object({ action: z.literal("setRolePermissions"), roleId: z.string().uuid(), permissionIds: z.array(z.string().uuid()).max(100) });
const staffSchema = z.object({ action: z.literal("createStaff"), email: z.string().email().max(254), displayName: z.string().trim().min(2).max(120), password: z.string().min(12).max(200), roleId: z.string().uuid() });

async function requireAdmin() {
  const session = (await cookies()).get("ticketing_staff")?.value;
  return isStaffSession(session, "events.manage");
}

export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Staff authentication required" }, { status: 401 });
  if (!databaseEnabled) return NextResponse.json({ error: "Admin storage is unavailable" }, { status: 503 });
  return NextResponse.json(await listAccessControl(), { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: Request) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Staff authentication required" }, { status: 401 });
  if (!databaseEnabled) return NextResponse.json({ error: "Admin storage is unavailable" }, { status: 503 });
  const body = await request.json().catch(() => null);
  const parsed = z.union([categorySchema, updateCategorySchema, deleteCategorySchema, roleSchema, permissionsSchema, staffSchema]).safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Please check the admin settings" }, { status: 400 });
  try {
    if (parsed.data.action === "createCategory") return NextResponse.json({ category: await createEventCategory(parsed.data) }, { status: 201 });
    if (parsed.data.action === "updateCategory") return NextResponse.json({ category: await updateEventCategory(parsed.data) });
    if (parsed.data.action === "deleteCategory") { await deleteEventCategory(parsed.data.id); return NextResponse.json({ ok: true }); }
    if (parsed.data.action === "createRole") return NextResponse.json({ role: await createRole(parsed.data) }, { status: 201 });
    if (parsed.data.action === "createStaff") return NextResponse.json({ user: await createStaffAccount({ ...parsed.data, passwordHash: await bcrypt.hash(parsed.data.password, 12) }) }, { status: 201 });
    await setRolePermissions(parsed.data.roleId, parsed.data.permissionIds);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Admin update failed";
    if (message.includes("role_locked")) return NextResponse.json({ error: "The Admin role is locked and always has full access." }, { status: 409 });
    if (message.includes("category_in_use")) return NextResponse.json({ error: "This classification is assigned to one or more events. Reassign those events before removing it." }, { status: 409 });
    return NextResponse.json({ error: "The admin settings could not be saved." }, { status: 503 });
  }
}