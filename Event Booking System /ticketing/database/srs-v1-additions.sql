-- Hilston Park Ticketing SRS v1 additions
-- Apply after schema.sql has been reviewed. This migration is additive.

create table if not exists roles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  name text not null,
  is_system boolean not null default false,
  is_locked boolean not null default false,
  created_at timestamptz not null default now(),
  unique (organization_id, name)
);

create table if not exists permissions (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  is_locked boolean not null default false
);

create table if not exists role_users (
  role_id uuid not null references roles(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  primary key (role_id, user_id)
);

create table if not exists permission_roles (
  permission_id uuid not null references permissions(id) on delete cascade,
  role_id uuid not null references roles(id) on delete cascade,
  primary key (permission_id, role_id)
);

create table if not exists email_otp_challenges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  code_hash text not null,
  expires_at timestamptz not null,
  attempts integer not null default 0 check (attempts >= 0),
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists blocked_email_domains (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  domain text not null,
  active boolean not null default true,
  created_by uuid references users(id),
  created_at timestamptz not null default now(),
  unique (organization_id, domain)
);

create table if not exists registration_attempts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id),
  email text not null,
  ip inet,
  reason text not null,
  created_at timestamptz not null default now()
);

create table if not exists cancellation_policies (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  name text not null,
  refund_percent numeric(5,2) not null default 100 check (refund_percent between 0 and 100),
  withhold_stripe_fees boolean not null default false,
  withhold_platform_fees boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists refunds (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references bookings(id),
  payment_id uuid references payments(id),
  stripe_mode text not null,
  provider_ref text unique,
  amount_paid_pence integer not null check (amount_paid_pence >= 0),
  fees_withheld_pence integer not null default 0 check (fees_withheld_pence >= 0),
  refund_amount_pence integer not null check (refund_amount_pence >= 0),
  status text not null default 'pending',
  refund_by timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists tickets (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references bookings(id),
  booking_item_id uuid references booking_items(id),
  event_id uuid not null references events(id),
  ticket_code text not null unique,
  status text not null default 'issued',
  pdf_storage_key text,
  created_at timestamptz not null default now()
);

create table if not exists check_ins (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null unique references tickets(id),
  staff_user_id uuid not null references users(id),
  checked_in_at timestamptz not null default now(),
  ip inet,
  user_agent text
);

create table if not exists ticket_pdf_layouts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  name text not null,
  logo_storage_key text,
  watermark_type text not null default 'off',
  watermark_value text,
  watermark_opacity numeric(4,3) not null default 0.2 check (watermark_opacity between 0 and 1),
  qr_enabled boolean not null default true,
  qr_size integer not null default 128 check (qr_size > 0),
  colours jsonb not null default '{}',
  visible_fields jsonb not null default '[]',
  footer text,
  created_at timestamptz not null default now()
);

create table if not exists email_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  template_key text not null,
  subject text not null,
  body text not null,
  updated_at timestamptz not null default now(),
  unique (organization_id, template_key)
);

create table if not exists notification_dispatches (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  dispatch_key text not null unique,
  template_key text not null,
  recipient text not null,
  status text not null default 'pending',
  provider_ref text,
  sent_at timestamptz,
  last_error text,
  created_at timestamptz not null default now()
);

create table if not exists webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  provider_event_id text not null unique,
  event_type text not null,
  processed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists activity_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id),
  actor_user_id uuid references users(id),
  action text not null,
  ip inet,
  user_agent text,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists report_snapshots (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  period_start date not null,
  period_end date not null,
  sales jsonb not null default '{}',
  revenue jsonb not null default '{}',
  forecast jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists gdpr_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  user_id uuid not null references users(id),
  request_type text not null check (request_type in ('export', 'erase')),
  status text not null default 'requested',
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists cookie_consents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  user_id uuid references users(id),
  consent_categories jsonb not null default '{}',
  ip inet,
  user_agent text,
  created_at timestamptz not null default now()
);

create table if not exists media_objects (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  storage_key text not null unique,
  content_type text not null,
  is_private boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists pos_terminals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  name text not null,
  active boolean not null default true
);

create table if not exists till_sessions (
  id uuid primary key default gen_random_uuid(),
  terminal_id uuid not null references pos_terminals(id),
  opened_by uuid references users(id),
  closed_by uuid references users(id),
  opened_at timestamptz not null default now(),
  closed_at timestamptz
);

insert into permissions (key, is_locked) values
  ('events.manage', false),
  ('inventory.manage', false),
  ('bookings.view', false),
  ('payments.manage', false),
  ('check_in.manage', false),
  ('reports.sales.view', false),
  ('reports.revenue.view', false),
  ('reports.forecast.view', true),
  ('users.manage', false),
  ('settings.manage', false),
  ('gdpr.manage', false),
  ('demo.seed', true),
  ('payments.stripe.mode', true)
on conflict (key) do nothing;

create index if not exists users_org_email_idx on users (organization_id, email);
create index if not exists bookings_user_status_idx on bookings (user_id, status);
create index if not exists payments_booking_idx on payments (booking_id);
create index if not exists tickets_booking_idx on tickets (booking_id);
create index if not exists tickets_event_idx on tickets (event_id);
create index if not exists activity_logs_created_idx on activity_logs (created_at);
create index if not exists report_snapshots_period_idx on report_snapshots (organization_id, period_start, period_end);

alter table roles enable row level security;
alter table permissions enable row level security;
alter table role_users enable row level security;
alter table permission_roles enable row level security;
alter table email_otp_challenges enable row level security;
alter table blocked_email_domains enable row level security;
alter table registration_attempts enable row level security;
alter table cancellation_policies enable row level security;
alter table refunds enable row level security;
alter table tickets enable row level security;
alter table check_ins enable row level security;
alter table ticket_pdf_layouts enable row level security;
alter table email_templates enable row level security;
alter table notification_dispatches enable row level security;
alter table webhook_events enable row level security;
alter table activity_logs enable row level security;
alter table report_snapshots enable row level security;
alter table gdpr_requests enable row level security;
alter table cookie_consents enable row level security;
alter table media_objects enable row level security;
alter table pos_terminals enable row level security;
alter table till_sessions enable row level security;

revoke all on all tables in schema public from anon, authenticated;

create or replace function check_in_ticket(p_ticket_code text, p_staff_user_id uuid, p_ip inet, p_user_agent text)
returns tickets language plpgsql as $$
declare
  ticket_row tickets;
begin
  select * into ticket_row from tickets where ticket_code = upper(trim(p_ticket_code)) for update;
  if ticket_row.id is null then raise exception 'ticket_not_found'; end if;
  if ticket_row.status = 'checked_in' or exists (select 1 from check_ins where ticket_id = ticket_row.id) then raise exception 'ticket_already_checked_in'; end if;
  update tickets set status = 'checked_in' where id = ticket_row.id returning * into ticket_row;
  insert into check_ins (ticket_id, staff_user_id, ip, user_agent) values (ticket_row.id, p_staff_user_id, p_ip, p_user_agent);
  return ticket_row;
end;
$$;
