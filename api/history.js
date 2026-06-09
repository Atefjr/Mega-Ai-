import { getSupabase, sendJson, sendError, getWorkspace } from './_lib.js';

// Recompute pnl and performance from the editable inputs so the row stays consistent.
function recompute(row) {
  const amount = Number(row.amount_invested);
  const avg = Number(row.avg_cost);
  const exit = Number(row.exit_price);
  if (amount > 0 && avg > 0 && exit > 0) {
    const shares = amount / avg;
    row.pnl = shares * exit - amount;
    row.performance_pct = (exit / avg - 1) * 100;
  }
  return row;
}

export default async function handler(req, res) {
  try {
    const ws = getWorkspace(req);
    if (!ws) return sendJson(res, 401, { error: 'Missing access code' });
    const supabase = getSupabase();

    if (req.method === 'GET') {
      const { data, error } = await supabase
        .from('history')
        .select('*')
        .eq('workspace', ws)
        .order('closed_at', { ascending: false });
      if (error) throw error;
      return sendJson(res, 200, { history: data || [] });
    }

    if (req.method === 'PATCH') {
      const body = req.body || {};
      const id = (body.id || '').toString();
      if (!id) return sendJson(res, 400, { error: 'id is required' });

      const patch = {};
      for (const k of ['ticker', 'thesis_name']) {
        if (body[k] != null) patch[k] = String(body[k]);
      }
      for (const k of ['amount_invested', 'avg_cost', 'exit_price']) {
        if (body[k] != null) patch[k] = Number(body[k]);
      }
      for (const k of ['purchased_at', 'closed_at']) {
        if (body[k]) patch[k] = body[k];
      }
      if (Object.keys(patch).length === 0) return sendJson(res, 400, { error: 'no fields to update' });

      // Pull current row, apply edits, recompute derived numbers, save.
      const { data: cur, error: curErr } = await supabase.from('history').select('*').eq('id', id).eq('workspace', ws).single();
      if (curErr) throw curErr;
      const merged = recompute({ ...cur, ...patch });
      const { data, error } = await supabase
        .from('history')
        .update({
          ticker: merged.ticker,
          thesis_name: merged.thesis_name,
          amount_invested: merged.amount_invested,
          avg_cost: merged.avg_cost,
          exit_price: merged.exit_price,
          pnl: merged.pnl,
          performance_pct: merged.performance_pct,
          purchased_at: merged.purchased_at,
          closed_at: merged.closed_at,
        })
        .eq('id', id)
        .eq('workspace', ws)
        .select()
        .single();
      if (error) throw error;
      return sendJson(res, 200, { history: data });
    }

    if (req.method === 'DELETE') {
      const id = (req.query?.id || req.body?.id || '').toString();
      if (!id) return sendJson(res, 400, { error: 'id is required' });
      const { error } = await supabase.from('history').delete().eq('id', id).eq('workspace', ws);
      if (error) throw error;
      return sendJson(res, 200, { deleted: true });
    }

    res.setHeader('Allow', 'GET, PATCH, DELETE');
    return sendJson(res, 405, { error: 'Method not allowed' });
  } catch (err) {
    return sendError(res, err);
  }
}
