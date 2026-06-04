# Stock Mega AI — Slice 1

A thesis-driven stock-tracking dashboard. **Slice 1** delivers the full UI, real
US market data (prices + news), and persistence. The AI features (thesis status,
daily theme research, new-theme research) are **stubbed** behind clean interfaces
and get wired to Claude in Slice 2. Telegram notifications come later.

Three pages:
- **Live Trades** — one widget per open position: live price + day move, return
  since purchase, live P&L, thesis + status badge, latest news, amount invested,
  and actions (buy more / go to research / close trade).
- **Research** — clickable thesis widgets showing held tickers and suggested
  tickers; opening one shows the write-up and an AI research action.
- **History** — list of closed trades with realized performance and timeline.

Every ticker shows a **halal indicator** — a crescent moon (halal), a struck-out
moon (not halal), or a faint outline (not set). In this slice the status is one
you set yourself: click the moon to cycle not-set → halal → not-halal. It's stored
per symbol, so it appears everywhere that ticker shows up. There is no reliable
Sharia-compliance flag in the market-data feed, so nothing is auto-judged; a later
slice can populate it from a screening provider (e.g. Zoya, Musaffa, IdealRatings)
or from computed AAOIFI-style ratios.

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
CRON_SECRET=            # optional
```

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
- **AI → stubbed in Slice 1**, so no model spend yet. In Slice 2 the cost levers
  (compute-once-daily + cache, Haiku for classification, capped web search,
  batch + prompt caching, hard spend cap) get applied where the AI lives.

## Security

- RLS is left disabled because the DB is reached only by serverless functions
  using the `service_role` key. Do **not** expose that key or the anon key in the
  frontend. If you later add client-side DB access, enable RLS and add policies.

## Project structure
```
api/                serverless functions (data + stubbed AI)
  _lib.js           supabase client, finnhub fetchers, helpers
  quotes.js  news.js  theses.js  trades.js  trade-close.js  history.js
  ticker-meta.js    halal status (user-set) per symbol
  ai.js             STUB (status + research)
  cron-close.js     close-of-day snapshot
src/
  pages/            LiveTrades, Research, ResearchThesis, History
  components/        StatusBadge, HalalBadge, InvestModal, ThesisModal, States
  lib/              api client, formatting + position math
supabase/
  schema.sql  seed.sql
```

## What's next (Slice 2)
- Replace `/api/ai.js` with real Claude calls: status classification (Haiku over a
  small evidence packet) and theme research (Sonnet + capped web search).
- Wire the Telegram bot for "Status Change" and "P&L Negative at close".
- Daily existing-theme pass on the cron, writing status + rationale to `trades`.
- Optional: automated halal screening (provider API or computed ratios) to fill
  `ticker_meta.halal_status` instead of setting it by hand.
