import { getSupabase, sendJson, sendError } from './_lib.js';

export default async function handler(req, res) {
  try {
    const supabase = getSupabase();

    if (req.method === 'GET') {
      const { data, error } = await supabase
        .from('trades')
        .select('id, ticker, amount_invested, avg_cost, shares, purchased_at, status_label, status_rationale, status_updated_at, thesis_id, thesis:theses(id, name, icon)')
        .order('created_at', { ascending: true });
      if (error) throw error;
      return sendJson(res, 200, { trades: data || [] });
    }

    if (req.method === 'POST') {
      const body = req.body || {};
      const ticker = (body.ticker || '').toString().trim().toUpperCase();
      const amount = Number(body.amount_invested);
      const avgCost = Number(body.avg_cost);
      const purchasedAt = (body.purchased_at || '').toString().trim();

      if (!ticker) return sendJson(res, 400, { error: 'ticker is required' });
      if (!(amount > 0)) return sendJson(res, 400, { error: 'amount_invested must be greater than 0' });
      if (!(avgCost > 0)) return sendJson(res, 400, { error: 'cost per share must be greater than 0' });

      const thesisId = body.thesis_id || null;
      const selectCols = 'id, ticker, amount_invested, avg_cost, shares, purchased_at, thesis_id, thesis:theses(id, name, icon)';

      // If an open position for this ticker + thesis already exists, fold this
      // purchase into it: combine dollars and recompute the average cost.
      let existQuery = supabase.from('trades').select('id, amount_invested, avg_cost').eq('ticker', ticker);
      existQuery = thesisId ? existQuery.eq('thesis_id', thesisId) : existQuery.is('thesis_id', null);
      const { data: existRows, error: existErr } = await existQuery
        .order('created_at', { ascending: true })
        .limit(1);
      if (existErr) throw existErr;
      const existing = existRows && existRows[0];

      if (existing) {
        const oldAmount = Number(existing.amount_invested);
        const oldShares = oldAmount / Number(existing.avg_cost);
        const newShares = amount / avgCost;
        const totalAmount = oldAmount + amount;
        const totalShares = oldShares + newShares;
        const newAvg = totalAmount / totalShares;
        const { data, error } = await supabase
          .from('trades')
          .update({ amount_invested: totalAmount, avg_cost: newAvg })
          .eq('id', existing.id)
          .select(selectCols)
          .single();
        if (error) throw error;
        return sendJson(res, 200, { trade: data, merged: true });
      }

      const insert = {
        ticker,
        amount_invested: amount,
        avg_cost: avgCost,
        thesis_id: thesisId,
      };
      if (purchasedAt) insert.purchased_at = purchasedAt;

      const { data, error } = await supabase
        .from('trades')
        .insert(insert)
        .select(selectCols)
        .single();
      if (error) throw error;
      return sendJson(res, 201, { trade: data, merged: false });
    }

    res.setHeader('Allow', 'GET, POST');
    return sendJson(res, 405, { error: 'Method not allowed' });
  } catch (err) {
    return sendError(res, err);
  }
}
