create extension if not exists pgcrypto;

create table if not exists organizations (id uuid primary key default gen_random_uuid(), name text not null, settings jsonb not null default '{}', created_at timestamptz not null default now());
create table if not exists users (id uuid primary key default gen_random_uuid(), organization_id uuid not null references organizations(id), email text not null, email_verified_at timestamptz, signup_ip inet, status text not null default 'pending', created_at timestamptz not null default now(), unique (organization_id, email));
create table if not exists venues (id uuid primary key default gen_random_uuid(), organization_id uuid not null references organizations(id), name text not null, created_at timestamptz not null default now());
create table if not exists events (id uuid primary key default gen_random_uuid(), organization_id uuid not null references organizations(id), venue_id uuid references venues(id), title text not null, description text not null, starts_at timestamptz not null, audience_policy text not null default 'general' check (audience_policy in ('general','adult_only','kids_only','kids_parent_mandatory')), min_age integer, max_age integer, published boolean not null default false, created_at timestamptz not null default now());
create table if not exists event_sessions (id uuid primary key default gen_random_uuid(), event_id uuid not null references events(id), starts_at timestamptz not null, ends_at timestamptz, capacity integer not null check (capacity > 0));
create table if not exists ticket_types (id uuid primary key default gen_random_uuid(), event_session_id uuid not null references event_sessions(id), name text not null, price_pence integer not null check (price_pence >= 0), max_per_order integer not null default 10 check (max_per_order > 0));
create table if not exists session_ticket_inventory (event_session_id uuid not null references event_sessions(id), ticket_type_id uuid not null references ticket_types(id), capacity integer not null check (capacity >= 0), quantity_held integer not null default 0 check (quantity_held >= 0), quantity_sold integer not null default 0 check (quantity_sold >= 0), primary key (event_session_id, ticket_type_id));
create table if not exists bookings (id uuid primary key default gen_random_uuid(), organization_id uuid not null references organizations(id), user_id uuid references users(id), status text not null default 'held', sales_channel text not null default 'online' check (sales_channel in ('online','pos')), hold_expires_at timestamptz, total_pence integer not null default 0, created_at timestamptz not null default now());
create table if not exists booking_items (id uuid primary key default gen_random_uuid(), booking_id uuid not null references bookings(id), ticket_type_id uuid not null references ticket_types(id), quantity integer not null check (quantity > 0), unit_price_pence integer not null check (unit_price_pence >= 0));
create table if not exists attendees (id uuid primary key default gen_random_uuid(), booking_id uuid references bookings(id), event_id uuid not null references events(id), name text not null, email text not null, child_count integer not null default 0 check (child_count >= 0), created_at timestamptz not null default now());
create table if not exists payments (id uuid primary key default gen_random_uuid(), booking_id uuid not null references bookings(id), provider text not null default 'stripe', stripe_mode text not null, payment_intent_id text unique, amount_pence integer not null, status text not null default 'pending', created_at timestamptz not null default now());
create index if not exists events_public_idx on events (published, starts_at);
create index if not exists attendees_event_idx on attendees (event_id);

alter table organizations enable row level security;
alter table users enable row level security;
alter table venues enable row level security;
alter table events enable row level security;
alter table event_sessions enable row level security;
alter table ticket_types enable row level security;
alter table session_ticket_inventory enable row level security;
alter table bookings enable row level security;
alter table booking_items enable row level security;
alter table attendees enable row level security;
alter table payments enable row level security;

-- API routes use the Supabase service role only after their own permission checks.
-- These policies deny direct anon/authenticated table access by default.
revoke all on all tables in schema public from anon, authenticated;

create or replace function add_event_attendee(p_event_id uuid, p_name text, p_email text, p_child_count integer, p_organization_id uuid)
returns attendees language plpgsql as $$
declare
	result attendees;
	event_capacity integer;
	current_attendees integer;
begin
	select s.capacity into event_capacity from events e join event_sessions s on s.event_id = e.id where e.id = p_event_id and e.organization_id = p_organization_id and e.published = true order by s.starts_at limit 1 for update;
	if event_capacity is null then raise exception 'event_not_found'; end if;
	select count(*) into current_attendees from attendees where event_id = p_event_id;
	if current_attendees >= event_capacity then raise exception 'event_full'; end if;
	insert into attendees (event_id, name, email, child_count) values (p_event_id, p_name, p_email, p_child_count) returning * into result;
	return result;
end;
$$;
