create table if not exists rate_limits (
  key text not null,
  window_start timestamptz not null,
  count integer not null check (count > 0),
  primary key (key, window_start)
);

create index if not exists rate_limits_window_start_idx on rate_limits (window_start);