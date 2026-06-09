-- Stock Mega AI - Slice 3 migration.
-- Run this in Supabase (SQL Editor) ON YOUR EXISTING DATABASE. Safe to re-run.

-- Thesis: explicit cautious/break conditions + an example ticker
alter table theses add column if not exists cautious_criteria text default '';
alter table theses add column if not exists break_criteria   text default '';
alter table theses add column if not exists example_ticker    text default '';

-- Position: conviction score (0-100) + sub-signal breakdown
alter table trades add column if not exists status_conviction smallint;
alter table trades add column if not exists status_signals    jsonb;

-- Cache for the stock analysis page (avoids re-running the model within a day)
create table if not exists stock_analyses (
  ticker     text primary key,
  data       jsonb not null,
  created_at timestamptz not null default now()
);
