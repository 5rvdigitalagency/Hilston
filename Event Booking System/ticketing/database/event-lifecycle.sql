-- Event lifecycle: archiving keeps historic bookings while removing an event from the storefront.
alter table events add column if not exists archived_at timestamptz;
create index if not exists events_archived_idx on events (organization_id, archived_at);
create index if not exists tickets_booking_idx on tickets (booking_id);
create index if not exists attendees_booking_idx on attendees (booking_id);
