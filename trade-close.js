import { getSupabase, getQuote, sendJson, sendError } from './_lib.js';

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return sendJson(res, 405, { error: 'Method not allowed' });
    }
    const supabase = getSupabase();
    const id = (req.body?.id || '').toString().trim();
    if (!id) return sendJson(res, 400, { error: 'id is required' });

    // Load the open position (with thesis name for the history record).
    const { data: trade, error: loadErr } = await supabase
      .from('trades')
      .select('id, ticker, amount_invested, avg_cost, purchased_at, thesis_id, thesis:theses(name)')
      .eq('id', id)
      .single();
    if (loadErr) throw loadErr;
    if (!trade) return sendJson(res, 404, { error: 'Trade not found' });

    // Exit price = current live price (fetched server-side, not trusted from client).
    const quote = await getQuote(trade.ticker);
    let exitPrice = quote.current;
    if (!(exitPrice > 0)) {
      // Fall back to client-provided price only if the live quote is unavailable.
      const fallback = Number(req.body?.exit_price);
      if (fallback > 0) exitPrice = fallback;
      else return sendJson(res, 502, { error: 'Could not get a live price to close at.' });
    }

    const amount = Number(trade.amount_invested);
    const avgCost = Number(trade.avg_cost);
    const shares = amount / avgCost;
    const currentValue = shares * exitPrice;
    const pnl = currentValue - amount;
    const performancePct = (exitPrice / avgCost - 1) * 100;

    const historyRow = {
      ticker: trade.ticker,
      thesis_id: trade.thesis_id,
      thesis_name: trade.thesis?.name || null,
      amount_invested: amount,
      avg_cost: avgCost,
      exit_price: exitPrice,
      pnl,
      performance_pct: performancePct,
      purchased_at: trade.purchased_at,
    };

    const { data: inserted, error: insErr } = await supabase
      .from('history')
      .insert(historyRow)
      .select()
      .single();
    if (insErr) throw insErr;

    const { error: delErr } = await supabase.from('trades').delete().eq('id', id);
    if (delErr) throw delErr;

    return sendJson(res, 200, { history: inserted });
  } catch (err) {
    return sendError(res, err);
  }
}
