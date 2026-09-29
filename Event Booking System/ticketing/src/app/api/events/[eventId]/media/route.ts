import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { isStaffSession } from "@/lib/auth";
import { addEventMedia, eventBelongsToOrganization, listEventMedia } from "@/lib/db";
import { createEventMediaUrl, ensureEventMediaBucket, eventMediaBucket, eventMediaMaxSize, supabaseAdmin } from "@/lib/supabase";

const registerSchema = z.object({ storageKey: z.string().trim().min(1).max(400), contentType: z.string().trim().max(150).optional() });

async function requireStaffEvent(eventId: string) {
  const session = (await cookies()).get("ticketing_staff")?.value;
  if (!(await isStaffSession(session, "events.manage"))) return { error: NextResponse.json({ error: "Staff authentication required" }, { status: 401 }) };
  if (!(await eventBelongsToOrganization(eventId))) return { error: NextResponse.json({ error: "Event not found" }, { status: 404 }) };
  return { error: null };
}

export async function GET(_request: Request, context: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await context.params;
  const guard = await requireStaffEvent(eventId);
  if (guard.error) return guard.error;
  const media = await listEventMedia(eventId);
  const items = await Promise.all(media.map(async (item) => ({ storageKey: item.storageKey, contentType: item.contentType, url: await createEventMediaUrl(item.storageKey) })));
  return NextResponse.json({ media: items });
}

export async function POST(request: Request, context: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await context.params;
  const guard = await requireStaffEvent(eventId);
  if (guard.error) return guard.error;
  if (!supabaseAdmin) return NextResponse.json({ error: "Event media storage is not configured." }, { status: 503 });

  // Direct-to-storage uploads register themselves here with a storage key instead of file bytes.
  if ((request.headers.get("content-type") || "").includes("application/json")) {
    const parsed = registerSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Invalid media registration" }, { status: 400 });
    if (!parsed.data.storageKey.startsWith(`events/${eventId}/`)) return NextResponse.json({ error: "Invalid media location" }, { status: 400 });
    const stored = await supabaseAdmin.storage.from(eventMediaBucket).list(`events/${eventId}`, { search: parsed.data.storageKey.split("/").pop() });
    if (stored.error || !stored.data?.length) return NextResponse.json({ error: "The uploaded file could not be found in storage." }, { status: 409 });
    await addEventMedia(eventId, parsed.data.storageKey, parsed.data.contentType || "application/octet-stream");
    return NextResponse.json({ media: [{ storageKey: parsed.data.storageKey, url: await createEventMediaUrl(parsed.data.storageKey), contentType: parsed.data.contentType }] }, { status: 201 });
  }

  const form = await request.formData().catch(() => null);
  const files = form?.getAll("files").filter((value): value is File => value instanceof File) ?? [];
  if (!files.length) return NextResponse.json({ error: "Choose at least one image or video." }, { status: 400 });
  if (files.some((file) => file.size > eventMediaMaxSize)) return NextResponse.json({ error: `Files must be smaller than ${Math.floor(eventMediaMaxSize / (1024 * 1024))} MB.` }, { status: 400 });

  try {
    await ensureEventMediaBucket();
    const media = [];
    for (const file of files) {
      const filename = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
      const storageKey = `events/${eventId}/${crypto.randomUUID()}-${filename}`;
      const uploaded = await supabaseAdmin.storage.from(eventMediaBucket).upload(storageKey, file, { contentType: file.type, upsert: false });
      if (uploaded.error) throw uploaded.error;
      await addEventMedia(eventId, storageKey, file.type || "application/octet-stream");
      media.push({ storageKey, url: await createEventMediaUrl(storageKey), contentType: file.type });
    }
    return NextResponse.json({ media }, { status: 201 });
  } catch (error) {
    console.error("events: media upload failed", error);
    return NextResponse.json({ error: "The media could not be uploaded. Please try again." }, { status: 503 });
  }
}
