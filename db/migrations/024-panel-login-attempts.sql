-- Shared across server instances; an installation-wide cap on password guesses.
create table if not exists panel_login_attempts (
  id integer primary key check (id = 1),
  window_started_at timestamptz not null default now(),
  failures integer not null default 0
);
