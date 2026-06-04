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
      if (!(avgCost > 0)) return sendJson(res, 400, { error: 'avg_cost must be greater than 0' });

      const insert = {
        ticker,
        amount_invested: amount,
        avg_cost: avgCost,
        thesis_id: body.thesis_id || null,
      };
      if (purchasedAt) insert.purchased_at = purchasedAt;

      const { data, error } = await supabase
        .from('trades')
        .insert(insert)
        .select('id, ticker, amount_invested, avg_cost, shares, purchased_at, thesis_id, thesis:theses(id, name, icon)')
        .single();
      if (error) throw error;
      return sendJson(res, 201, { trade: data });
    }

    res.setHeader('Allow', 'GET, POST');
    return sendJson(res, 405, { error: 'Method not allowed' });
  } catch (err) {
    return sendError(res, err);
  }
}
