drop function if exists check_in_booking(text, integer, uuid, inet, text);
drop index if exists bookings_booking_reference_idx;
drop table if exists booking_check_ins;
drop table if exists booking_tickets;
alter table bookings drop column if exists booking_reference;
