import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const supabaseEnabled = Boolean(url && serviceRoleKey);

export const supabaseAdmin = supabaseEnabled
  ? createClient(url!, serviceRoleKey!, { auth: { autoRefreshToken: false, persistSession: false } })
  : null;

export async function createPrivateTicketUrl(storageKey: string) {
  if (!supabaseAdmin) throw new Error("Supabase storage is not configured");
  const bucket = process.env.SUPABASE_STORAGE_BUCKET || "ticket-pdfs";
  const result = await supabaseAdmin.storage.from(bucket).createSignedUrl(storageKey, 60 * 10);
  if (result.error || !result.data) throw new Error("Could not create ticket download URL");
  return result.data.signedUrl;
}
