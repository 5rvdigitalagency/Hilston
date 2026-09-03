import { Pool } from "pg";
import type { AttendeeRecord, EventRecord } from "./store";
import { getOrgSettings } from "./settings";

const pool = process.env.DATABASE_URL ? new Pool({ connectionString: process.env.DATABASE_URL, max: 5, ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : undefined }) : null;
const organizationId = process.env.ORGANIZATION_ID;

export function isRemoteDatabaseUrl(value: string | undefined) {
  if (!value) return false;
  try { const host = new URL(value).hostname; return !["localhost", "127.0.0.1", "::1"].includes(host); } catch { return false; }
}

export const databaseEnabled = Boolean(pool && organizationId && isRemoteDatabaseUrl(process.env.DATABASE_URL));

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

let lifecycleSchemaReady: Promise<void> | null = null;

/** Adds the additive archive column once per instance so archiving works without a manual migration step. */
function ensureLifecycleSchema() {
  if (!pool) return Promise.resolve();
  if (!lifecycleSchemaReady) {
    lifecycleSchemaReady = pool.query("alter table events add column if not exists archived_at timestamptz").then(() => undefined).catch((error) => {
      console.error("lifecycle schema check failed", error instanceof Error ? error.message : error);
    });
  }
  return lifecycleSchemaReady;
}

export async function listEvents(includeDrafts = false): Promise<EventRecord[]> {
  if (!pool || !organizationId) return [];
  await ensureLifecycleSchema();
  const visibility = includeDrafts ? "true" : "(e.published = true and e.archived_at is null)";
  let result;
  try {
    result = await pool.query(`select e.id, e.title, e.description, e.starts_at, e.category_id, e.archived_at, coalesce(c.name, 'Upcoming event') as category, e.audience_policy, e.min_age, e.max_age, v.name as venue, s.capacity, e.published, count(distinct a.id)::int as attendee_count, coalesce(sum(a.child_count), 0)::int as child_count, e.created_at from events e left join event_categories c on c.id = e.category_id left join venues v on v.id = e.venue_id left join lateral (select capacity from event_sessions where event_id = e.id order by starts_at limit 1) s on true left join attendees a on a.event_id = e.id where e.organization_id = $1 and ${visibility} group by e.id, c.name, v.name, s.capacity order by e.starts_at`, [organizationId]);
  } catch (error) {
    if (!(error instanceof Error) || !/event_categories|category_id|archived_at/.test(error.message)) throw error;
    result = await pool.query(`select e.id, e.title, e.description, e.starts_at, 'Upcoming event' as category, e.audience_policy, e.min_age, e.max_age, v.name as venue, s.capacity, e.published, count(distinct a.id)::int as attendee_count, coalesce(sum(a.child_count), 0)::int as child_count, e.created_at from events e left join venues v on v.id = e.venue_id left join lateral (select capacity from event_sessions where event_id = e.id order by starts_at limit 1) s on true left join attendees a on a.event_id = e.id where e.organization_id = $1 and ($2 or e.published = true) group by e.id, v.name, s.capacity order by e.starts_at`, [organizationId, includeDrafts]);
  }
  return result.rows.map((row) => ({ id: row.id, title: row.title, description: row.description, startsAt: row.starts_at.toISOString(), category: row.category, categoryId: row.category_id ?? undefined, audiencePolicy: row.audience_policy, minAge: row.min_age ?? undefined, maxAge: row.max_age ?? undefined, venue: row.venue || "", capacity: row.capacity || 0, published: row.published, archived: Boolean(row.archived_at), attendeeCount: row.attendee_count, childCount: row.child_count, createdAt: row.created_at.toISOString() }));
}

export async function setEventArchived(eventId: string, archived: boolean) {
  if (!pool || !organizationId) throw new Error("Database is not configured");
  await ensureLifecycleSchema();
  const result = await pool.query("update events set archived_at = case when $1 then now() else null end where id = $2 and organization_id = $3 returning id", [archived, eventId, organizationId]);
  if (!result.rowCount) throw new Error("event_not_found");
  await writeAuditLog(archived ? "event.archived" : "event.restored", { eventId });
}

/** Permanently removes an event and everything attached to it. Used only when no booking exists. */
export async function deleteEventCascade(eventId: string) {
  if (!pool || !organizationId) throw new Error("Database is not configured");
  const client = await pool.connect();
  try {
    await client.query("begin");
    const owned = await client.query("select id from events where id = $1 and organization_id = $2 for update", [eventId, organizationId]);
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
  await writeAuditLog("event.deleted", { eventId });
}

export async function insertEvent(input: Omit<EventRecord, "id" | "attendeeCount" | "childCount" | "createdAt">): Promise<EventRecord> {
  if (!pool || !organizationId) throw new Error("Database is not configured");
  const client = await pool.connect();
  try { await client.query("begin"); const venue = await client.query("insert into venues (organization_id, name) values ($1, $2) returning id", [organizationId, input.venue]); const result = await client.query("insert into events (organization_id, venue_id, category_id, title, description, starts_at, audience_policy, min_age, max_age, published) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) returning id, created_at", [organizationId, venue.rows[0].id, input.categoryId ?? null, input.title, input.description, input.startsAt, input.audiencePolicy, input.minAge ?? null, input.maxAge ?? null, input.published]); const event = { ...input, id: result.rows[0].id, attendeeCount: 0, childCount: 0, createdAt: result.rows[0].created_at.toISOString() }; await client.query("insert into event_sessions (event_id, starts_at, capacity) values ($1,$2,$3)", [event.id, input.startsAt, input.capacity]); await client.query("commit"); return event; } catch (error) { await client.query("rollback"); throw error; } finally { client.release(); }
}

export async function updateEvent(id: string, input: Omit<EventRecord, "id" | "attendeeCount" | "childCount" | "createdAt">): Promise<EventRecord | null> {
  if (!pool || !organizationId) throw new Error("Database is not configured");
  const client = await pool.connect();
  try {
    await client.query("begin");
    const venue = await client.query("insert into venues (organization_id, name) values ($1, $2) returning id", [organizationId, input.venue]);
    const updated = await client.query("update events set venue_id = $1, category_id = $2, title = $3, description = $4, starts_at = $5, audience_policy = $6, min_age = $7, max_age = $8, published = $9 where id = $10 and organization_id = $11 returning id, created_at", [venue.rows[0].id, input.categoryId ?? null, input.title, input.description, input.startsAt, input.audiencePolicy, input.minAge ?? null, input.maxAge ?? null, input.published, id, organizationId]);
    if (!updated.rowCount) { await client.query("rollback"); return null; }
    await client.query("update event_sessions set starts_at = $2, capacity = $3 where event_id = $1", [id, input.startsAt, input.capacity]);
    const attendees = await client.query("select count(*)::int as attendee_count, coalesce(sum(child_count), 0)::int as child_count from attendees where event_id = $1", [id]);
    await client.query("commit");
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

export async function createMockBooking(input: { eventId: string; name: string; email: string; childCount: number; staffEmail?: string }) {
  if (!pool || !organizationId) throw new Error("Database is not configured");
  const client = await pool.connect();
  try {
    await client.query("begin");
    const event = await client.query("select events.id, events.title, event_sessions.capacity from events join event_sessions on event_sessions.event_id = events.id where events.id = $1 and events.organization_id = $2 and events.published = true order by event_sessions.starts_at limit 1 for update", [input.eventId, organizationId]);
    if (!event.rowCount) throw new Error("event_not_found");
    // Capacity counts people, so each attendee is one adult plus their children.
    const current = await client.query("select coalesce(sum(child_count + 1), 0)::int as guest_count from attendees where event_id = $1", [input.eventId]);
    const ticketCount = input.childCount + 1;
    if (current.rows[0].guest_count + ticketCount > event.rows[0].capacity) throw new Error("event_full");
    const booking = await client.query("insert into bookings (organization_id, event_id, status, sales_channel, buyer_name, buyer_email, total_pence, confirmed_at) values ($1, $2, 'confirmed', 'online', $3, $4, 0, now()) returning id", [organizationId, input.eventId, input.name, input.email]);
    const bookingId = booking.rows[0].id as string;
    const attendee = await client.query("insert into attendees (booking_id, event_id, name, email, child_count) values ($1, $2, $3, $4, $5) returning id", [bookingId, input.eventId, input.name, input.email, input.childCount]);
    await client.query("insert into payments (booking_id, provider, stripe_mode, payment_intent_id, amount_pence, status) values ($1, 'mock', 'test', $2, 0, 'succeeded')", [bookingId, `mock_${crypto.randomUUID()}`]);
    const tickets = [];
    const { ticketPrefix } = await getOrgSettings(pool, organizationId);
    for (let index = 0; index < ticketCount; index += 1) {
      const ticketCode = `${ticketPrefix}-${crypto.randomUUID().replace(/-/g, "").slice(0, 12).toUpperCase()}`;
      const ticket = await client.query("insert into tickets (booking_id, event_id, ticket_code, status) values ($1, $2, $3, 'issued') returning id, ticket_code", [bookingId, input.eventId, ticketCode]);
      tickets.push({ id: ticket.rows[0].id as string, ticketCode: ticket.rows[0].ticket_code as string });
    }
    await client.query("insert into notification_dispatches (organization_id, dispatch_key, template_key, recipient, status) values ($1, $2, 'booking_confirmation', $3, 'pending')", [organizationId, `booking:${bookingId}:guest`, input.email]);
    if (input.staffEmail) await client.query("insert into notification_dispatches (organization_id, dispatch_key, template_key, recipient, status) values ($1, $2, 'new_booking_staff', $3, 'pending')", [organizationId, `booking:${bookingId}:staff`, input.staffEmail]);
    await client.query("commit");
    await writeAuditLog("booking.confirmed", { bookingId, eventId: input.eventId, ticketCount });
    return { bookingId, attendeeId: attendee.rows[0].id as string, eventTitle: event.rows[0].title as string, tickets };
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

export async function checkInTicket(ticketCode: string, staffUserId: string, ip: string | null, userAgent: string | null) {
  if (!pool || !organizationId) throw new Error("Database is not configured");
  const result = await pool.query("select * from check_in_ticket($1, $2, $3, $4)", [ticketCode, staffUserId, ip, userAgent]);
  return result.rows[0];
}

/** Scan history for a ticket, so staff can see when a duplicate was first used. */
export async function getTicketScanDetails(ticketCode: string) {
  if (!pool || !organizationId) return null;
  const result = await pool.query(
    `select tickets.ticket_code, tickets.status, events.title as event_title,
            bookings.buyer_name, bookings.buyer_email,
            check_ins.checked_in_at, users.email as scanned_by
     from tickets
     join events on events.id = tickets.event_id
     left join bookings on bookings.id = tickets.booking_id
     left join check_ins on check_ins.ticket_id = tickets.id
     left join users on users.id = check_ins.staff_user_id
     where upper(trim(tickets.ticket_code)) = upper(trim($1)) and events.organization_id = $2
     order by check_ins.checked_in_at asc limit 1`,
    [ticketCode, organizationId],
  );
  if (!result.rowCount) return null;
  const row = result.rows[0];
  return {
    ticketCode: row.ticket_code as string,
    status: row.status as string,
    eventTitle: row.event_title as string,
    guestName: (row.buyer_name as string) || "",
    guestEmail: (row.buyer_email as string) || "",
    checkedInAt: row.checked_in_at ? new Date(row.checked_in_at).toISOString() : null,
    scannedBy: (row.scanned_by as string) || null,
  };
}

/** Ticket states for the guest-facing link, so a reused ticket cannot look valid. */
export async function getBookingTicketStates(bookingId: string) {
  if (!pool || !organizationId) return [];
  const result = await pool.query(
    `select tickets.ticket_code, tickets.status,
            (select max(checked_in_at) from check_ins where check_ins.ticket_id = tickets.id) as checked_in_at
     from tickets join bookings on bookings.id = tickets.booking_id
     where tickets.booking_id = $1 and bookings.organization_id = $2
     order by tickets.created_at`,
    [bookingId, organizationId],
  );
  return result.rows.map((row) => ({
    ticketCode: row.ticket_code as string,
    status: row.status as string,
    checkedInAt: row.checked_in_at ? new Date(row.checked_in_at).toISOString() : null,
  }));
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

export async function ensureBootstrapAdmin(email: string, passwordHash: string) {
  if (!pool || !organizationId) return null;
  const client = await pool.connect();
  try {
    await client.query("begin");
    const user = await client.query("insert into users (organization_id, email, display_name, password_hash, email_verified_at, status) values ($1, $2, 'Administrator', $3, now(), 'active') on conflict (organization_id, email) do update set password_hash = coalesce(users.password_hash, excluded.password_hash), status = 'active' returning id", [organizationId, email.trim().toLowerCase(), passwordHash]);
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
    pool.query("select count(*)::int as bookings, coalesce(sum(payments.amount_pence), 0)::int as current_revenue_pence, coalesce(sum(case when bookings.status = 'confirmed' then payments.amount_pence else 0 end), 0)::int as projected_revenue_pence from bookings left join payments on payments.booking_id = bookings.id where bookings.organization_id = $1 and payments.status = 'succeeded'", [organizationId]),
    pool.query("select count(*)::int as published_events from events where organization_id = $1 and published = true", [organizationId]),
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

export type BookingTicket = { id: string; ticketCode: string; status: string; checkedInAt: string | null };
export type BookingDetail = {
  bookingId: string;
  attendeeId: string | null;
  eventId: string;
  eventTitle: string;
  startsAt: string;
  venue: string;
  name: string;
  email: string;
  childCount: number;
  ticketCount: number;
  status: string;
  paid: boolean;
  totalPence: number;
  createdAt: string;
  confirmationStatus: string | null;
  confirmationSentAt: string | null;
  tickets: BookingTicket[];
};

/** Full booking records for the staff console, including issued tickets for QR display. */
export async function listBookingDetails(eventId?: string): Promise<BookingDetail[]> {
  if (!pool || !organizationId) return [];
  const params: unknown[] = [organizationId];
  if (eventId) params.push(eventId);
  const result = await pool.query(`
    select bookings.id as booking_id, bookings.status, bookings.total_pence, bookings.created_at,
           bookings.buyer_name, bookings.buyer_email,
           events.id as event_id, events.title as event_title, events.starts_at,
           coalesce(venues.name, 'Hilston Park') as venue,
           attendees.id as attendee_id, coalesce(attendees.child_count, 0) as child_count,
           coalesce(bool_or(payments.status = 'succeeded'), false) as paid,
           coalesce(json_agg(json_build_object('id', tickets.id, 'ticketCode', tickets.ticket_code, 'status', tickets.status, 'checkedInAt', (select max(check_ins.checked_in_at) from check_ins where check_ins.ticket_id = tickets.id)) order by tickets.created_at) filter (where tickets.id is not null), '[]') as tickets,
           max(dispatch.status) as confirmation_status,
           max(dispatch.sent_at) as confirmation_sent_at
    from bookings
    join events on events.id = bookings.event_id
    left join venues on venues.id = events.venue_id
    left join attendees on attendees.booking_id = bookings.id
    left join payments on payments.booking_id = bookings.id
    left join tickets on tickets.booking_id = bookings.id
    left join notification_dispatches dispatch on dispatch.dispatch_key = 'booking:' || bookings.id::text || ':guest'
    where bookings.organization_id = $1 ${eventId ? "and events.id = $2" : ""}
    group by bookings.id, events.id, venues.name, attendees.id
    order by bookings.created_at desc
    limit 500`, params);
  return result.rows.map((row) => ({
    bookingId: row.booking_id as string,
    attendeeId: (row.attendee_id as string | null) ?? null,
    eventId: row.event_id as string,
    eventTitle: row.event_title as string,
    startsAt: row.starts_at.toISOString(),
    venue: row.venue as string,
    name: (row.buyer_name as string) || "Guest",
    email: (row.buyer_email as string) || "",
    childCount: Number(row.child_count || 0),
    ticketCount: (row.tickets as BookingTicket[]).length,
    status: row.status as string,
    paid: Boolean(row.paid),
    totalPence: Number(row.total_pence || 0),
    createdAt: row.created_at.toISOString(),
    confirmationStatus: (row.confirmation_status as string | null) ?? null,
    confirmationSentAt: row.confirmation_sent_at ? new Date(row.confirmation_sent_at).toISOString() : null,
    tickets: row.tickets as BookingTicket[],
  }));
}

export async function getBookingForEmail(bookingId: string) {
  if (!pool || !organizationId) throw new Error("Database is not configured");
  const result = await pool.query("select bookings.id, bookings.buyer_name, bookings.buyer_email, events.title as event_title, events.starts_at, coalesce(venues.name, 'Hilston Park') as venue, coalesce(json_agg(tickets.ticket_code order by tickets.created_at) filter (where tickets.id is not null), '[]') as ticket_codes from bookings join events on events.id = bookings.event_id left join venues on venues.id = events.venue_id left join tickets on tickets.booking_id = bookings.id where bookings.id = $1 and bookings.organization_id = $2 group by bookings.id, events.id, venues.name", [bookingId, organizationId]);
  if (!result.rowCount) throw new Error("booking_not_found");
  const row = result.rows[0];
  return { bookingId: row.id as string, name: (row.buyer_name as string) || "Guest", email: row.buyer_email as string, eventTitle: row.event_title as string, startsAt: row.starts_at.toISOString(), venue: row.venue as string, ticketCodes: row.ticket_codes as string[] };
}

export async function markDispatchByKey(dispatchKey: string, outcome: { status: "sent" | "failed"; providerRef?: string; error?: string }) {
  if (!pool || !organizationId) return;
  if (outcome.status === "sent") {
    await pool.query("update notification_dispatches set status = 'sent', provider_ref = $2, sent_at = now(), last_error = null where organization_id = $1 and dispatch_key = $3", [organizationId, outcome.providerRef || "email", dispatchKey]);
    return;
  }
  await pool.query("update notification_dispatches set status = 'failed', last_error = $2 where organization_id = $1 and dispatch_key = $3", [organizationId, (outcome.error || "unknown").slice(0, 1000), dispatchKey]);
}
