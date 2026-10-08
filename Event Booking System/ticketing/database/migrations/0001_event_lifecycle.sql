alter table events add column if not exists archived_at timestamptz;
alter table events add column if not exists cancelled_at timestamptz;
