import { Pool } from "pg";

const eventTitles = ["ience rules, and tick", "QA E2E Test - do not book", "QA Test Event - delete me"];
const apply = process.argv.includes("--apply");
const confirmed = process.env.CONFIRM === "prod";

if (apply && !confirmed) {
  console.error("Refusing to apply production cleanup without CONFIRM=prod.");
  process.exit(1);
}

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is required.");
  process.exit(1);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function main() {
  const client = await pool.connect();
  try {
    const targets = await client.query(
      `select id, title from events where title = any($1::text[]) order by title`,
      [eventTitles],
    );
    const mockBookings = await client.query(
      `select distinct b.id, b.status, b.total_pence
       from bookings b join payments p on p.booking_id = b.id
       where p.provider = 'mock' order by b.created_at`,
    );
    const qaStaff = await client.query(
      `select id, email, status from users where lower(email) = lower($1)`,
      ["qa-test@hilstonpark.test"],
    );

    console.log(apply ? "Production cleanup APPLY mode" : "Production cleanup DRY RUN");
    console.log("Events:", targets.rows);
    console.log("Mock bookings:", mockBookings.rows);
    console.log("QA staff:", qaStaff.rows);
    console.log("Actions: disable QA staff; remove matching events and dependent data; remove mock bookings and dependent data.");

    if (!apply) return;

    await client.query("begin");
    await client.query(`update users set status = 'disabled' where lower(email) = lower($1)`, ["qa-test@hilstonpark.test"]);
    await client.query(
      `with target_bookings as (
         select distinct b.id from bookings b
         left join payments p on p.booking_id = b.id
         left join events e on e.id = b.event_id
         where p.provider = 'mock' or e.title = any($1::text[])
       ) delete from check_ins where ticket_id in (select t.id from tickets t where t.booking_id in (select id from target_bookings))`,
      [eventTitles],
    );
    await client.query(
      `with target_bookings as (
         select distinct b.id from bookings b
         left join payments p on p.booking_id = b.id
         left join events e on e.id = b.event_id
         where p.provider = 'mock' or e.title = any($1::text[])
       ) delete from tickets where booking_id in (select id from target_bookings)`,
      [eventTitles],
    );
    await client.query(
      `with target_bookings as (
         select distinct b.id from bookings b
         left join payments p on p.booking_id = b.id
         left join events e on e.id = b.event_id
         where p.provider = 'mock' or e.title = any($1::text[])
       ) delete from booking_items where booking_id in (select id from target_bookings)`,
      [eventTitles],
    );
    await client.query(
      `with target_bookings as (
         select distinct b.id from bookings b
         left join payments p on p.booking_id = b.id
         left join events e on e.id = b.event_id
         where p.provider = 'mock' or e.title = any($1::text[])
       ) delete from attendees where booking_id in (select id from target_bookings)`,
      [eventTitles],
    );
    await client.query(
      `delete from payments p using bookings b left join events e on e.id = b.event_id
       where p.booking_id = b.id and (p.provider = 'mock' or e.title = any($1::text[]))`,
      [eventTitles],
    );
    await client.query(
      `delete from bookings b using events e where b.event_id = e.id and e.title = any($1::text[])
       or b.id in (select p.booking_id from payments p where p.provider = 'mock')`,
      [eventTitles],
    );
    await client.query(
      `delete from session_ticket_inventory i using event_sessions s join events e on e.id = s.event_id
       where i.event_session_id = s.id and e.title = any($1::text[])`,
      [eventTitles],
    );
    await client.query(
      `delete from ticket_types t using event_sessions s join events e on e.id = s.event_id
       where t.event_session_id = s.id and e.title = any($1::text[])`,
      [eventTitles],
    );
    await client.query(
      `delete from event_sessions s using events e where s.event_id = e.id and e.title = any($1::text[])`,
      [eventTitles],
    );
    await client.query(`delete from events where title = any($1::text[])`, [eventTitles]);
    await client.query("commit");
    console.log("Cleanup committed.");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}).finally(() => pool.end());
