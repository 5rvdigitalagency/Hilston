-- Staff sign-in security: session revocation, forced password change and sign-in lockout.
-- Already applied to production on 2026-09-29; safe to re-run.
alter table users add column if not exists session_version integer not null default 0;
alter table users add column if not exists must_change_password boolean not null default false;

create table if not exists login_attempts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid,
  scope text not null,
  email text not null,
  ip text,
  succeeded boolean not null,
  created_at timestamptz not null default now()
);
create index if not exists login_attempts_lookup_idx on login_attempts (scope, email, created_at);
create index if not exists login_attempts_ip_idx on login_attempts (scope, ip, created_at);
alter table login_attempts enable row level security;
