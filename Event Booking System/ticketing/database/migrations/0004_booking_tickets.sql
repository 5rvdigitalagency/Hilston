-- Phase 10.1: one ticket per booking, guest-count-aware check-in.
-- Additive only. The legacy `tickets` and `check_ins` tables are left in place,
-- untouched and undropped, until explicitly confirmed otherwise.

alter table bookings add column if not exists booking_reference text;

create table if not exists booking_tickets (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null unique references bookings(id) on delete cascade,
  ticket_code text not null unique,
  total_guests integer not null check (total_guests > 0),
  checked_in_count integer not null default 0 check (checked_in_count >= 0 and checked_in_count <= total_guests),
  created_at timestamptz not null default now()
);

create index if not exists booking_tickets_booking_id_idx on booking_tickets (booking_id);

create table if not exists booking_check_ins (
  id uuid primary key default gen_random_uuid(),
  booking_ticket_id uuid not null references booking_tickets(id) on delete cascade,
  guests_checked_in integer not null check (guests_checked_in > 0),
  staff_user_id uuid references users(id),
  ip inet,
  user_agent text,
  checked_in_at timestamptz not null default now()
);

create index if not exists booking_check_ins_booking_ticket_id_idx on booking_check_ins (booking_ticket_id);

-- Backfill a booking reference for every existing booking that doesn't have one yet.
update bookings
   set booking_reference = 'BK-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 5))
 where booking_reference is null;

create unique index if not exists bookings_booking_reference_idx on bookings (booking_reference);

-- Data conversion: collapse existing per-guest `tickets` rows into one `booking_tickets` row per booking.
--   total_guests      = sum of booking_items quantities, falling back to a count of legacy ticket rows
--                        for bookings created before ticket types/items existed.
--   checked_in_count  = number of legacy tickets already marked 'checked_in' for that booking.
-- (Kept in sync with the pure-function twin `summariseLegacyBookingTickets` in
--  src/lib/check-in-logic.ts, which is unit tested.)
-- Idempotent: only inserts a row for bookings that don't already have one, so re-running this
-- migration (or applying it after new bookings already use booking_tickets directly) is safe.
insert into booking_tickets (booking_id, ticket_code, total_guests, checked_in_count, created_at)
select
  b.id,
  'HP-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6)),
  greatest(1, coalesce(
    (select sum(bi.quantity)::int from booking_items bi where bi.booking_id = b.id),
    (select count(*)::int from tickets t where t.booking_id = b.id)
  )),
  least(
    greatest(1, coalesce(
      (select sum(bi.quantity)::int from booking_items bi where bi.booking_id = b.id),
      (select count(*)::int from tickets t where t.booking_id = b.id)
    )),
    coalesce((select count(*)::int from tickets t where t.booking_id = b.id and t.status = 'checked_in'), 0)
  ),
  b.created_at
from bookings b
where not exists (select 1 from booking_tickets bt where bt.booking_id = b.id)
  and (
    exists (select 1 from booking_items bi where bi.booking_id = b.id)
    or exists (select 1 from tickets t where t.booking_id = b.id)
  );

-- Guest-aware check-in: admits `p_guests` guests against a single booking ticket, rejecting
-- over-admission and re-scans of a fully checked-in booking. Each partial arrival is logged as
-- its own row in booking_check_ins (the legacy check_ins.ticket_id unique constraint only allows
-- one check-in event per ticket, which is why this uses a new table instead).
create or replace function check_in_booking(
  p_ticket_code text,
  p_guests integer,
  p_staff_user_id uuid,
  p_ip inet,
  p_user_agent text
) returns booking_tickets
language plpgsql
as $$
declare
  v_ticket booking_tickets;
begin
  select * into v_ticket from booking_tickets where ticket_code = upper(trim(p_ticket_code)) for update;
  if v_ticket.id is null then
    raise exception 'ticket_not_found';
  end if;
  if p_guests is null or p_guests <= 0 then
    raise exception 'invalid_guest_count';
  end if;
  if v_ticket.checked_in_count >= v_ticket.total_guests then
    raise exception 'already_checked_in';
  end if;
  if v_ticket.checked_in_count + p_guests > v_ticket.total_guests then
    raise exception 'over_admission';
  end if;

  update booking_tickets
     set checked_in_count = checked_in_count + p_guests
   where id = v_ticket.id
  returning * into v_ticket;

  insert into booking_check_ins (booking_ticket_id, guests_checked_in, staff_user_id, ip, user_agent)
  values (v_ticket.id, p_guests, p_staff_user_id, p_ip, p_user_agent);

  return v_ticket;
end;
$$;
