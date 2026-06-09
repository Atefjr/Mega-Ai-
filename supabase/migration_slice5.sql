-- CLVR - Slice 5 migration: workspace access codes (multi-tester isolation).
-- Run in Supabase SQL Editor on your EXISTING database. Safe to re-run.

-- Valid access codes. A tester must enter one of these to use the app.
create table if not exists workspaces (
  code       text primary key,
  label      text default '',
  created_at timestamptz not null default now()
);

-- Scope personal data by workspace code.
alter table theses            add column if not exists workspace text not null default '';
alter table trades            add column if not exists workspace text not null default '';
alter table history           add column if not exists workspace text not null default '';
alter table suggested_tickers add column if not exists workspace text not null default '';
alter table notifications     add column if not exists workspace text not null default '';
alter table ticker_meta       add column if not exists workspace text not null default '';

create index if not exists theses_ws_idx        on theses(workspace);
create index if not exists trades_ws_idx        on trades(workspace);
create index if not exists history_ws_idx       on history(workspace);
create index if not exists notifications_ws_idx on notifications(workspace);
create index if not exists suggested_ws_idx     on suggested_tickers(workspace);

-- Halal status is now per-workspace (each tester sets their own).
alter table ticker_meta drop constraint if exists ticker_meta_pkey;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'ticker_meta_ws_symbol_key') then
    alter table ticker_meta add constraint ticker_meta_ws_symbol_key unique (workspace, symbol);
  end if;
end $$;

-- Seed test codes. CHANGE THESE to your own private, hard-to-guess strings.
insert into workspaces (code, label) values
  ('atef-main', 'Atef'),
  ('tester-one', 'Tester 1'),
  ('tester-two', 'Tester 2')
on conflict (code) do nothing;

-- OPTIONAL: claim your current (pre-workspace) data into one code.
-- Uncomment and set the code, then run once:
-- update theses            set workspace = 'atef-main' where workspace = '';
-- update trades            set workspace = 'atef-main' where workspace = '';
-- update history           set workspace = 'atef-main' where workspace = '';
-- update suggested_tickers set workspace = 'atef-main' where workspace = '';
-- update notifications     set workspace = 'atef-main' where workspace = '';
-- update ticker_meta       set workspace = 'atef-main' where workspace = '';
