-- CLVR (Stock Mega AI) - Slice 4 migration.
-- Run in Supabase SQL Editor on your EXISTING database. Safe to re-run.

-- Paper vs. live: track positions without committing real money
alter table trades  add column if not exists is_paper boolean not null default false;
alter table history add column if not exists is_paper boolean not null default false;

-- Conviction score on AI candidates (not just held positions)
alter table suggested_tickers add column if not exists conviction smallint;

-- Notification center (status changes + new suggestions)
create table if not exists notifications (
  id          uuid primary key default gen_random_uuid(),
  type        text not null,            -- 'status_change' | 'new_suggestions'
  title       text not null,
  body        text default '',
  ticker      text,
  thesis_id   uuid,
  thesis_name text,
  meta        jsonb,
  read        boolean not null default false,
  created_at  timestamptz not null default now()
);
create index if not exists notifications_created_idx on notifications(created_at desc);
