import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const supabaseEnabled = Boolean(url && serviceRoleKey);

export const supabaseAdmin = supabaseEnabled
  ? createClient(url!, serviceRoleKey!, { auth: { autoRefreshToken: false, persistSession: false } })
  : null;

export const eventMediaBucket = process.env.EVENT_MEDIA_BUCKET || "event-media";
export const eventMediaMaxSize = Number(process.env.EVENT_MEDIA_MAX_MB || 500) * 1024 * 1024;

/** Ensures the media bucket exists and reports the size limit the storage plan actually allows. */
export async function ensureEventMediaBucket(): Promise<{ limit: number; capped: boolean }> {
  if (!supabaseAdmin) throw new Error("storage_not_configured");
  const existing = await supabaseAdmin.storage.getBucket(eventMediaBucket);
  if (existing.error) {
    const created = await supabaseAdmin.storage.createBucket(eventMediaBucket, { public: false, fileSizeLimit: eventMediaMaxSize });
    if (!created.error) return { limit: eventMediaMaxSize, capped: false };
    const fallback = await supabaseAdmin.storage.createBucket(eventMediaBucket, { public: false });
    if (fallback.error) throw new Error(fallback.error.message);
    const check = await supabaseAdmin.storage.getBucket(eventMediaBucket);
    return { limit: Number(check.data?.file_size_limit ?? 0) || eventMediaMaxSize, capped: true };
  }

  const currentLimit = Number(existing.data?.file_size_limit ?? 0);
  if (!currentLimit) return { limit: eventMediaMaxSize, capped: false };
  if (currentLimit >= eventMediaMaxSize) return { limit: currentLimit, capped: false };

  // A failure here means the project plan caps uploads below the requested limit, so keep the existing limit.
  const updated = await supabaseAdmin.storage.updateBucket(eventMediaBucket, { public: Boolean(existing.data?.public), fileSizeLimit: eventMediaMaxSize });
  if (updated.error) return { limit: currentLimit, capped: true };
  return { limit: eventMediaMaxSize, capped: false };
}

/** Signed URL the browser uploads to directly, so large videos never pass through the serverless function. */
export async function createEventMediaUploadUrl(storageKey: string) {
  if (!supabaseAdmin) throw new Error("storage_not_configured");
  const result = await supabaseAdmin.storage.from(eventMediaBucket).createSignedUploadUrl(storageKey);
  if (result.error || !result.data) throw new Error(result.error?.message || "Could not create an upload URL");
  return { uploadUrl: result.data.signedUrl, token: result.data.token, storageKey };
}

export async function removeEventMedia(storageKeys: string[]) {
  if (!supabaseAdmin || !storageKeys.length) return;
  await supabaseAdmin.storage.from(eventMediaBucket).remove(storageKeys);
}

export function eventMediaUrl(storageKey: string) {
  if (!url) return "";
  return `${url}/storage/v1/object/public/${eventMediaBucket}/${storageKey}`;
}

export async function createEventMediaUrl(storageKey: string) {
  if (!supabaseAdmin) return eventMediaUrl(storageKey);
  const result = await supabaseAdmin.storage.from(eventMediaBucket).createSignedUrl(storageKey, 60 * 60 * 6);
  return result.data?.signedUrl || eventMediaUrl(storageKey);
}

export async function createPrivateTicketUrl(storageKey: string) {
  if (!supabaseAdmin) throw new Error("Supabase storage is not configured");
  const bucket = process.env.SUPABASE_STORAGE_BUCKET || "ticket-pdfs";
  const result = await supabaseAdmin.storage.from(bucket).createSignedUrl(storageKey, 60 * 10);
  if (result.error || !result.data) throw new Error("Could not create ticket download URL");
  return result.data.signedUrl;
}
