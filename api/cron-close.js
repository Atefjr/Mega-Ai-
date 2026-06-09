// Runs on a schedule (see vercel.json crons) after the US market close.
// 1) Snapshot each open ticker's closing price (for day-movement context).
// 2) Recompute thesis status once per day and store it on each position
//    (so the Live Trades page reads cached status instead of calling AI on load).
// Slice 3 will additionally push "Status Change" / "P&L Negative at close" to Telegram.
import { getSupabase, getQuotes, sendJson, sendError } from './_lib.js';
import { computeThesisStatus } from './_ai.js';

const MAX_STATUS = 30; // cost guard per run

export default async function handler(req, res) {
  try {
    const secret = process.env.CRON_SECRET;
    if (secret) {
      const provided = req.headers['x-cron-secret'] || req.query?.secret;
      if (provided !== secret) return sendJson(res, 401, { error: 'Unauthorized' });
    }

    const supabase = getSupabase();
    const { data: trades, error } = await supabase
      .from('trades')
      .select('id, ticker, avg_cost, thesis_id, thesis:theses(name, description, cautious_criteria, break_criteria)');
    if (error) throw error;

    const open = trades || [];
    const tickers = [...new Set(open.map((t) => t.ticker))];

    // 1) price snapshots
    let snapshots = 0;
    const today = new Date().toISOString().slice(0, 10);
    if (tickers.length) {
      const quotes = await getQuotes(tickers);
      const rows = tickers
        .filter((t) => quotes[t] && !quotes[t].error)
        .map((t) => ({
          ticker: t,
          price: quotes[t].current,
          change: quotes[t].change,
          change_pct: quotes[t].changePct,
          snapshot_date: today,
        }));
      if (rows.length) {
        const { error: upErr } = await supabase
          .from('price_snapshots')
          .upsert(rows, { onConflict: 'ticker,snapshot_date' });
        if (upErr) throw upErr;
        snapshots = rows.length;
      }
    }

    // 2) once-daily thesis status
    let statusUpdated = 0;
    for (const trade of open.slice(0, MAX_STATUS)) {
      try {
        const { label, rationale, conviction, signals } = await computeThesisStatus(trade);
        await supabase
          .from('trades')
          .update({
            status_label: label,
            status_rationale: rationale,
            status_conviction: conviction,
            status_signals: signals,
            status_updated_at: new Date().toISOString(),
          })
          .eq('id', trade.id);
        statusUpdated += 1;
      } catch (e) {
        // skip this ticker; keep going
        console.error(`status failed for ${trade.ticker}:`, e.message || e);
      }
    }

    return sendJson(res, 200, { date: today, snapshots, statusUpdated });
  } catch (err) {
    return sendError(res, err);
  }
}
