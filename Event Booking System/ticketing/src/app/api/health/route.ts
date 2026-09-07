import { NextResponse } from "next/server";
import { databaseEnabled } from "@/lib/db";
import { isRemoteDatabaseUrl } from "@/lib/db";
import { supabaseEnabled } from "@/lib/supabase";

export async function GET() {
  return NextResponse.json({
    ok: true,
    integrations: {
      database: databaseEnabled,
      databaseUrl: isRemoteDatabaseUrl(process.env.DATABASE_URL),
      organizationId: Boolean(process.env.ORGANIZATION_ID),
      supabase: supabaseEnabled,
      supabaseAuth: Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY),
      stripe: Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET),
    },
  }, { headers: { "Cache-Control": "no-store" } });
}
