import { Pool } from "pg";

export type OrgSettings = {
  name: string;
  ticketPrefix: string;
  supportEmail: string;
  supportPhone: string;
  websiteUrl: string;
  brandColour: string;
  accentColour: string;
  logoUrl: string;
};

const FALLBACK: OrgSettings = {
  name: "Events",
  ticketPrefix: "TK",
  supportEmail: "",
  supportPhone: "",
  websiteUrl: "",
  brandColour: "#36505D",
  accentColour: "#3f8175",
  logoUrl: "",
};

let cached: { value: OrgSettings; at: number } | null = null;
const TTL_MS = 60_000;

/** Branding and contacts come from organisation settings so no org identity is hardcoded (G-07 / NFR-06). */
export async function getOrgSettings(pool: Pool | null, organizationId?: string): Promise<OrgSettings> {
  if (cached && Date.now() - cached.at < TTL_MS) return cached.value;
  if (!pool || !organizationId) return FALLBACK;
  try {
    const result = await pool.query("select name, settings from organizations where id = $1", [organizationId]);
    if (!result.rowCount) return FALLBACK;
    const row = result.rows[0];
    const settings = (row.settings || {}) as Partial<OrgSettings>;
    const value: OrgSettings = {
      name: settings.name || row.name || FALLBACK.name,
      ticketPrefix: (settings.ticketPrefix || FALLBACK.ticketPrefix).toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6) || FALLBACK.ticketPrefix,
      supportEmail: settings.supportEmail || FALLBACK.supportEmail,
      supportPhone: settings.supportPhone || FALLBACK.supportPhone,
      websiteUrl: settings.websiteUrl || FALLBACK.websiteUrl,
      brandColour: settings.brandColour || FALLBACK.brandColour,
      accentColour: settings.accentColour || FALLBACK.accentColour,
      logoUrl: settings.logoUrl || FALLBACK.logoUrl,
    };
    cached = { value, at: Date.now() };
    return value;
  } catch {
    return FALLBACK;
  }
}

export function clearOrgSettingsCache() {
  cached = null;
}
