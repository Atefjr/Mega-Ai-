-- ============================================================
-- CLVR finalize.sql  —  full setup + reset to zero + 5 codes
-- Run ONCE in Supabase -> SQL Editor. Idempotent (safe to re-run).
-- This replaces all the individual migration_sliceX files.
-- WARNING: step 2 permanently deletes all existing app data.
-- ============================================================

-- 1) Make sure every table/column from every version exists ----------------

-- thesis criteria + position conviction + analysis cache
alter table theses add column if not exists cautious_criteria text default '';
alter table theses add column if not exists break_criteria   text default '';
alter table theses add column if not exists example_ticker    text default '';
alter table trades add column if not exists status_conviction smallint;
alter table trades add column if not exists status_signals    jsonb;
create table if not exists stock_analyses (
  ticker     text primary key,
  data       jsonb not null,
  created_at timestamptz not null default now()
);

-- paper trades + candidate conviction + notifications
alter table trades            add column if not exists is_paper boolean not null default false;
alter table history           add column if not exists is_paper boolean not null default false;
alter table suggested_tickers add column if not exists conviction smallint;
create table if not exists notifications (
  id          uuid primary key default gen_random_uuid(),
  type        text not null,
  title       text not null,
  body        text default '',
  ticker      text,
  thesis_id   uuid,
  thesis_name text,
  meta        jsonb,
  read        boolean not null default false,
  created_at  timestamptz not null default now()
);

-- access-code workspaces + per-workspace scoping
create table if not exists workspaces (
  code       text primary key,
  label      text default '',
  created_at timestamptz not null default now()
);
alter table theses            add column if not exists workspace text not null default '';
alter table trades            add column if not exists workspace text not null default '';
alter table history           add column if not exists workspace text not null default '';
alter table suggested_tickers add column if not exists workspace text not null default '';
alter table notifications     add column if not exists workspace text not null default '';
alter table ticker_meta       add column if not exists workspace text not null default '';
alter table ticker_meta drop constraint if exists ticker_meta_pkey;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'ticker_meta_ws_symbol_key') then
    alter table ticker_meta add constraint ticker_meta_ws_symbol_key unique (workspace, symbol);
  end if;
end $$;

-- 2) Wipe all data (structure is kept) -------------------------------------
truncate table
  notifications, suggested_tickers, history, trades, theses,
  ticker_meta, stock_analyses, price_snapshots
restart identity cascade;

-- 3) Seed exactly five tester codes -- EDIT these (no trailing spaces) ------
delete from workspaces;
insert into workspaces (code, label) values
  ('Atef123',     'Atef'),
  ('Zaki123',     'Zaki'),
  ('Tester321',   'Tester3'),
  ('Tester4321',  'Tester4'),
  ('Tester54321', 'Tester5');

-- Verify:  select * from workspaces;
