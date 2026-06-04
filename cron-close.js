// Runs on a schedule (see vercel.json crons) after the US market close.
// Slice 1: snapshot each open ticker's closing price so the dashboard can show
// the day's movement. Slice 2 will additionally evaluate thesis status and push
// "Status Change" / "PNL Negative at close" alerts to the Telegram bot.
import { getSupabase, getQuotes, sendJson, sendError } from './_lib.js';

export default async function handler(req, res) {
  try {
    // Optional shared-secret guard for the cron endpoint.
    const secret = process.env.CRON_SECRET;
    if (secret) {
      const provided = req.headers['x-cron-secret'] || req.query?.secret;
      if (provided !== secret) return sendJson(res, 401, { error: 'Unauthorized' });
    }

    const supabase = getSupabase();
    const { data: trades, error } = await supabase.from('trades').select('ticker');
    if (error) throw error;

    const tickers = [...new Set((trades || []).map((t) => t.ticker))];
    if (tickers.length === 0) return sendJson(res, 200, { snapshots: 0 });

    const quotes = await getQuotes(tickers);
    const today = new Date().toISOString().slice(0, 10);
    const rows = tickers
      .filter((t) => quotes[t] && !quotes[t].error)
      .map((t) => ({
        ticker: t,
        price: quotes[t].current,
        change: quotes[t].change,
        change_pct: quotes[t].changePct,
        snapshot_date: today,
      }));

    if (rows.length > 0) {
      const { error: upErr } = await supabase
        .from('price_snapshots')
        .upsert(rows, { onConflict: 'ticker,snapshot_date' });
      if (upErr) throw upErr;
    }

    return sendJson(res, 200, { snapshots: rows.length, date: today });
  } catch (err) {
    return sendError(res, err);
  }
}
