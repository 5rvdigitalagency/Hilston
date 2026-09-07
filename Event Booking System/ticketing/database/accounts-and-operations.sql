-- Apply after database/admin-control-plane.sql.

alter table users add column if not exists password_hash text;
alter table users add column if not exists display_name text;
alter table users add column if not exists invited_at timestamptz;
alter table users add column if not exists invitation_token_hash text;
alter table users add column if not exists invitation_expires_at timestamptz;
alter table users add column if not exists password_reset_token_hash text;
alter table users add column if not exists password_reset_expires_at timestamptz;
alter table users add column if not exists last_signed_in_at timestamptz;

create index if not exists users_org_status_idx on users (organization_id, status);
create index if not exists users_invitation_token_idx on users (invitation_token_hash) where invitation_token_hash is not null;
create index if not exists users_reset_token_idx on users (password_reset_token_hash) where password_reset_token_hash is not null;