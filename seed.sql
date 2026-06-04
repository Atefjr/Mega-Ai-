-- Stock Mega AI - sample seed data (optional).
-- Run AFTER schema.sql if you want the dashboard populated on first launch.
-- Safe to skip or delete later; tickers are real US-listed equities so live
-- quotes/news will populate from Finnhub immediately.

with t as (
  insert into theses (name, icon, description) values
    (
      'AI Infrastructure Buildout',
      '⚡',
      'The capital-expenditure cycle for AI compute is still early. Hyperscaler capex guidance keeps rising, and demand is spilling beyond GPUs into networking, power delivery, and thermal management. Thesis holds while datacenter capex guidance and order backlogs keep expanding.'
    ),
    (
      'Nuclear & Grid Power',
      '☢️',
      'AI datacenters need firm, carbon-free baseload power. Restarts, SMRs, and grid upgrades position nuclear and electrical-equipment names as multi-year beneficiaries. Thesis holds while datacenter power demand and utility capex stay on an upward path.'
    )
  returning id, name
)
-- one open position under the first thesis (so the Live page is not empty)
insert into trades (thesis_id, ticker, amount_invested, avg_cost, purchased_at)
select id, 'NVDA', 5000, 118.50, current_date - interval '120 days'
from t where name = 'AI Infrastructure Buildout';

-- suggested tickers (placeholder for/against; AI rewrites these in Slice 2)
insert into suggested_tickers (thesis_id, ticker, reasons_for, reasons_against)
select th.id, s.ticker, s.rf, s.ra
from theses th
join (values
  ('AI Infrastructure Buildout', 'AVGO', 'Custom AI silicon + networking exposure.', 'Rich valuation; customer concentration.'),
  ('AI Infrastructure Buildout', 'VRT',  'Thermal & power for dense AI racks.',     'Cyclical; execution-sensitive.'),
  ('Nuclear & Grid Power',       'CEG',  'Largest US nuclear fleet; clean baseload.', 'Power-price sensitivity.'),
  ('Nuclear & Grid Power',       'GEV',  'Grid equipment + nuclear services.',      'Long project cycles.')
) as s(thesis, ticker, rf, ra) on s.thesis = th.name
on conflict (thesis_id, ticker) do nothing;
