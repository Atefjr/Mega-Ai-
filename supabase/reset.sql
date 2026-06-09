-- CLVR - RESET TO ZERO + set up 5 tester access codes (self-contained).
-- Run this whole thing in Supabase -> SQL Editor (any tab; they all hit the
-- same database). Safe to run even if you haven't run migration_slice5 yet.
-- WARNING: permanently deletes ALL theses, trades, history, suggestions,
-- notifications, halal settings, analyses, and price snapshots.

-- 1) Make sure the workspace structure exists (no-ops if already there).
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

-- 2) Wipe all data (structure is kept).
truncate table
  notifications,
  suggested_tickers,
  history,
  trades,
  theses,
  ticker_meta,
  stock_analyses,
  price_snapshots
restart identity cascade;

-- 3) Seed exactly five tester codes. EDIT these. No trailing spaces inside quotes!
delete from workspaces;
insert into workspaces (code, label) values
  ('Atef123',     'Atef'),
  ('Zaki123',     'Zaki'),
  ('Tester321',   'Tester3'),
  ('Tester4321',  'Tester4'),
  ('Tester54321', 'Tester5');

-- Check what's set:  select * from workspaces;
