import { Pool } from "pg";
import type { AttendeeRecord, EventRecord } from "./store";
import { getOrgSettings } from "./settings";
import { allowPartialCheckIn, generateBookingReference, generateBookingTicketCode, resolveCheckInAdmission } from "./check-in-logic";

const pool = process.env.DATABASE_URL ? new Pool({ connectionString: process.env.DATABASE_URL, max: 5, ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : undefined }) : null;
const organizationId = process.env.ORGANIZATION_ID;

export function isRemoteDatabaseUrl(value: string | undefined) {
  if (!value) return false;
  try { const host = new URL(value).hostname; return !["localhost", "127.0.0.1", "::1"].includes(host); } catch { return false; }
}

export const databaseEnabled = Boolean(pool && organizationId && isRemoteDatabaseUrl(process.env.DATABASE_URL));

export async function checkDatabaseRateLimit(key: string, limit: number, windowMs: number) {
  if (!pool) return { allowed: true, retryAfterSeconds: 1 };
  const now = Date.now();
  const windowStart = new Date(Math.floor(now / windowMs) * windowMs);
  const result = await pool.query(
    `insert into rate_limits (key, window_start, count) values ($1, $2, 1)
     on conflict (key, window_start) do update set count = rate_limits.count + 1
     returning count`,
    [key, windowStart],
  );
  await pool.query("delete from rate_limits where window_start < now() - interval '1 day'");
  const count = Number(result.rows[0]?.count || 0);
  return {
    allowed: count <= limit,
    retryAfterSeconds: Math.max(1, Math.ceil((windowStart.getTime() + windowMs - now) / 1000)),
  };
}

export function orgSettings() {
  return getOrgSettings(pool, organizationId);
}

export type EventCategory = { id: string; name: string; slug: string };

export async function listEventCategories(): Promise<EventCategory[]> {
  if (!pool || !organizationId) return [];
  let result;
  try { result = await pool.query("select id, name, slug from event_categories where organization_id = $1 order by sort_order, name", [organizationId]); }
  catch { result = await pool.query("select id, name, slug from event_categories where organization_id = $1 order by name", [organizationId]); }
  return result.rows.map((row) => ({ id: row.id, name: row.name, slug: row.slug }));
}

export async function listAccessControl() {
  if (!pool || !organizationId) return { categories: [], roles: [], permissions: [] };
  const [categories, roles, permissions] = await Promise.all([
    pool.query("select id, name, slug, sort_order from event_categories where organization_id = $1 order by sort_order, name", [organizationId]),
    pool.query("select roles.id, roles.name, roles.is_system, roles.is_locked, coalesce(array_agg(permission_roles.permission_id) filter (where permission_roles.permission_id is not null), '{}') as permission_ids from roles left join permission_roles on permission_roles.role_id = roles.id where roles.organization_id = $1 group by roles.id order by roles.is_locked desc, roles.name", [organizationId]),
    pool.query("select id, key, is_locked from permissions order by key"),
  ]);
  return {
    categories: categories.rows.map((row) => ({ id: row.id as string, name: row.name as string, slug: row.slug as string, sortOrder: Number(row.sort_order) })),
    roles: roles.rows.map((row) => ({ id: row.id as string, name: row.name as string, isSystem: Boolean(row.is_system), isLocked: Boolean(row.is_locked), permissionIds: row.permission_ids as string[] })),
    permissions: permissions.rows.map((row) => ({ id: row.id as string, key: row.key as string, isLocked: Boolean(row.is_locked) })),
  };
}

export async function createEventCategory(input: { name: string; slug: string }) {
  if (!pool || !organizationId) throw new Error("Database is not configured");
  const result = await pool.query("insert into event_categories (organization_id, name, slug, sort_order) values ($1, $2, $3, coalesce((select max(sort_order) + 10 from event_categories where organization_id = $1), 10)) returning id, name, slug, sort_order", [organizationId, input.name, input.slug]);
  const row = result.rows[0];
  return { id: row.id as string, name: row.name as string, slug: row.slug as string, sortOrder: Number(row.sort_order) };
}

export async function updateEventCategory(input: { id: string; name: string; slug: string; sortOrder: number }) {
  if (!pool || !organizationId) throw new Error("Database is not configured");
  const result = await pool.query("update event_categories set name = $1, slug = $2, sort_order = $3 where id = $4 and organization_id = $5 returning id, name, slug, sort_order", [input.name, input.slug, input.sortOrder, input.id, organizationId]);
  if (!result.rowCount) throw new Error("category_not_found");
  const row = result.rows[0];
  return { id: row.id as string, name: row.name as string, slug: row.slug as string, sortOrder: Number(row.sort_order) };
}

export async function deleteEventCategory(id: string) {
  if (!pool || !organizationId) throw new Error("Database is not configured");
  const assigned = await pool.query("select 1 from events where category_id = $1 limit 1", [id]);
  if (assigned.rowCount) throw new Error("category_in_use");
  const result = await pool.query("delete from event_categories where id = $1 and organization_id = $2", [id, organizationId]);
  if (!result.rowCount) throw new Error("category_not_found");
}

export async function createRole(input: { name: string; permissionIds: string[] }) {
  if (!pool || !organizationId) throw new Error("Database is not configured");
  const client = await pool.connect();
  try {
    await client.query("begin");
    const role = await client.query("insert into roles (organization_id, name) values ($1, $2) returning id, name", [organizationId, input.name]);
    for (const permissionId of input.permissionIds) await client.query("insert into permission_roles (permission_id, role_id) values ($1, $2)", [permissionId, role.rows[0].id]);
    await client.query("commit");
    return { id: role.rows[0].id as string, name: role.rows[0].name as string };
  } catch (error) { await client.query("rollback"); throw error; } finally { client.release(); }
}

export async function setRolePermissions(roleId: string, permissionIds: string[]) {
  if (!pool || !organizationId) throw new Error("Database is not configured");
  const client = await pool.connect();
  try {
    await client.query("begin");
    const role = await client.query("select id, is_locked from roles where id = $1 and organization_id = $2", [roleId, organizationId]);
    if (!role.rowCount) throw new Error("role_not_found");
    if (role.rows[0].is_locked) throw new Error("role_locked");
    await client.query("delete from permission_roles where role_id = $1", [roleId]);
    for (const permissionId of permissionIds) await client.query("insert into permission_roles (permission_id, role_id) values ($1, $2)", [permissionId, roleId]);
    await client.query("commit");
  } catch (error) { await client.query("rollback"); throw error; } finally { client.release(); }
}

/** Credential-free description of DATABASE_URL, for diagnosing connection failures. */
export function describeDatabaseUrl() {
  const raw = process.env.DATABASE_URL;
  if (!raw) return { present: false };
  const base = { present: true, length: raw.length, trimmed: raw !== raw.trim(), quoted: /^["']/.test(raw) };
  try {
    const url = new URL(raw.trim());
    return {
      ...base,
      scheme: url.protocol.replace(":", ""),
      host: url.hostname,
      port: url.port || "(default)",
      database: url.pathname.replace("/", ""),
      usernamePresent: Boolean(url.username),
      passwordPresent: Boolean(url.password),
      passwordLooksLikePlaceholder: /^\[.*\]$/.test(decodeURIComponent(url.password || "")),
      passwordNeedsEncoding: /[@:/?#[\]]/.test(decodeURIComponent(url.password || "")),
      search: url.search,
    };
  } catch (error) {
    return { ...base, parseError: error instanceof Error ? error.message : String(error) };
  }
}

/** Event status is a computed lifecycle value, kept separate from category (which is a genre/type, never a status). */
function computeEventStatus(row: { published: boolean; archived_at: unknown; cancelled_at?: unknown; last_occurs_at?: unknown; starts_at: Date; capacity: number | null; attendee_count: number; child_count: number }): EventRecord["status"] {
  if (row.cancelled_at) return "cancelled";
  if (row.archived_at) return "archived";
  if (!row.published) return "draft";
  const lastOccursAt = row.last_occurs_at ? new Date(row.last_occurs_at as string) : row.starts_at;
  if (lastOccursAt.getTime() < Date.now()) return "completed";
  const capacity = row.capacity || 0;
  const booked = (row.attendee_count || 0) + (row.child_count || 0);
  if (capacity > 0 && booked >= capacity) return "sold_out";
  return "published";
}

const BOOKABLE_EVENT_SQL = "exists (select 1 from event_sessions bes join ticket_types btt on btt.event_session_id = bes.id where bes.event_id = e.id and bes.starts_at > now())";

export async function listEvents(includeDrafts = false): Promise<EventRecord[]> {
  if (!pool || !organizationId) return [];
  const visibility = includeDrafts ? "true" : `(e.published = true and e.archived_at is null and e.cancelled_at is null and ${BOOKABLE_EVENT_SQL})`;
  let result;
  try {
    result = await pool.query(`select e.id, e.title, e.description, e.starts_at, e.category_id, e.archived_at, e.cancelled_at, coalesce(c.name, 'General event') as category, e.audience_policy, e.min_age, e.max_age, v.name as venue, s.capacity, e.published, count(distinct a.id)::int as attendee_count, coalesce(sum(a.child_count), 0)::int as child_count, e.created_at, last_session.last_occurs_at from events e left join event_categories c on c.id = e.category_id left join venues v on v.id = e.venue_id left join lateral (select capacity from event_sessions where event_id = e.id order by starts_at limit 1) s on true left join lateral (select max(coalesce(ends_at, starts_at)) as last_occurs_at from event_sessions where event_id = e.id) last_session on true left join attendees a on a.event_id = e.id and not exists (select 1 from bookings cb where cb.id = a.booking_id and cb.status = 'cancelled') where e.organization_id = $1 and ${visibility} group by e.id, c.name, v.name, s.capacity, last_session.last_occurs_at order by e.starts_at`, [organizationId]);
  } catch (error) {
    if (!(error instanceof Error) || !/event_categories|category_id|archived_at|cancelled_at/.test(error.message)) throw error;
    result = await pool.query(`select e.id, e.title, e.description, e.starts_at, 'General event' as category, e.audience_policy, e.min_age, e.max_age, v.name as venue, s.capacity, e.published, count(distinct a.id)::int as attendee_count, coalesce(sum(a.child_count), 0)::int as child_count, e.created_at from events e left join venues v on v.id = e.venue_id left join lateral (select capacity from event_sessions where event_id = e.id order by starts_at limit 1) s on true left join attendees a on a.event_id = e.id and not exists (select 1 from bookings cb where cb.id = a.booking_id and cb.status = 'cancelled') where e.organization_id = $1 and ($2 or (e.published = true and ${BOOKABLE_EVENT_SQL})) group by e.id, v.name, s.capacity order by e.starts_at`, [organizationId, includeDrafts]);
  }
  return result.rows.map((row) => ({ id: row.id, title: row.title, description: row.description, startsAt: row.starts_at.toISOString(), category: row.category, categoryId: row.category_id ?? undefined, audiencePolicy: row.audience_policy, minAge: row.min_age ?? undefined, maxAge: row.max_age ?? undefined, venue: row.venue || "", capacity: row.capacity || 0, published: row.published, archived: Boolean(row.archived_at), cancelled: Boolean(row.cancelled_at), status: computeEventStatus(row), attendeeCount: row.attendee_count, childCount: row.child_count, createdAt: row.created_at.toISOString() }));
}

export type EventSessionForEdit = { startsAt: string; endsAt: string | null; capacity: number };
export type TicketTypeForEdit = { name: string; pricePence: number; maxPerOrder: number };

/** Full saved schedule for the edit form, so editing an event does not discard existing sessions/ticket types. */
export async function getEventSessionsForEdit(eventId: string): Promise<{ sessions: EventSessionForEdit[]; ticketTypes: TicketTypeForEdit[] }> {
  if (!pool || !organizationId) return { sessions: [], ticketTypes: [] };
  const owned = await pool.query("select 1 from events where id = $1 and organization_id = $2", [eventId, organizationId]);
  if (!owned.rowCount) return { sessions: [], ticketTypes: [] };

  const sessions = await pool.query(`
    select es.id,
           es.starts_at,
           es.ends_at,
           es.capacity,
           coalesce(json_agg(json_build_object(
             'name', tt.name,
             'pricePence', tt.price_pence,
             'maxPerOrder', tt.max_per_order
           ) order by tt.price_pence desc, tt.name) filter (where tt.id is not null), '[]'::json) as ticket_types
    from event_sessions es
    left join ticket_types tt on tt.event_session_id = es.id
    where es.event_id = $1
    group by es.id, es.starts_at, es.ends_at, es.capacity
    order by es.starts_at
  `, [eventId]);

  const flattenedTicketTypes = new Map<string, TicketTypeForEdit>();
  for (const row of sessions.rows) {
    const ticketTypesForSession = Array.isArray(row.ticket_types) ? row.ticket_types as Array<{ name: string; pricePence: number; maxPerOrder: number }> : [];
    for (const ticketType of ticketTypesForSession) {
      const key = `${ticketType.name.toLowerCase()}|${ticketType.pricePence}|${ticketType.maxPerOrder}`;
      if (!flattenedTicketTypes.has(key)) flattenedTicketTypes.set(key, { name: ticketType.name, pricePence: ticketType.pricePence, maxPerOrder: ticketType.maxPerOrder });
    }
  }

  return {
    sessions: sessions.rows.map((row) => ({ startsAt: row.starts_at.toISOString(), endsAt: row.ends_at ? row.ends_at.toISOString() : null, capacity: row.capacity })),
    ticketTypes: Array.from(flattenedTicketTypes.values()),
  };
}

export async function setEventArchived(eventId: string, archived: boolean, actor?: AuditActor) {
  if (!pool || !organizationId) throw new Error("Database is not configured");
  const result = await pool.query("update events set archived_at = case when $1 then now() else null end where id = $2 and organization_id = $3 returning id, title", [archived, eventId, organizationId]);
  if (!result.rowCount) throw new Error("event_not_found");
  await writeAuditLog(archived ? "event.archived" : "event.restored", { eventId, title: result.rows[0].title, ...auditActor(actor).metadata }, auditActor(actor).context);
}

export async function setEventPublished(eventId: string, published: boolean, actor?: AuditActor) {
  if (!pool || !organizationId) throw new Error("Database is not configured");
  const existing = await pool.query("select title, published from events where id = $1 and organization_id = $2", [eventId, organizationId]);
  if (!existing.rowCount) throw new Error("event_not_found");
  if (published) {
    const ready = await pool.query(`select 1 from events e where e.id = $1 and ${BOOKABLE_EVENT_SQL}`, [eventId]);
    if (!ready.rowCount) throw new Error("publish_requires_schedule");
  }
  await pool.query("update events set published = $1 where id = $2 and organization_id = $3", [published, eventId, organizationId]);
  if (existing.rows[0].published === published) return;
  await writeAuditLog(published ? "event.published" : "event.unpublished", { eventId, title: existing.rows[0].title, ...auditActor(actor).metadata }, auditActor(actor).context);
}

/** Cancelled is a distinct lifecycle state from archived: a cancelled event stays visible as "Cancelled", it is not hidden. */
export async function setEventCancelled(eventId: string, cancelled: boolean, actor?: AuditActor) {
  if (!pool || !organizationId) throw new Error("Database is not configured");
  const result = await pool.query("update events set cancelled_at = case when $1 then now() else null end where id = $2 and organization_id = $3 returning id, title", [cancelled, eventId, organizationId]);
  if (!result.rowCount) throw new Error("event_not_found");
  await writeAuditLog(cancelled ? "event.cancelled" : "event.uncancelled", { eventId, title: result.rows[0].title, ...auditActor(actor).metadata }, auditActor(actor).context);
}

/** Permanently removes an event and everything attached to it. Used only when no booking exists. */
export async function deleteEventCascade(eventId: string, actor?: AuditActor) {
  if (!pool || !organizationId) throw new Error("Database is not configured");
  let deletedTitle: string | undefined;
  const client = await pool.connect();
  try {
    await client.query("begin");
    const owned = await client.query("select id, title from events where id = $1 and organization_id = $2 for update", [eventId, organizationId]);
    deletedTitle = owned.rows[0]?.title;
    if (!owned.rowCount) throw new Error("event_not_found");
    const booked = await client.query("select count(*)::int as count from bookings where event_id = $1", [eventId]);
    if (booked.rows[0].count > 0) throw new Error("event_has_bookings");
    await client.query("delete from attendees where event_id = $1", [eventId]);
    await client.query("delete from tickets where event_id = $1", [eventId]);
    await client.query("delete from event_media where event_id = $1", [eventId]);
    await client.query("delete from session_ticket_inventory where event_session_id in (select id from event_sessions where event_id = $1)", [eventId]);
    await client.query("delete from ticket_types where event_session_id in (select id from event_sessions where event_id = $1)", [eventId]);
    await client.query("delete from event_sessions where event_id = $1", [eventId]);
    await client.query("delete from events where id = $1", [eventId]);
    await client.query("commit");
  } catch (error) { await client.query("rollback"); throw error; } finally { client.release(); }
  await writeAuditLog("event.deleted", { eventId, title: deletedTitle, ...auditActor(actor).metadata }, auditActor(actor).context);
}

type EventWriteInput = Omit<EventRecord, "id" | "attendeeCount" | "childCount" | "createdAt"> & {
  sessions?: { startsAt: string; endsAt?: string; capacity: number }[];
  ticketTypes?: { name: string; pricePence: number; maxPerOrder: number }[];
};

export async function insertEvent(input: EventWriteInput, actor?: AuditActor): Promise<EventRecord> {
  if (!pool || !organizationId) throw new Error("Database is not configured");
  if (input.published && !(input.ticketTypes && input.ticketTypes.length > 0)) throw new Error("publish_requires_schedule");
  const client = await pool.connect();
  try {
    await client.query("begin");
    const venue = await client.query("insert into venues (organization_id, name) values ($1, $2) returning id", [organizationId, input.venue]);
    const result = await client.query("insert into events (organization_id, venue_id, category_id, title, description, starts_at, audience_policy, min_age, max_age, published) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) returning id, created_at", [organizationId, venue.rows[0].id, input.categoryId ?? null, input.title, input.description, input.startsAt, input.audiencePolicy, input.minAge ?? null, input.maxAge ?? null, input.published]);
    const event = { ...input, id: result.rows[0].id, attendeeCount: 0, childCount: 0, createdAt: result.rows[0].created_at.toISOString() };
    const sessions = input.sessions?.length ? input.sessions : [{ startsAt: input.startsAt, capacity: input.capacity }];
    for (const session of sessions) {
      const insertedSession = await client.query("insert into event_sessions (event_id, starts_at, ends_at, capacity) values ($1,$2,$3,$4) returning id", [event.id, session.startsAt, session.endsAt ?? null, session.capacity]);
      for (const ticket of input.ticketTypes ?? []) {
        const insertedTicket = await client.query("insert into ticket_types (event_session_id, name, price_pence, max_per_order) values ($1,$2,$3,$4) returning id", [insertedSession.rows[0].id, ticket.name, ticket.pricePence, ticket.maxPerOrder]);
        await client.query("insert into session_ticket_inventory (event_session_id, ticket_type_id, capacity) values ($1,$2,$3)", [insertedSession.rows[0].id, insertedTicket.rows[0].id, session.capacity]);
      }
    }
    await client.query("commit");
    await writeAuditLog(input.published ? "event.created_published" : "event.created", { eventId: event.id, title: event.title, ...auditActor(actor).metadata }, auditActor(actor).context);
    return event;
  } catch (error) { await client.query("rollback"); throw error; } finally { client.release(); }
}

export async function updateEvent(id: string, input: Omit<EventRecord, "id" | "attendeeCount" | "childCount" | "createdAt">, actor?: AuditActor): Promise<EventRecord | null> {
  if (!pool || !organizationId) throw new Error("Database is not configured");
  const client = await pool.connect();
  try {
    await client.query("begin");
    const before = await client.query("select published from events where id = $1 and organization_id = $2", [id, organizationId]);
    const venue = await client.query("insert into venues (organization_id, name) values ($1, $2) returning id", [organizationId, input.venue]);
    const updated = await client.query("update events set venue_id = $1, category_id = $2, title = $3, description = $4, starts_at = $5, audience_policy = $6, min_age = $7, max_age = $8, published = $9 where id = $10 and organization_id = $11 returning id, created_at", [venue.rows[0].id, input.categoryId ?? null, input.title, input.description, input.startsAt, input.audiencePolicy, input.minAge ?? null, input.maxAge ?? null, input.published, id, organizationId]);
    if (!updated.rowCount) { await client.query("rollback"); return null; }
    const bookings = await client.query("select count(*)::int as count from bookings where event_id = $1", [id]);
    if (bookings.rows[0].count > 0 && (input as EventWriteInput).sessions?.length) throw new Error("event_schedule_locked");
    const scheduleProvided = Boolean((input as EventWriteInput).sessions?.length);
    if (bookings.rows[0].count === 0 && scheduleProvided) {
      await client.query("delete from session_ticket_inventory where event_session_id in (select id from event_sessions where event_id = $1)", [id]);
      await client.query("delete from ticket_types where event_session_id in (select id from event_sessions where event_id = $1)", [id]);
      await client.query("delete from event_sessions where event_id = $1", [id]);
      const writeInput = input as EventWriteInput;
      const sessions = writeInput.sessions?.length ? writeInput.sessions : [{ startsAt: input.startsAt, capacity: input.capacity }];
      for (const session of sessions) {
        const insertedSession = await client.query("insert into event_sessions (event_id, starts_at, ends_at, capacity) values ($1,$2,$3,$4) returning id", [id, session.startsAt, session.endsAt ?? null, session.capacity]);
        for (const ticket of writeInput.ticketTypes ?? []) {
          const insertedTicket = await client.query("insert into ticket_types (event_session_id, name, price_pence, max_per_order) values ($1,$2,$3,$4) returning id", [insertedSession.rows[0].id, ticket.name, ticket.pricePence, ticket.maxPerOrder]);
          await client.query("insert into session_ticket_inventory (event_session_id, ticket_type_id, capacity) values ($1,$2,$3)", [insertedSession.rows[0].id, insertedTicket.rows[0].id, session.capacity]);
        }
      }
    }
    if (input.published) {
      const schedule = await client.query(
        "select count(*) filter (where es.starts_at > now())::int as future_sessions, count(distinct tt.id)::int as ticket_types from event_sessions es left join ticket_types tt on tt.event_session_id = es.id where es.event_id = $1",
        [id]
      );
      if (schedule.rows[0].future_sessions === 0 || schedule.rows[0].ticket_types === 0) throw new Error("publish_requires_schedule");
    }
    const attendees = await client.query("select count(*)::int as attendee_count, coalesce(sum(child_count), 0)::int as child_count from attendees where event_id = $1", [id]);
    await client.query("commit");
    const wasPublished = before.rows[0]?.published === true;
    if (input.published && !wasPublished) await writeAuditLog("event.published", { eventId: id, title: input.title, ...auditActor(actor).metadata }, auditActor(actor).context);
    else if (!input.published && wasPublished) await writeAuditLog("event.unpublished", { eventId: id, title: input.title, ...auditActor(actor).metadata }, auditActor(actor).context);
    else await writeAuditLog("event.updated", { eventId: id, title: input.title, ...auditActor(actor).metadata }, auditActor(actor).context);
    return { ...input, id, attendeeCount: attendees.rows[0].attendee_count, childCount: attendees.rows[0].child_count, createdAt: updated.rows[0].created_at.toISOString() };
  } catch (error) { await client.query("rollback"); throw error; } finally { client.release(); }
}

export async function insertAttendee(input: Omit<AttendeeRecord, "id" | "createdAt">): Promise<AttendeeRecord> {
  if (!pool || !organizationId) throw new Error("Database is not configured");
  const result = await pool.query("select * from add_event_attendee($1, $2, $3, $4, $5)", [input.eventId, input.name, input.email, input.childCount, organizationId]);
  if (!result.rowCount) throw new Error("Event not found");
  const row = result.rows[0]; return { id: row.id, eventId: row.event_id, name: row.name, email: row.email, childCount: row.child_count, createdAt: row.created_at.toISOString() };
}

export async function listEventSubmissions() {
  if (!pool || !organizationId) return [];
  const result = await pool.query("select attendees.id, attendees.name, attendees.email, attendees.child_count, attendees.created_at, events.title as event_title, coalesce(payments.status = 'succeeded', false) as paid from attendees join events on events.id = attendees.event_id left join bookings on bookings.id = attendees.booking_id left join payments on payments.booking_id = bookings.id where events.organization_id = $1 order by attendees.created_at desc", [organizationId]);
  return result.rows.map((row) => ({ id: row.id as string, name: row.name as string, email: row.email as string, event: row.event_title as string, tickets: 1 + Number(row.child_count || 0), paid: Boolean(row.paid), attending: row.paid ? "Confirmed" : "Submission received", createdAt: row.created_at.toISOString() }));
}

async function resolveBookingTicketType(client: { query: (query: string, params?: unknown[]) => Promise<{ rows: Array<Record<string, unknown>>; rowCount: number }> }, eventId: string, preferredLabel: "adult" | "child") {
  const match = await client.query(
    `select tt.id, tt.name, tt.price_pence
       from ticket_types tt
       join event_sessions es on es.id = tt.event_session_id
       where es.event_id = $1 and lower(tt.name) = lower($2)
       order by es.starts_at, tt.price_pence desc, tt.name
       limit 1`,
    [eventId, preferredLabel],
  );
  if (match.rowCount) return match.rows[0];

  const fallbackSession = await client.query("select id from event_sessions where event_id = $1 order by starts_at limit 1", [eventId]);
  if (!fallbackSession.rowCount) throw new Error("event_not_found");

  const label = preferredLabel === "child" ? "Child" : "Adult";
  const created = await client.query(
    "insert into ticket_types (event_session_id, name, price_pence, max_per_order) values ($1, $2, 0, 10) returning id, name, price_pence",
    [fallbackSession.rows[0].id, label],
  );
  if (created.rowCount) return created.rows[0];

  const existing = await client.query("select id, name, price_pence from ticket_types where event_session_id = $1 order by created_at limit 1", [fallbackSession.rows[0].id]);
  if (!existing.rowCount) throw new Error("event_ticket_types_missing");
  return existing.rows[0];
}

export async function createMockBooking(input: { eventId: string; name: string; email: string; childCount: number; staffEmail?: string }) {
  if (!pool || !organizationId) throw new Error("Database is not configured");
  const client = await pool.connect();
  try {
    await client.query("begin");
    const event = await client.query("select events.id, events.title, event_sessions.capacity from events join event_sessions on event_sessions.event_id = events.id where events.id = $1 and events.organization_id = $2 and events.published = true and events.archived_at is null and events.cancelled_at is null and coalesce(event_sessions.ends_at, event_sessions.starts_at) > now() order by event_sessions.starts_at limit 1 for update", [input.eventId, organizationId]);
    if (!event.rowCount) throw new Error("event_not_found");

    const totalGuests = input.childCount + 1;
    const current = await client.query("select coalesce(sum(child_count + 1), 0)::int as guest_count from attendees where event_id = $1", [input.eventId]);
    if (current.rows[0].guest_count + totalGuests > event.rows[0].capacity) throw new Error("event_full");

    const adultType = await resolveBookingTicketType(client, input.eventId, "adult");
    const childType = input.childCount > 0 ? await resolveBookingTicketType(client, input.eventId, "child") : null;

    const booking = await client.query("insert into bookings (organization_id, event_id, status, sales_channel, buyer_name, buyer_email, total_pence, confirmed_at) values ($1, $2, 'confirmed', 'online', $3, $4, 0, now()) returning id", [organizationId, input.eventId, input.name, input.email]);
    const bookingId = booking.rows[0].id as string;
    const attendee = await client.query("insert into attendees (booking_id, event_id, name, email, child_count) values ($1, $2, $3, $4, $5) returning id", [bookingId, input.eventId, input.name, input.email, input.childCount]);

    const itemPlans = [{ ticketTypeId: adultType.id as string, quantity: 1, unitPricePence: Number(adultType.price_pence || 0) }];
    if (childType) {
      itemPlans.push({ ticketTypeId: childType.id as string, quantity: input.childCount, unitPricePence: Number(childType.price_pence || 0) });
    }

    let totalPence = 0;

    for (const itemPlan of itemPlans) {
      await client.query(
        "insert into booking_items (booking_id, ticket_type_id, quantity, unit_price_pence) values ($1, $2, $3, $4)",
        [bookingId, itemPlan.ticketTypeId, itemPlan.quantity, itemPlan.unitPricePence],
      );
      totalPence += itemPlan.unitPricePence * itemPlan.quantity;
    }

    // Phase 10.1: one booking = one ticket code (HP-XXXXXX) + one QR code, guest count tracked
    // on booking_tickets rather than one legacy `tickets` row per guest.
    const ticketCode = generateBookingTicketCode();
    await client.query(
      "insert into booking_tickets (booking_id, ticket_code, total_guests) values ($1, $2, $3)",
      [bookingId, ticketCode, totalGuests],
    );
    await client.query("update bookings set booking_reference = $1, total_pence = $2 where id = $3", [generateBookingReference(), totalPence, bookingId]);
    await client.query("insert into payments (booking_id, provider, stripe_mode, payment_intent_id, amount_pence, status) values ($1, 'mock', 'test', $2, $3, 'succeeded')", [bookingId, `mock_${crypto.randomUUID()}`, totalPence]);
    await client.query("insert into notification_dispatches (organization_id, dispatch_key, template_key, recipient, status) values ($1, $2, 'booking_confirmation', $3, 'pending')", [organizationId, `booking:${bookingId}:guest`, input.email]);
    if (input.staffEmail) await client.query("insert into notification_dispatches (organization_id, dispatch_key, template_key, recipient, status) values ($1, $2, 'new_booking_staff', $3, 'pending')", [organizationId, `booking:${bookingId}:staff`, input.staffEmail]);
    await client.query("commit");
    await writeAuditLog("booking.confirmed", { bookingId, eventId: input.eventId, guestCount: totalGuests, paymentProvider: "mock" });
    return { bookingId, attendeeId: attendee.rows[0].id as string, eventTitle: event.rows[0].title as string, ticketCode, totalGuests };
  } catch (error) { await client.query("rollback"); throw error; } finally { client.release(); }
}

export type PublicTicketType = { id: string; name: string; pricePence: number; maxPerOrder: number };
export type PublicSession = { id: string; startsAt: string; endsAt: string | null; venue: string; capacity: number; remaining: number; ticketTypes: PublicTicketType[] };

/** Real upcoming sessions + ticket types + live remaining places, for the public storefront's date/ticket picker. */
export async function listEventSchedules(eventIds: string[]): Promise<Record<string, PublicSession[]>> {
  if (!pool || !eventIds.length) return {};
  const result = await pool.query(
    `select es.id, es.event_id, es.starts_at, es.ends_at, es.capacity, v.name as venue,
       coalesce((
         select sum(bi.quantity) from booking_items bi
         join ticket_types tt2 on tt2.id = bi.ticket_type_id
         join bookings b on b.id = bi.booking_id
         where tt2.event_session_id = es.id and b.status <> 'cancelled'
       ), 0)::int as booked,
       coalesce(json_agg(json_build_object('id', tt.id, 'name', tt.name, 'pricePence', tt.price_pence, 'maxPerOrder', tt.max_per_order) order by tt.price_pence desc, tt.name) filter (where tt.id is not null), '[]') as ticket_types
     from event_sessions es
     join events e on e.id = es.event_id
     left join venues v on v.id = e.venue_id
     left join ticket_types tt on tt.event_session_id = es.id
     where es.event_id = any($1::uuid[]) and coalesce(es.ends_at, es.starts_at) > now()
     group by es.id, v.name
     order by es.starts_at`,
    [eventIds],
  );
  const schedules: Record<string, PublicSession[]> = {};
  for (const row of result.rows) {
    const eventId = row.event_id as string;
    const list = schedules[eventId] ?? (schedules[eventId] = []);
    list.push({
      id: row.id as string,
      startsAt: row.starts_at.toISOString(),
      endsAt: row.ends_at ? row.ends_at.toISOString() : null,
      venue: (row.venue as string) || "",
      capacity: Number(row.capacity),
      remaining: Math.max(0, Number(row.capacity) - Number(row.booked || 0)),
      ticketTypes: (row.ticket_types as PublicTicketType[]) || [],
    });
  }
  return schedules;
}

/** Real session + ticket-type booking, replacing the flat adult/child model for the public storefront's multi-step flow. */
export async function createSessionBooking(input: {
  eventId: string;
  sessionId: string;
  items: { ticketTypeId: string; quantity: number }[];
  name: string;
  email: string;
  phone: string;
  specialRequests: string;
  staffEmail?: string;
}) {
  if (!pool || !organizationId) throw new Error("Database is not configured");
  const totalQuantity = input.items.reduce((sum, item) => sum + item.quantity, 0);
  if (totalQuantity <= 0) throw new Error("booking_empty");

  const client = await pool.connect();
  try {
    await client.query("begin");
    const session = await client.query(
      `select es.id, es.capacity, e.title from event_sessions es
       join events e on e.id = es.event_id
       where es.id = $1 and es.event_id = $2 and e.organization_id = $3 and e.published = true and e.archived_at is null and e.cancelled_at is null and coalesce(es.ends_at, es.starts_at) > now()
       for update`,
      [input.sessionId, input.eventId, organizationId],
    );
    if (!session.rowCount) throw new Error("event_not_found");

    const booked = await client.query(
      `select coalesce(sum(bi.quantity), 0)::int as booked from booking_items bi
       join ticket_types tt on tt.id = bi.ticket_type_id
       join bookings b on b.id = bi.booking_id
       where tt.event_session_id = $1 and b.status <> 'cancelled'`,
      [input.sessionId],
    );
    if (Number(booked.rows[0].booked) + totalQuantity > session.rows[0].capacity) throw new Error("event_full");

    const ticketTypeIds = input.items.map((item) => item.ticketTypeId);
    const ticketTypeRows = await client.query(
      "select id, name, price_pence, max_per_order from ticket_types where event_session_id = $1 and id = any($2::uuid[])",
      [input.sessionId, ticketTypeIds],
    );
    const ticketTypeMap = new Map(ticketTypeRows.rows.map((row) => [row.id as string, row]));
    for (const item of input.items) {
      const ticketType = ticketTypeMap.get(item.ticketTypeId);
      if (!ticketType) throw new Error("ticket_type_not_found");
      if (item.quantity > Number(ticketType.max_per_order)) throw new Error("ticket_limit_exceeded");
    }

    const booking = await client.query(
      "insert into bookings (organization_id, event_id, status, sales_channel, buyer_name, buyer_email, buyer_phone, special_requests, total_pence, confirmed_at) values ($1, $2, 'confirmed', 'online', $3, $4, $5, $6, 0, now()) returning id",
      [organizationId, input.eventId, input.name, input.email, input.phone, input.specialRequests || null],
    );
    const bookingId = booking.rows[0].id as string;
    const attendee = await client.query(
      "insert into attendees (booking_id, event_id, name, email, child_count) values ($1, $2, $3, $4, 0) returning id",
      [bookingId, input.eventId, input.name, input.email],
    );

    let totalPence = 0;

    for (const item of input.items) {
      const ticketType = ticketTypeMap.get(item.ticketTypeId)!;
      const unitPricePence = Number(ticketType.price_pence);
      await client.query(
        "insert into booking_items (booking_id, ticket_type_id, quantity, unit_price_pence) values ($1, $2, $3, $4)",
        [bookingId, item.ticketTypeId, item.quantity, unitPricePence],
      );
      totalPence += unitPricePence * item.quantity;
    }

    // Phase 10.1: one booking = one ticket code (HP-XXXXXX) + one QR code, guest count tracked
    // on booking_tickets rather than one legacy `tickets` row per guest.
    const ticketCode = generateBookingTicketCode();
    await client.query(
      "insert into booking_tickets (booking_id, ticket_code, total_guests) values ($1, $2, $3)",
      [bookingId, ticketCode, totalQuantity],
    );
    await client.query("update bookings set booking_reference = $1, total_pence = $2 where id = $3", [generateBookingReference(), totalPence, bookingId]);
    await client.query("insert into payments (booking_id, provider, stripe_mode, payment_intent_id, amount_pence, status) values ($1, 'mock', 'test', $2, $3, 'succeeded')", [bookingId, `mock_${crypto.randomUUID()}`, totalPence]);
    await client.query("insert into notification_dispatches (organization_id, dispatch_key, template_key, recipient, status) values ($1, $2, 'booking_confirmation', $3, 'pending')", [organizationId, `booking:${bookingId}:guest`, input.email]);
    if (input.staffEmail) await client.query("insert into notification_dispatches (organization_id, dispatch_key, template_key, recipient, status) values ($1, $2, 'new_booking_staff', $3, 'pending')", [organizationId, `booking:${bookingId}:staff`, input.staffEmail]);
    await client.query("commit");
    await writeAuditLog("booking.confirmed", { bookingId, eventId: input.eventId, guestCount: totalQuantity, paymentProvider: "mock" });
    return { bookingId, attendeeId: attendee.rows[0].id as string, eventTitle: session.rows[0].title as string, totalPence, ticketCode, totalGuests: totalQuantity };
  } catch (error) { await client.query("rollback"); throw error; } finally { client.release(); }
}

export async function eventBelongsToOrganization(eventId: string) {
  if (!pool || !organizationId) return false;
  const result = await pool.query("select 1 from events where id = $1 and organization_id = $2", [eventId, organizationId]);
  return result.rowCount === 1;
}

export async function addEventMedia(eventId: string, storageKey: string, contentType: string) {
  if (!pool || !organizationId) throw new Error("Database is not configured");
  const result = await pool.query("insert into media_objects (organization_id, storage_key, content_type, is_private) values ($1, $2, $3, false) returning id", [organizationId, storageKey, contentType]);
  try {
    await pool.query("insert into event_media (event_id, media_object_id, display_order) values ($1, $2, 0)", [eventId, result.rows[0].id]);
  } catch (error) {
    if (!(error instanceof Error) || !/event_media/.test(error.message)) throw error;
  }
}

export async function listEventMedia(eventId: string) {
  if (!pool || !organizationId) return [];
  try {
    const result = await pool.query("select media_objects.storage_key, media_objects.content_type from event_media join media_objects on media_objects.id = event_media.media_object_id where event_media.event_id = $1 and media_objects.organization_id = $2 order by event_media.display_order, event_media.created_at", [eventId, organizationId]);
    return result.rows.map((row) => ({ storageKey: row.storage_key as string, contentType: row.content_type as string }));
  } catch {
    const result = await pool.query("select storage_key, content_type from media_objects where organization_id = $1 and storage_key like $2 order by created_at", [organizationId, `events/${eventId}/%`]);
    return result.rows.map((row) => ({ storageKey: row.storage_key as string, contentType: row.content_type as string }));
  }
}

/** Cancels a booking: frees its places (capacity ignores cancelled bookings) and voids its unused tickets. */
export async function cancelBooking(bookingId: string, actor?: AuditActor) {
  if (!pool || !organizationId) throw new Error("Database is not configured");
  const client = await pool.connect();
  let summary: { title: string; email: string; guests: number; provider: string | null };
  try {
    await client.query("begin");
    const booking = await client.query(
      "select bookings.status, bookings.buyer_email, events.title from bookings join events on events.id = bookings.event_id where bookings.id = $1 and bookings.organization_id = $2 for update of bookings",
      [bookingId, organizationId],
    );
    if (booking.rowCount === 0) throw new Error("booking_not_found");
    if (booking.rows[0].status === "cancelled") throw new Error("booking_already_cancelled");
    const used = await client.query("select coalesce(checked_in_count, 0)::int as count from booking_tickets where booking_id = $1", [bookingId]);
    if ((used.rows[0]?.count ?? 0) > 0) throw new Error("booking_checked_in");
    await client.query("update bookings set status = 'cancelled' where id = $1", [bookingId]);
    const guests = await client.query("select coalesce(total_guests, 0)::int as guests from booking_tickets where booking_id = $1", [bookingId]);
    await client.query("update tickets set status = 'cancelled' where booking_id = $1 and status = 'issued'", [bookingId]);
    const payment = await client.query("select provider from payments where booking_id = $1 and status = 'succeeded' order by created_at desc limit 1", [bookingId]);
    await client.query("commit");
    summary = { title: booking.rows[0].title as string, email: (booking.rows[0].buyer_email as string) || "", guests: guests.rows[0]?.guests ?? 0, provider: (payment.rows[0]?.provider as string | undefined) ?? null };
  } catch (error) { await client.query("rollback"); throw error; } finally { client.release(); }
  await writeAuditLog("booking.cancelled", { bookingId, title: summary.title, customer: summary.email, guests: summary.guests, paymentProvider: summary.provider, ...auditActor(actor).metadata }, auditActor(actor).context);
  return summary;
}

export async function checkInBookingTicket(ticketCode: string, guests: number | undefined, staffUserId: string, ip: string | null, userAgent: string | null) {
  if (!pool || !organizationId) throw new Error("Database is not configured");
  const existing = await pool.query(
    `select booking_tickets.total_guests, booking_tickets.checked_in_count, bookings.status
       from booking_tickets
       join bookings on bookings.id = booking_tickets.booking_id
      where booking_tickets.ticket_code = upper(trim($1)) and bookings.organization_id = $2`,
    [ticketCode, organizationId],
  );
  if (!existing.rowCount) throw new Error("ticket_not_found");
  if (existing.rows[0].status === "cancelled") throw new Error("ticket_cancelled");
  const admission = resolveCheckInAdmission(
    { totalGuests: Number(existing.rows[0].total_guests), checkedInCount: Number(existing.rows[0].checked_in_count) },
    guests,
    allowPartialCheckIn(),
  );
  if (!admission.ok) throw new Error(admission.error);
  const result = await pool.query("select * from check_in_booking($1, $2, $3, $4, $5)", [ticketCode, admission.guestsToAdmit, staffUserId, ip, userAgent]);
  await writeAuditLog("checkin.recorded", { ticketCode: ticketCode.toUpperCase(), guestsCheckedIn: admission.guestsToAdmit }, { userId: staffUserId, ip, userAgent });
  return result.rows[0];
}

/** Scan history + guest breakdown for a booking ticket, so staff can review it before admitting guests. */
export async function getBookingScanDetails(ticketCode: string) {
  if (!pool || !organizationId) return null;
  const result = await pool.query(
    `select booking_tickets.ticket_code, booking_tickets.total_guests, booking_tickets.checked_in_count,
            bookings.id as booking_id, bookings.status as booking_status, bookings.booking_reference,
            bookings.buyer_name, bookings.buyer_email,
            events.title as event_title,
            (select min(es.starts_at) from booking_items bi join ticket_types tt on tt.id = bi.ticket_type_id join event_sessions es on es.id = tt.event_session_id where bi.booking_id = bookings.id) as session_starts_at,
            (select min(es.ends_at) from booking_items bi join ticket_types tt on tt.id = bi.ticket_type_id join event_sessions es on es.id = tt.event_session_id where bi.booking_id = bookings.id) as session_ends_at,
            (select tt.event_session_id from booking_items bi join ticket_types tt on tt.id = bi.ticket_type_id where bi.booking_id = bookings.id limit 1) as session_id,
            coalesce(bool_or(payments.status = 'succeeded' and payments.provider <> 'mock'), false) as paid,
            coalesce(bool_or(payments.status = 'succeeded' and payments.provider = 'mock'), false) as test_payment,
            (select coalesce(json_agg(json_build_object('name', ticket_types.name, 'quantity', booking_items.quantity) order by ticket_types.name), '[]')
               from booking_items join ticket_types on ticket_types.id = booking_items.ticket_type_id
              where booking_items.booking_id = bookings.id) as guest_breakdown,
            (select max(checked_in_at) from booking_check_ins where booking_check_ins.booking_ticket_id = (select id from booking_tickets where ticket_code = upper(trim($1)))) as last_checked_in_at,
            (select users.email from booking_check_ins join users on users.id = booking_check_ins.staff_user_id where booking_check_ins.booking_ticket_id = (select id from booking_tickets where ticket_code = upper(trim($1))) order by booking_check_ins.checked_in_at desc limit 1) as scanned_by
       from booking_tickets
       join bookings on bookings.id = booking_tickets.booking_id
       join events on events.id = bookings.event_id
       left join payments on payments.booking_id = bookings.id
      where booking_tickets.ticket_code = upper(trim($1)) and bookings.organization_id = $2
      group by booking_tickets.ticket_code, booking_tickets.total_guests, booking_tickets.checked_in_count,
               bookings.id, bookings.status, bookings.booking_reference, bookings.buyer_name, bookings.buyer_email, events.title`,
    [ticketCode, organizationId],
  );
  if (!result.rowCount) return null;
  const row = result.rows[0];
  return {
    ticketCode: row.ticket_code as string,
    bookingReference: (row.booking_reference as string) || null,
    bookingStatus: row.booking_status as string,
    eventTitle: row.event_title as string,
    sessionId: (row.session_id as string) || null,
    sessionStartsAt: row.session_starts_at ? new Date(row.session_starts_at).toISOString() : null,
    sessionEndsAt: row.session_ends_at ? new Date(row.session_ends_at).toISOString() : null,
    buyerName: (row.buyer_name as string) || "",
    buyerEmail: (row.buyer_email as string) || "",
    guestBreakdown: (row.guest_breakdown as { name: string; quantity: number }[]) || [],
    totalGuests: Number(row.total_guests),
    checkedInCount: Number(row.checked_in_count),
    paid: Boolean(row.paid),
    testPayment: Boolean(row.test_payment),
    lastCheckedInAt: row.last_checked_in_at ? new Date(row.last_checked_in_at).toISOString() : null,
    scannedBy: (row.scanned_by as string) || null,
  };
}

/** Single-ticket state for the guest-facing link, so a reused ticket cannot look valid. */
export async function getBookingTicketState(bookingId: string) {
  if (!pool || !organizationId) return null;
  const result = await pool.query(
    `select booking_tickets.ticket_code, booking_tickets.total_guests, booking_tickets.checked_in_count,
            (select max(checked_in_at) from booking_check_ins where booking_check_ins.booking_ticket_id = booking_tickets.id) as last_checked_in_at
       from booking_tickets join bookings on bookings.id = booking_tickets.booking_id
      where booking_tickets.booking_id = $1 and bookings.organization_id = $2`,
    [bookingId, organizationId],
  );
  if (!result.rowCount) return null;
  const row = result.rows[0];
  return {
    ticketCode: row.ticket_code as string,
    totalGuests: Number(row.total_guests),
    checkedInCount: Number(row.checked_in_count),
    lastCheckedInAt: row.last_checked_in_at ? new Date(row.last_checked_in_at).toISOString() : null,
  };
}

export async function ensureStaffUser(email: string) {
  if (!pool || !organizationId) throw new Error("Database is not configured");
  const result = await pool.query("insert into users (organization_id, email, email_verified_at, status) values ($1, $2, now(), 'active') on conflict (organization_id, email) do update set status = 'active' returning id", [organizationId, email.trim().toLowerCase()]);
  return result.rows[0].id as string;
}

export async function getAccountByEmail(email: string) {
  if (!pool || !organizationId) return null;
  const result = await pool.query("select users.id, users.email, users.display_name, users.password_hash, users.status, coalesce(array_agg(permissions.key) filter (where permissions.key is not null), '{}') as permission_keys from users left join role_users on role_users.user_id = users.id left join permission_roles on permission_roles.role_id = role_users.role_id left join permissions on permissions.id = permission_roles.permission_id where users.organization_id = $1 and lower(users.email) = lower($2) group by users.id", [organizationId, email.trim()]);
  if (!result.rowCount) return null;
  const row = result.rows[0];
  return { id: row.id as string, email: row.email as string, displayName: row.display_name as string | null, passwordHash: row.password_hash as string | null, status: row.status as string, permissionKeys: row.permission_keys as string[] };
}

/** Creates the env break-glass account once; never updates it, so Admin resets and disables stick. */
export async function ensureBootstrapAdmin(email: string, passwordHash: string) {
  if (!pool || !organizationId) return null;
  const normalised = email.trim().toLowerCase();
  const otherAdmins = await pool.query(
    "select 1 from users join role_users on role_users.user_id = users.id join roles on roles.id = role_users.role_id and roles.name = 'Admin' where users.organization_id = $1 and users.status = 'active' and lower(users.email) <> $2 limit 1",
    [organizationId, normalised],
  );
  if (otherAdmins.rowCount) return null;
  const client = await pool.connect();
  try {
    await client.query("begin");
    const user = await client.query("insert into users (organization_id, email, display_name, password_hash, email_verified_at, status) values ($1, $2, 'Administrator', $3, now(), 'active') on conflict (organization_id, email) do nothing returning id", [organizationId, normalised, passwordHash]);
    if (user.rowCount === 0) { await client.query("rollback"); return null; }
    const role = await client.query("select id from roles where organization_id = $1 and name = 'Admin' limit 1", [organizationId]);
    if (role.rowCount) await client.query("insert into role_users (role_id, user_id) values ($1, $2) on conflict do nothing", [role.rows[0].id, user.rows[0].id]);
    await client.query("commit");
    return user.rows[0].id as string;
  } catch (error) { await client.query("rollback"); throw error; } finally { client.release(); }
}

export async function recordAccountSignIn(userId: string) {
  if (!pool) return;
  await pool.query("update users set last_signed_in_at = now() where id = $1", [userId]);
}

export async function createStaffAccount(input: { email: string; displayName: string; passwordHash: string; roleId: string }) {
  if (!pool || !organizationId) throw new Error("Database is not configured");
  const client = await pool.connect();
  try {
    await client.query("begin");
    const role = await client.query("select id from roles where id = $1 and organization_id = $2", [input.roleId, organizationId]);
    if (!role.rowCount) throw new Error("role_not_found");
    const user = await client.query("insert into users (organization_id, email, display_name, password_hash, email_verified_at, status, invited_at) values ($1, $2, $3, $4, now(), 'active', now()) returning id, email, display_name", [organizationId, input.email.trim().toLowerCase(), input.displayName.trim(), input.passwordHash]);
    await client.query("insert into role_users (role_id, user_id) values ($1, $2)", [input.roleId, user.rows[0].id]);
    await client.query("commit");
    return { id: user.rows[0].id as string, email: user.rows[0].email as string, displayName: user.rows[0].display_name as string };
  } catch (error) { await client.query("rollback"); throw error; } finally { client.release(); }
}

export type StaffAccount = { id: string; email: string; displayName: string | null; status: string; lastSignedInAt: string | null; roleId: string | null; roleName: string | null };

export async function listStaffAccounts(): Promise<StaffAccount[]> {
  if (!pool || !organizationId) return [];
  const result = await pool.query(
    `select users.id, users.email, users.display_name, users.status, users.last_signed_in_at,
            (array_agg(roles.id order by roles.name))[1] as role_id,
            string_agg(roles.name, ', ' order by roles.name) as role_names
       from users
       join role_users on role_users.user_id = users.id
       join roles on roles.id = role_users.role_id and roles.name <> 'User'
      where users.organization_id = $1
      group by users.id
      order by lower(users.email)`,
    [organizationId],
  );
  return result.rows.map((row) => ({
    id: row.id as string,
    email: row.email as string,
    displayName: (row.display_name as string | null) ?? null,
    status: row.status as string,
    lastSignedInAt: row.last_signed_in_at ? new Date(row.last_signed_in_at).toISOString() : null,
    roleId: (row.role_id as string | null) ?? null,
    roleName: (row.role_names as string | null) ?? null,
  }));
}

async function requireStaffUser(userId: string) {
  if (!pool || !organizationId) throw new Error("Database is not configured");
  const result = await pool.query(
    "select users.id, users.email from users join role_users on role_users.user_id = users.id join roles on roles.id = role_users.role_id and roles.name <> 'User' where users.id = $1 and users.organization_id = $2 limit 1",
    [userId, organizationId],
  );
  if (result.rowCount === 0) throw new Error("staff_not_found");
  return result.rows[0] as { id: string; email: string };
}

export type StaffAuthState = { status: string; sessionVersion: number; mustChangePassword: boolean };

export async function getStaffAuthState(userId: string): Promise<StaffAuthState | null> {
  if (!pool || !organizationId) return null;
  const result = await pool.query("select status, session_version, must_change_password from users where id = $1 and organization_id = $2", [userId, organizationId]);
  if (result.rowCount === 0) return null;
  const row = result.rows[0];
  return { status: row.status as string, sessionVersion: Number(row.session_version), mustChangePassword: Boolean(row.must_change_password) };
}

export async function setStaffDisplayName(userId: string, displayName: string, actor?: AuditActor) {
  if (!pool) throw new Error("Database is not configured");
  const staff = await requireStaffUser(userId);
  await pool.query("update users set display_name = $1 where id = $2", [displayName, userId]);
  await writeAuditLog("staff.renamed", { staff: staff.email, displayName, ...auditActor(actor).metadata }, auditActor(actor).context);
}

/** Changing your own password ends every other session and clears the forced-change flag. */
export async function changeOwnPassword(userId: string, passwordHash: string) {
  if (!pool) throw new Error("Database is not configured");
  const result = await pool.query("update users set password_hash = $1, must_change_password = false, session_version = session_version + 1, password_reset_token_hash = null, password_reset_expires_at = null where id = $2 returning email, session_version", [passwordHash, userId]);
  if (result.rowCount === 0) throw new Error("staff_not_found");
  await writeAuditLog("staff.password_changed", { staff: result.rows[0].email, staffEmail: result.rows[0].email }, { userId });
  return Number(result.rows[0].session_version);
}

export async function setStaffAccountStatus(userId: string, status: "active" | "disabled", actor?: AuditActor) {
  if (!pool) throw new Error("Database is not configured");
  const staff = await requireStaffUser(userId);
  await pool.query("update users set status = $1, session_version = session_version + case when $1 = 'disabled' then 1 else 0 end where id = $2", [status, userId]);
  await writeAuditLog(status === "disabled" ? "staff.disabled" : "staff.enabled", { staff: staff.email, ...auditActor(actor).metadata }, auditActor(actor).context);
}

export async function resetStaffPassword(userId: string, passwordHash: string, actor?: AuditActor) {
  if (!pool) throw new Error("Database is not configured");
  const staff = await requireStaffUser(userId);
  await pool.query("update users set password_hash = $1, must_change_password = true, session_version = session_version + 1, password_reset_token_hash = null, password_reset_expires_at = null where id = $2", [passwordHash, userId]);
  await writeAuditLog("staff.password_reset", { staff: staff.email, ...auditActor(actor).metadata }, auditActor(actor).context);
}

let loginAttemptsPruned = false;

/** Sign-in history is only needed for recent lockouts and review, so prune it once per server instance. */
function pruneLoginAttempts() {
  if (pool === null || loginAttemptsPruned) return;
  loginAttemptsPruned = true;
  pool.query("delete from login_attempts where created_at < now() - interval '30 days'").catch((error) => {
    loginAttemptsPruned = false;
    console.error("login attempt prune failed", error instanceof Error ? error.message : error);
  });
}

export const LOGIN_LOCKOUT = { maxFailuresPerEmail: 5, maxFailuresPerIp: 20, windowMinutes: 15 };

/** Failures count only since the last successful sign-in for that email. */
export async function loginLockState(scope: "staff" | "customer", email: string, ip: string | null) {
  if (!pool) return { locked: false, retryAfterSeconds: 0, reason: null as "email" | "ip" | null };
  pruneLoginAttempts();
  const normalised = email.trim().toLowerCase();
  const window = `${LOGIN_LOCKOUT.windowMinutes} minutes`;
  const result = await pool.query(
    `select
       (select count(*)::int from login_attempts a where a.scope = $1 and a.email = $2 and a.succeeded = false and a.created_at > now() - $4::interval
          and a.created_at > coalesce((select max(created_at) from login_attempts s where s.scope = $1 and s.email = $2 and s.succeeded = true), 'epoch')) as email_failures,
       (select count(*)::int from login_attempts a where a.scope = $1 and $3::text is not null and a.ip = $3 and a.succeeded = false and a.created_at > now() - $4::interval) as ip_failures,
       (select extract(epoch from (min(created_at) + $4::interval - now()))::int from (select created_at from login_attempts where scope = $1 and email = $2 and succeeded = false and created_at > now() - $4::interval order by created_at desc limit ${LOGIN_LOCKOUT.maxFailuresPerEmail}) recent) as retry_after`,
    [scope, normalised, ip, window],
  );
  const row = result.rows[0];
  const reason: "email" | "ip" | null = row.email_failures >= LOGIN_LOCKOUT.maxFailuresPerEmail ? "email" : row.ip_failures >= LOGIN_LOCKOUT.maxFailuresPerIp ? "ip" : null;
  const locked = reason !== null;
  return { locked, retryAfterSeconds: locked ? Math.max(60, Number(row.retry_after) || LOGIN_LOCKOUT.windowMinutes * 60) : 0, reason };
}

export async function recordLoginAttempt(scope: "staff" | "customer", email: string, ip: string | null, succeeded: boolean) {
  if (!pool) return;
  await pool.query("insert into login_attempts (organization_id, scope, email, ip, succeeded) values ($1, $2, $3, $4, $5)", [organizationId ?? null, scope, email.trim().toLowerCase(), ip, succeeded]);
}

export async function createCustomerAccount(input: { email: string; displayName: string; passwordHash: string }) {
  if (!pool || !organizationId) throw new Error("Database is not configured");
  const client = await pool.connect();
  try {
    await client.query("begin");
    const user = await client.query("insert into users (organization_id, email, display_name, password_hash, email_verified_at, status) values ($1, $2, $3, $4, now(), 'active') returning id, email, display_name", [organizationId, input.email.trim().toLowerCase(), input.displayName.trim(), input.passwordHash]);
    const role = await client.query("select id from roles where organization_id = $1 and name = 'User' limit 1", [organizationId]);
    if (role.rowCount) await client.query("insert into role_users (role_id, user_id) values ($1, $2) on conflict do nothing", [role.rows[0].id, user.rows[0].id]);
    await client.query("commit");
    return { id: user.rows[0].id as string, email: user.rows[0].email as string, displayName: user.rows[0].display_name as string };
  } catch (error) { await client.query("rollback"); throw error; } finally { client.release(); }
}

export async function listCustomerTickets(email: string) {
  if (!pool || !organizationId) return [];
  const result = await pool.query("select tickets.id, tickets.ticket_code, tickets.status, events.title as event_title, events.starts_at, venues.name as venue, bookings.id as booking_id from tickets join bookings on bookings.id = tickets.booking_id join events on events.id = tickets.event_id left join venues on venues.id = events.venue_id where bookings.organization_id = $1 and lower(bookings.buyer_email) = lower($2) and bookings.status = 'confirmed' order by events.starts_at, tickets.created_at", [organizationId, email]);
  return result.rows.map((row) => ({ id: row.id as string, ticketCode: row.ticket_code as string, status: row.status as string, eventTitle: row.event_title as string, startsAt: row.starts_at.toISOString(), venue: (row.venue || "Hilston Park") as string, bookingId: row.booking_id as string }));
}

export async function customerOwnsTicket(email: string, ticketCode: string) {
  if (!pool || !organizationId) return false;
  const result = await pool.query("select 1 from tickets join bookings on bookings.id = tickets.booking_id where bookings.organization_id = $1 and lower(bookings.buyer_email) = lower($2) and tickets.ticket_code = $3 and bookings.status = 'confirmed'", [organizationId, email, ticketCode]);
  return result.rowCount === 1;
}

export type AuditActor = { email?: string | null; userId?: string | null } | null | undefined;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function auditActor(actor: AuditActor) {
  const userId = actor?.userId && UUID_PATTERN.test(actor.userId) ? actor.userId : null;
  return { metadata: { staffEmail: actor?.email || null }, context: { userId } };
}

export async function writeAuditLog(action: string, metadata: Record<string, unknown> = {}, context?: { ip?: string | null; userAgent?: string | null; userId?: string | null }) {
  if (!pool || !organizationId) return;
  await pool.query("insert into activity_logs (organization_id, actor_user_id, action, ip, user_agent, metadata) values ($1, $2, $3, $4, $5, $6)", [organizationId, context?.userId ?? null, action, context?.ip || null, context?.userAgent || null, metadata]);
}

/** FR-ID-02: disposable signup domains are refused before an account is created. */
export async function isBlockedEmailDomain(email: string) {
  if (!pool || !organizationId) return false;
  const domain = email.split("@")[1]?.trim().toLowerCase();
  if (!domain) return true;
  try {
    const result = await pool.query("select 1 from blocked_email_domains where organization_id = $1 and lower(domain) = $2 and active = true limit 1", [organizationId, domain]);
    return Boolean(result.rowCount);
  } catch {
    return false;
  }
}

/** FR-ID-03: failed registrations are logged with the signup IP and never notify operations. */
export async function logRegistrationAttempt(input: { email: string; ip: string | null; userAgent: string | null; reason: string }) {
  if (!pool || !organizationId) return;
  await pool.query("insert into registration_attempts (organization_id, email, ip, reason) values ($1, $2, $3, $4)", [organizationId, input.email.trim().toLowerCase(), input.ip, input.reason]);
  await writeAuditLog("registration.rejected", { email: input.email.trim().toLowerCase(), reason: input.reason }, { ip: input.ip, userAgent: input.userAgent });
}

export async function listBlockedEmailDomains() {
  if (!pool || !organizationId) return [];
  const result = await pool.query("select domain from blocked_email_domains where organization_id = $1 and active = true order by domain", [organizationId]);
  return result.rows.map((row) => row.domain as string);
}

export async function getOperationsReport() {
  if (!pool || !organizationId) throw new Error("Database is not configured");
  const [sales, events, recent] = await Promise.all([
    pool.query("select count(*)::int as bookings, coalesce(sum(payments.amount_pence), 0)::int as current_revenue_pence, coalesce(sum(case when bookings.status = 'confirmed' then payments.amount_pence else 0 end), 0)::int as projected_revenue_pence from bookings left join payments on payments.booking_id = bookings.id where bookings.organization_id = $1 and payments.status = 'succeeded' and payments.provider <> 'mock'", [organizationId]),
    pool.query("select count(*)::int as published_events from events where organization_id = $1 and published = true and archived_at is null and cancelled_at is null", [organizationId]),
    pool.query("select action, metadata, created_at from activity_logs where organization_id = $1 order by created_at desc limit 20", [organizationId]),
  ]);
  return { sales: sales.rows[0], publishedEvents: events.rows[0].published_events, activity: recent.rows.map((row) => ({ action: row.action as string, metadata: row.metadata as Record<string, unknown>, createdAt: row.created_at.toISOString() })) };
}

export async function createGdprRequest(input: { email: string; requestType: "export" | "erase" }) {
  if (!pool || !organizationId) throw new Error("Database is not configured");
  const user = await pool.query("select id from users where organization_id = $1 and lower(email) = lower($2)", [organizationId, input.email]);
  if (!user.rowCount) throw new Error("account_not_found");
  const request = await pool.query("insert into gdpr_requests (organization_id, user_id, request_type) values ($1, $2, $3) returning id, status, created_at", [organizationId, user.rows[0].id, input.requestType]);
  await writeAuditLog(`gdpr.${input.requestType}.requested`, { email: input.email });
  return { id: request.rows[0].id as string, status: request.rows[0].status as string, createdAt: request.rows[0].created_at.toISOString() };
}

export async function prepareBookingConfirmation(attendeeId: string) {
  if (!pool || !organizationId) throw new Error("Database is not configured");
  const attendee = await pool.query("select attendees.id, attendees.name, attendees.email, events.title as event_title, bookings.id as booking_id from attendees join events on events.id = attendees.event_id left join bookings on bookings.id = attendees.booking_id where attendees.id = $1 and events.organization_id = $2", [attendeeId, organizationId]);
  if (!attendee.rowCount) throw new Error("attendee_not_found");
  const row = attendee.rows[0];
  const dispatchKey = `attendee:${row.id}:confirmation`;
  const dispatch = await pool.query("insert into notification_dispatches (organization_id, dispatch_key, template_key, recipient, status) values ($1, $2, 'booking_confirmation', $3, 'pending') on conflict (dispatch_key) do update set recipient = excluded.recipient returning id, status", [organizationId, dispatchKey, row.email]);
  return { dispatchId: dispatch.rows[0].id as string, status: dispatch.rows[0].status as string, name: row.name as string, email: row.email as string, eventTitle: row.event_title as string, bookingId: row.booking_id as string | null };
}

export async function markNotificationSent(id: string, providerRef: string) {
  if (!pool) return;
  await pool.query("update notification_dispatches set status = 'sent', provider_ref = $2, sent_at = now(), last_error = null where id = $1", [id, providerRef]);
}

export async function markNotificationFailed(id: string, error: string) {
  if (!pool) return;
  await pool.query("update notification_dispatches set status = 'failed', last_error = $2 where id = $1", [id, error.slice(0, 1000)]);
}

export type BookingItem = { name: string; quantity: number; unitPricePence: number };
export type BookingPayment = { provider: string; paymentIntentId: string; paidAt: string } | null;
export type BookingDetail = {
  bookingId: string;
  bookingReference: string | null;
  attendeeId: string | null;
  eventId: string;
  eventTitle: string;
  startsAt: string;
  venue: string;
  name: string;
  email: string;
  phone: string | null;
  specialRequests: string | null;
  sessionStartsAt: string | null;
  childCount: number;
  totalGuests: number;
  guestsCheckedIn: number;
  ticketCode: string | null;
  status: string;
  paid: boolean;
  testPayment: boolean;
  totalPence: number;
  createdAt: string;
  confirmationStatus: string | null;
  confirmationSentAt: string | null;
  items: BookingItem[];
  payment: BookingPayment;
};

/** Full booking records for the staff console, guest-counted rather than ticket-row-counted (Phase 10.1). */
export async function listBookingDetails(eventId?: string): Promise<BookingDetail[]> {
  if (!pool || !organizationId) return [];
  const params: unknown[] = [organizationId];
  if (eventId) params.push(eventId);
  const result = await pool.query(`
    select bookings.id as booking_id, bookings.booking_reference, bookings.status, bookings.total_pence, bookings.created_at,
           bookings.buyer_name, bookings.buyer_email, bookings.buyer_phone, bookings.special_requests,
           (select min(es.starts_at) from booking_items bi join ticket_types tt on tt.id = bi.ticket_type_id join event_sessions es on es.id = tt.event_session_id where bi.booking_id = bookings.id) as session_starts_at,
           events.id as event_id, events.title as event_title, events.starts_at,
           coalesce(venues.name, 'Hilston Park') as venue,
           attendees.id as attendee_id, coalesce(attendees.child_count, 0) as child_count,
           coalesce(bool_or(payments.status = 'succeeded' and payments.provider <> 'mock'), false) as paid,
           coalesce(bool_or(payments.status = 'succeeded' and payments.provider = 'mock'), false) as test_payment,
           booking_tickets.ticket_code, coalesce(booking_tickets.total_guests, 0) as total_guests, coalesce(booking_tickets.checked_in_count, 0) as guests_checked_in,
           max(dispatch.status) as confirmation_status,
           max(dispatch.sent_at) as confirmation_sent_at,
           (select coalesce(json_agg(json_build_object('name', ticket_types.name, 'quantity', booking_items.quantity, 'unitPricePence', booking_items.unit_price_pence) order by ticket_types.name), '[]') from booking_items join ticket_types on ticket_types.id = booking_items.ticket_type_id where booking_items.booking_id = bookings.id) as items,
           (select json_build_object('provider', p.provider, 'paymentIntentId', p.payment_intent_id, 'paidAt', p.created_at) from payments p where p.booking_id = bookings.id and p.status = 'succeeded' order by p.created_at desc limit 1) as payment
    from bookings
    join events on events.id = bookings.event_id
    left join venues on venues.id = events.venue_id
    left join attendees on attendees.booking_id = bookings.id
    left join payments on payments.booking_id = bookings.id
    left join booking_tickets on booking_tickets.booking_id = bookings.id
    left join notification_dispatches dispatch on dispatch.dispatch_key = 'booking:' || bookings.id::text || ':guest'
    where bookings.organization_id = $1 ${eventId ? "and events.id = $2" : ""}
    group by bookings.id, events.id, venues.name, attendees.id, booking_tickets.ticket_code, booking_tickets.total_guests, booking_tickets.checked_in_count
    order by bookings.created_at desc
    limit 500`, params);
  return result.rows.map((row) => ({
    bookingId: row.booking_id as string,
    bookingReference: (row.booking_reference as string | null) ?? null,
    attendeeId: (row.attendee_id as string | null) ?? null,
    eventId: row.event_id as string,
    eventTitle: row.event_title as string,
    startsAt: row.starts_at.toISOString(),
    venue: row.venue as string,
    name: (row.buyer_name as string) || "Guest",
    email: (row.buyer_email as string) || "",
    phone: (row.buyer_phone as string | null) || null,
    specialRequests: (row.special_requests as string | null) || null,
    sessionStartsAt: row.session_starts_at ? new Date(row.session_starts_at).toISOString() : null,
    childCount: Number(row.child_count || 0),
    totalGuests: Number(row.total_guests || 0),
    guestsCheckedIn: Number(row.guests_checked_in || 0),
    ticketCode: (row.ticket_code as string | null) ?? null,
    status: row.status as string,
    paid: Boolean(row.paid),
    testPayment: Boolean(row.test_payment),
    totalPence: Number(row.total_pence || 0),
    createdAt: row.created_at.toISOString(),
    confirmationStatus: (row.confirmation_status as string | null) ?? null,
    confirmationSentAt: row.confirmation_sent_at ? new Date(row.confirmation_sent_at).toISOString() : null,
    items: (row.items as BookingItem[]) || [],
    payment: row.payment ? { provider: row.payment.provider as string, paymentIntentId: row.payment.paymentIntentId as string, paidAt: new Date(row.payment.paidAt).toISOString() } : null,
  }));
}

export async function getBookingForEmail(bookingId: string) {
  if (!pool || !organizationId) throw new Error("Database is not configured");
  const result = await pool.query(
    `select bookings.id, bookings.booking_reference, bookings.buyer_name, bookings.buyer_email,
            events.title as event_title, events.starts_at, coalesce(venues.name, 'Hilston Park') as venue,
            booking_tickets.ticket_code, coalesce(booking_tickets.total_guests, 0) as total_guests
       from bookings
       join events on events.id = bookings.event_id
       left join venues on venues.id = events.venue_id
       left join booking_tickets on booking_tickets.booking_id = bookings.id
      where bookings.id = $1 and bookings.organization_id = $2`,
    [bookingId, organizationId],
  );
  if (!result.rowCount) throw new Error("booking_not_found");
  const row = result.rows[0];
  return {
    bookingId: row.id as string,
    bookingReference: (row.booking_reference as string | null) ?? null,
    name: (row.buyer_name as string) || "Guest",
    email: row.buyer_email as string,
    eventTitle: row.event_title as string,
    startsAt: row.starts_at.toISOString(),
    venue: row.venue as string,
    ticketCode: (row.ticket_code as string | null) ?? null,
    totalGuests: Number(row.total_guests || 0),
  };
}

export async function markDispatchByKey(dispatchKey: string, outcome: { status: "sent" | "failed"; providerRef?: string; error?: string }) {
  if (!pool || !organizationId) return;
  if (outcome.status === "sent") {
    await pool.query("update notification_dispatches set status = 'sent', provider_ref = $2, sent_at = now(), last_error = null where organization_id = $1 and dispatch_key = $3", [organizationId, outcome.providerRef || "email", dispatchKey]);
    return;
  }
  await pool.query("update notification_dispatches set status = 'failed', last_error = $2 where organization_id = $1 and dispatch_key = $3", [organizationId, (outcome.error || "unknown").slice(0, 1000), dispatchKey]);
}
