import { Pool } from "pg";
import type { AttendeeRecord, EventRecord } from "./store";

const pool = process.env.DATABASE_URL ? new Pool({ connectionString: process.env.DATABASE_URL, max: 5, ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : undefined }) : null;
const organizationId = process.env.ORGANIZATION_ID;

export const databaseEnabled = Boolean(pool && organizationId);

export async function listEvents(includeDrafts = false): Promise<EventRecord[]> {
  if (!pool || !organizationId) return [];
  const result = await pool.query(`select e.id, e.title, e.description, e.starts_at, e.audience_policy, e.min_age, e.max_age, v.name as venue, s.capacity, e.published, count(distinct a.id)::int as attendee_count, coalesce(sum(a.child_count), 0)::int as child_count, e.created_at from events e left join venues v on v.id = e.venue_id left join lateral (select capacity from event_sessions where event_id = e.id order by starts_at limit 1) s on true left join attendees a on a.event_id = e.id where e.organization_id = $1 and ($2 or e.published = true) group by e.id, v.name, s.capacity order by e.starts_at`, [organizationId, includeDrafts]);
  return result.rows.map((row) => ({ id: row.id, title: row.title, description: row.description, startsAt: row.starts_at.toISOString(), audiencePolicy: row.audience_policy, minAge: row.min_age ?? undefined, maxAge: row.max_age ?? undefined, venue: row.venue || "", capacity: row.capacity || 0, published: row.published, attendeeCount: row.attendee_count, childCount: row.child_count, createdAt: row.created_at.toISOString() }));
}

export async function insertEvent(input: Omit<EventRecord, "id" | "attendeeCount" | "childCount" | "createdAt">): Promise<EventRecord> {
  if (!pool || !organizationId) throw new Error("Database is not configured");
  const client = await pool.connect();
  try { await client.query("begin"); const venue = await client.query("insert into venues (organization_id, name) values ($1, $2) returning id", [organizationId, input.venue]); const result = await client.query("insert into events (organization_id, venue_id, title, description, starts_at, audience_policy, min_age, max_age, published) values ($1,$2,$3,$4,$5,$6,$7,$8,$9) returning id, created_at", [organizationId, venue.rows[0].id, input.title, input.description, input.startsAt, input.audiencePolicy, input.minAge ?? null, input.maxAge ?? null, input.published]); const event = { ...input, id: result.rows[0].id, attendeeCount: 0, childCount: 0, createdAt: result.rows[0].created_at.toISOString() }; await client.query("insert into event_sessions (event_id, starts_at, capacity) values ($1,$2,$3)", [event.id, input.startsAt, input.capacity]); await client.query("commit"); return event; } catch (error) { await client.query("rollback"); throw error; } finally { client.release(); }
}

export async function insertAttendee(input: Omit<AttendeeRecord, "id" | "createdAt">): Promise<AttendeeRecord> {
  if (!pool || !organizationId) throw new Error("Database is not configured");
  const result = await pool.query("select * from add_event_attendee($1, $2, $3, $4, $5)", [input.eventId, input.name, input.email, input.childCount, organizationId]);
  if (!result.rowCount) throw new Error("Event not found");
  const row = result.rows[0]; return { id: row.id, eventId: row.event_id, name: row.name, email: row.email, childCount: row.child_count, createdAt: row.created_at.toISOString() };
}
