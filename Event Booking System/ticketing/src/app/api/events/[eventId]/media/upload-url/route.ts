import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { isStaffSession } from "@/lib/auth";
import { eventBelongsToOrganization } from "@/lib/db";
import { createEventMediaUploadUrl, ensureEventMediaBucket } from "@/lib/supabase";

const schema = z.object({ filename: z.string().trim().min(1).max(200), contentType: z.string().trim().max(150).optional(), size: z.number().int().positive().optional() });

export async function POST(request: Request, context: { params: Promise<{ eventId: string }> }) {
  const session = (await cookies()).get("ticketing_staff")?.value;
  if (!(await isStaffSession(session, "events.manage"))) return NextResponse.json({ error: "Staff authentication required" }, { status: 401 });
  const { eventId } = await context.params;
  if (!(await eventBelongsToOrganization(eventId))) return NextResponse.json({ error: "Event not found" }, { status: 404 });

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid upload request" }, { status: 400 });

  try {
    const { limit, capped } = await ensureEventMediaBucket();
    const limitMb = Math.floor(limit / (1024 * 1024));
    if (parsed.data.size && parsed.data.size > limit) {
      const sizeMb = Math.ceil(parsed.data.size / (1024 * 1024));
      return NextResponse.json({
        error: capped
          ? `This file is ${sizeMb} MB but your Supabase storage plan only allows ${limitMb} MB per file. Upgrade the Supabase plan or raise the project's global file size limit to upload it.`
          : `This file is ${sizeMb} MB. The maximum allowed is ${limitMb} MB.`,
        limitMb,
      }, { status: 400 });
    }

    const safeName = parsed.data.filename.replace(/[^a-zA-Z0-9._-]/g, "-").slice(-120);
    const storageKey = `events/${eventId}/${crypto.randomUUID()}-${safeName}`;
    const upload = await createEventMediaUploadUrl(storageKey);
    return NextResponse.json({ ...upload, limitMb }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown";
    if (message === "storage_not_configured") return NextResponse.json({ error: "Event media storage is not configured." }, { status: 503 });
    console.error("events: upload url failed", message);
    return NextResponse.json({ error: `Upload could not be prepared: ${message}` }, { status: 503 });
  }
}
