# Stock Mega AI

A thesis-driven stock-tracking dashboard. The full UI, real US market data
(prices + news), and persistence are live, and so is the AI layer: **thesis
status + conviction score** (Claude Haiku 4.5), **theme research** and a
**stock analysis** deep-dive (Claude Sonnet 4.6 + web search). Telegram
notifications come next.

Pages:
- **Live Trades** — one widget per open position: live price + day move, return
  since purchase, live P&L, thesis + status badge, a 0–100 conviction score,
  latest news, amount invested, and actions (buy more / analyze / research /
  re-check / close). Sortable by return, P&L, conviction, thesis or ticker, with
  a best-performing-thesis summary line up top.
- **Research** — clickable thesis widgets; opening one shows the write-up plus its
  cautious/breaks conditions, held tickers with all-time return, and AI candidates
  (each with 1-year performance, an Analyze button and an Invest button). Theses
  are editable, including the cautious/breaks conditions that sharpen status scoring.
- **Analyze** — plug in a US ticker for a high-level, buy-side-style read: verdict,
  valuation, growth, profitability, balance sheet, moat, bull/bear case, risks and
  what to watch. Cached for 24h per ticker to keep cost down. Decision support, not
  financial advice.
- **History** — closed trades with realized performance and timeline; rows are
  editable and deletable, and the summary ranks your best-performing theses.
- **Settings** — light/dark theme, a toggle to hide the conviction score, a debug
  panel with an API health check, the daily-refresh and 5-year-data notes, and
  account/billing placeholders for if you ever open it to other users. Version is
  shown in the footer on every page.

Every ticker shows a **halal indicator** — a crescent moon (halal), a struck-out
moon (not halal), or a faint outline (not set). You set it yourself: click the moon
to cycle not-set → halal → not-halal. It's stored per symbol, so it appears
everywhere that ticker shows up. There is no reliable Sharia-compliance flag in the
market-data feed, so nothing is auto-judged; a later slice can populate it from a
screening provider (e.g. Zoya, Musaffa, IdealRatings) or computed AAOIFI-style ratios.

## Stack

- **Frontend:** React + Vite (plain CSS design system, no UI framework)
- **Backend:** Vercel serverless functions in `/api` (hold all secrets server-side)
- **Database:** Supabase (Postgres)
- **Market data:** Finnhub (free tier) — quotes + company news
- **Scheduling:** Vercel Cron → close-of-day price snapshots

The browser only ever calls `/api/*`. The Finnhub key and Supabase service-role
key live exclusively in serverless environment variables and are never shipped to
the client.

## Setup

### 1. Install
```bash
npm install
```

### 2. Supabase
1. Create a project at https://supabase.com.
2. In **SQL Editor**, run `supabase/schema.sql`.
   - **Already have a database from an earlier version?** Don't re-run the whole
     schema — instead run `supabase/migration_slice3.sql`, which adds the new
     thesis criteria columns, the conviction fields, and the `stock_analyses`
     cache table. It's safe to run more than once.
3. (Optional) run `supabase/seed.sql` to populate sample theses + an NVDA position
   so the dashboard isn't empty on first load.
4. In **Project Settings → API**, copy the **Project URL** and the
   **`service_role`** key (not the `anon` key).

### 3. Finnhub
Register at https://finnhub.io/register and copy your API key (free tier is enough).

### 4. Environment variables
Copy `.env.example` to `.env` and fill in:
```
FINNHUB_API_KEY=...
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...
ANTHROPIC_API_KEY=...     # for thesis status + research (Slice 2)
CRON_SECRET=              # optional
```
Get the Anthropic key at https://console.anthropic.com. Set a monthly spend limit
there — that's your real hard cap. No schema change is needed for Slice 2.

### 5. Run locally
The easiest way to run the frontend **and** the `/api` functions together is the
Vercel CLI:
```bash
npm i -g vercel
vercel link          # link to a Vercel project (one-time)
vercel env pull .env # pull env vars you've set in the dashboard (optional)
vercel dev
```
Then open the printed local URL.

> Plain `npm run dev` runs only the Vite frontend; the `/api/*` calls won't
> resolve without the functions, so use `vercel dev` for full local testing.

### 6. Deploy
1. Push this folder to a Git repo and **Import** it in Vercel (it auto-detects
   Vite + the `/api` functions).
2. In the Vercel project, add the same environment variables under
   **Settings → Environment Variables**.
3. Deploy. `vercel.json` configures the SPA fallback and the cron job.

## Cron / close-of-day snapshots

`vercel.json` schedules `GET /api/cron-close` at **22:00 UTC on weekdays**
(just after the 4 pm ET close in both EST and EDT). It records each open ticker's
closing price into `price_snapshots`.

Notes:
- Adjust the schedule in `vercel.json` if you prefer a different time.
- Vercel's Hobby plan limits cron frequency. If the schedule doesn't run on your
  plan, you can trigger it manually (`/api/cron-close`) or point an external
  scheduler (e.g. cron-job.org) at the URL. Set `CRON_SECRET` and send it as the
  `x-cron-secret` header to protect the endpoint.

## Cost posture (recap)

- **Prices, P&L, news → $0.** All served by Finnhub's free tier, never the model.
- **AI (Slice 2, now live) → small.** Thesis status uses Claude Haiku 4.5
  (~$1 / $5 per million input/output tokens); theme research uses Claude Sonnet 4.6
  (~$3 / $15) plus a per-search web-search fee. A typical status call is a few
  thousand tokens, so cents per evaluation; research is a few cents per run.
- **Cost controls in place:** Haiku for the high-volume status calls (model
  tiering); status computed once per day by the cron and cached on each position
  (the Live Trades page reads stored status, it does not call AI on load); per-run
  caps (max 25 manual, 30 cron) bound any single action; the web search is capped
  via `max_uses`; the status rubric is prompt-cached so a batch reuses it at ~90%
  off. Your hard ceiling is the monthly spend limit you set in the Anthropic console.

**Rate limits.** Research uses a web search (now capped at 3 uses) which can be
token-heavy. On the lowest API tier (30k input tokens/min) a single research call
can still hit a 429; the client now retries with backoff, and adding a small credit
balance in the Anthropic console raises your tier and per-minute limit. See
https://docs.claude.com/en/api/rate-limits.

## Security

- RLS is left disabled because the DB is reached only by serverless functions
  using the `service_role` key. Do **not** expose that key or the anon key in the
  frontend. If you later add client-side DB access, enable RLS and add policies.

## Project structure
```
api/                serverless functions
  _lib.js           supabase client, finnhub fetchers, anthropic client, helpers
  _ai.js            evidence packet + thesis-status classifier + research (Claude)
  quotes.js  news.js  theses.js  trades.js  trade-close.js  history.js
  ticker-meta.js    halal status (user-set) per symbol
  ai.js             theme research (Sonnet + web search)
  refresh-status.js thesis status (Haiku) for one or all positions
  cron-close.js     close-of-day snapshot + once-daily status pass
src/
  pages/            LiveTrades, Research, ResearchThesis, History
  components/        StatusBadge, HalalBadge, InvestModal, ThesisModal, States
  lib/              api client, formatting + position math
supabase/
  schema.sql  seed.sql
```

## How the AI works (Slice 2)
- **Thesis status.** For each position we assemble a small, mostly-free evidence
  packet from Finnhub (price vs cost, 52-week range, analyst recommendations,
  recent earnings, headlines) and ask Claude Haiku to label the thesis
  **Intact / Cautious / Broken** with a one-line rationale. The rationale and an
  "as of" timestamp show on each Live Trades card. Trigger it with **Evaluate
  theses** (all) or **Re-check** (one); the daily cron also refreshes it.
- **Theme research.** On a thesis, **Research new stocks** asks Claude Sonnet
  (with a capped web search) for US-listed candidates that fit, each with a bull
  and bear case and an Invest button. Results are saved as the thesis's
  suggestions.

## What's next (Slice 3)
- Wire the Telegram bot for "Status Change" and "P&L Negative at close" alerts
  (the cron is the natural place to detect and push these).
- Optional: a hard per-day call cap in the app (in addition to the console spend
  limit), and automated halal screening (provider API or computed ratios) to fill
  `ticker_meta.halal_status` instead of setting it by hand.
