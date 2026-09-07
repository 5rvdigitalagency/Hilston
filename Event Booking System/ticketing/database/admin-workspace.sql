-- Admin workspace foundation for Hilston Park Tickets.
-- Apply after schema.sql and srs-v1-additions.sql. This file is safe to rerun.

create table if not exists event_categories (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 2 and 60),
  slug text not null check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  created_at timestamptz not null default now(),
  unique (organization_id, slug)
);

alter table events add column if not exists category_id uuid references event_categories(id) on delete set null;
alter table events add column if not exists price_pence integer not null default 0 check (price_pence >= 0);
create index if not exists events_category_idx on events (category_id);

create table if not exists event_media (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  media_object_id uuid not null references media_objects(id) on delete cascade,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (event_id, media_object_id)
);

create index if not exists event_media_event_idx on event_media (event_id, display_order, created_at);

alter table bookings add column if not exists event_id uuid references events(id) on delete restrict;
alter table bookings add column if not exists buyer_name text;
alter table bookings add column if not exists buyer_email text;
alter table bookings add column if not exists confirmed_at timestamptz;
create index if not exists bookings_event_status_idx on bookings (event_id, status);

insert into permissions (key, is_locked) values
  ('admin.manage', true),
  ('roles.manage', false),
  ('event_categories.manage', false),
  ('reports.sales.view', false),
  ('reports.revenue.view', false),
  ('reports.forecast.view', true),
  ('tickets.history.view', false)
on conflict (key) do nothing;

insert into roles (organization_id, name, is_system, is_locked)
select organizations.id, defaults.name, true, defaults.name = 'Admin'
from organizations
cross join (values ('Admin'), ('Manager'), ('User')) as defaults(name)
on conflict (organization_id, name) do nothing;

insert into event_categories (organization_id, name, slug)
select organizations.id, defaults.name, defaults.slug
from organizations
cross join (values ('Featured event', 'featured'), ('Upcoming event', 'upcoming'), ('Popular event', 'popular')) as defaults(name, slug)
on conflict (organization_id, slug) do nothing;

-- Admins receive all current permissions. Managers receive operational permissions,
-- while revenue access remains explicitly assignable by an administrator.
insert into permission_roles (permission_id, role_id)
select permissions.id, roles.id
from roles
join permissions on true
where roles.name = 'Admin'
on conflict do nothing;

insert into permission_roles (permission_id, role_id)
select permissions.id, roles.id
from roles
join permissions on permissions.key in ('events.manage', 'inventory.manage', 'bookings.view', 'payments.manage', 'check_in.manage', 'tickets.history.view')
where roles.name = 'Manager'
on conflict do nothing;

insert into permission_roles (permission_id, role_id)
select permissions.id, roles.id
from roles
join permissions on permissions.key = 'tickets.history.view'
where roles.name = 'User'
on conflict do nothing;

alter table event_categories enable row level security;
alter table event_media enable row level security;
revoke all on event_categories from anon, authenticated;
revoke all on event_media from anon, authenticated;