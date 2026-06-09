-- Stock Mega AI - database schema (Slice 1)
-- Run this in Supabase: SQL Editor -> paste -> Run.
-- This app is single-user: the DB is reached only through serverless functions
-- that hold the SERVICE ROLE key. RLS is therefore left disabled for Slice 1.
-- (If you later expose the anon key client-side, enable RLS and add policies.)

create extension if not exists "pgcrypto";

-- Investment theses (the "reason" behind a group of tickers)
create table if not exists theses (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  icon          text default '📈',
  description   text default '',                 -- thesis written out
  cautious_criteria text default '',              -- what would make it cautious
  break_criteria    text default '',              -- what would break it
  example_ticker    text default '',              -- representative ticker
  created_at    timestamptz not null default now()
);

-- Open / live positions
create table if not exists trades (
  id               uuid primary key default gen_random_uuid(),
  thesis_id        uuid references theses(id) on delete set null,
  ticker           text not null,
  amount_invested  numeric not null check (amount_invested > 0),  -- dollars
  avg_cost         numeric not null check (avg_cost > 0),         -- per share
  purchased_at     date not null default current_date,
  -- derived share count (dollars / average cost)
  shares           numeric generated always as (amount_invested / nullif(avg_cost, 0)) stored,
  -- thesis status (filled by AI in Slice 2; null for now)
  status_label     text check (status_label in ('Intact', 'Cautious', 'Broken')),
  status_rationale text,
  status_conviction smallint,                     -- 0-100 conviction score
  status_signals   jsonb,                          -- {execution, price, sentiment}
  status_updated_at timestamptz,
  is_paper         boolean not null default false,  -- paper trade vs. real money
  created_at       timestamptz not null default now()
);

create index if not exists trades_thesis_idx on trades(thesis_id);
create index if not exists trades_ticker_idx on trades(ticker);

-- AI-suggested tickers per thesis (seeded as placeholders in Slice 1)
create table if not exists suggested_tickers (
  id              uuid primary key default gen_random_uuid(),
  thesis_id       uuid not null references theses(id) on delete cascade,
  ticker          text not null,
  reasons_for     text default '',
  reasons_against text default '',
  conviction      smallint,
  created_at      timestamptz not null default now(),
  unique (thesis_id, ticker)
);

-- Closed trades (the History page)
create table if not exists history (
  id               uuid primary key default gen_random_uuid(),
  ticker           text not null,
  thesis_id        uuid references theses(id) on delete set null,
  thesis_name      text,
  amount_invested  numeric not null,
  avg_cost         numeric not null,
  exit_price       numeric not null,
  pnl              numeric not null,
  performance_pct  numeric not null,
  purchased_at     date,
  is_paper         boolean not null default false,
  closed_at        timestamptz not null default now()
);

create index if not exists history_closed_idx on history(closed_at desc);

-- Close-of-day price snapshots (written by /api/cron-close)
create table if not exists price_snapshots (
  id            uuid primary key default gen_random_uuid(),
  ticker        text not null,
  price         numeric,
  change        numeric,
  change_pct    numeric,
  snapshot_date date not null default current_date,
  created_at    timestamptz not null default now(),
  unique (ticker, snapshot_date)
);

-- Per-symbol metadata, incl. halal (Sharia-compliance) status.
-- halal_status is user-set in Slice 1 (no reliable Sharia flag in the data feed).
-- A later slice can populate this from a screening provider or computed ratios.
create table if not exists ticker_meta (
  symbol       text primary key,
  halal_status text not null default 'unknown' check (halal_status in ('halal', 'not_halal', 'unknown')),
  note         text default '',
  updated_at   timestamptz not null default now()
);

-- Cache for the stock analysis page (Slice 3)
create table if not exists stock_analyses (
  ticker     text primary key,
  data       jsonb not null,
  created_at timestamptz not null default now()
);

-- Notification center (Slice 4)
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
create index if not exists notifications_created_idx on notifications(created_at desc);
