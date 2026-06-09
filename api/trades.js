import { getSupabase, sendJson, sendError } from './_lib.js';

const LIST_COLS = 'id, ticker, amount_invested, avg_cost, shares, purchased_at, status_label, status_rationale, status_conviction, status_signals, status_updated_at, is_paper, thesis_id, thesis:theses(id, name, icon)';

export default async function handler(req, res) {
  try {
    const supabase = getSupabase();

    if (req.method === 'GET') {
      // ?paper=true | false ; omit for all
      let query = supabase.from('trades').select(LIST_COLS).order('created_at', { ascending: true });
      const paper = req.query?.paper;
      if (paper === 'true') query = query.eq('is_paper', true);
      else if (paper === 'false') query = query.eq('is_paper', false);
      const { data, error } = await query;
      if (error) throw error;
      return sendJson(res, 200, { trades: data || [] });
    }

    if (req.method === 'POST') {
      const body = req.body || {};
      const ticker = (body.ticker || '').toString().trim().toUpperCase();
      const amount = Number(body.amount_invested);
      const avgCost = Number(body.avg_cost);
      const purchasedAt = (body.purchased_at || '').toString().trim();
      const isPaper = !!body.is_paper;

      if (!ticker) return sendJson(res, 400, { error: 'ticker is required' });
      if (!(amount > 0)) return sendJson(res, 400, { error: 'amount_invested must be greater than 0' });
      if (!(avgCost > 0)) return sendJson(res, 400, { error: 'cost per share must be greater than 0' });

      const thesisId = body.thesis_id || null;
      const selectCols = 'id, ticker, amount_invested, avg_cost, shares, purchased_at, is_paper, thesis_id, thesis:theses(id, name, icon)';

      // Fold into an existing OPEN position of the same ticker + thesis + paper/live bucket.
      let existQuery = supabase.from('trades').select('id, amount_invested, avg_cost').eq('ticker', ticker).eq('is_paper', isPaper);
      existQuery = thesisId ? existQuery.eq('thesis_id', thesisId) : existQuery.is('thesis_id', null);
      const { data: existRows, error: existErr } = await existQuery.order('created_at', { ascending: true }).limit(1);
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

      const insert = { ticker, amount_invested: amount, avg_cost: avgCost, thesis_id: thesisId, is_paper: isPaper };
      if (purchasedAt) insert.purchased_at = purchasedAt;

      const { data, error } = await supabase.from('trades').insert(insert).select(selectCols).single();
      if (error) throw error;
      return sendJson(res, 201, { trade: data, merged: false });
    }

    res.setHeader('Allow', 'GET, POST');
    return sendJson(res, 405, { error: 'Method not allowed' });
  } catch (err) {
    return sendError(res, err);
  }
}
