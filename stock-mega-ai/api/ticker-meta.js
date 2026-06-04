import { getSupabase, sendJson, sendError } from './_lib.js';

const ALLOWED = ['halal', 'not_halal', 'unknown'];

export default async function handler(req, res) {
  try {
    const supabase = getSupabase();

    if (req.method === 'GET') {
      const raw = (req.query?.symbols || '').toString().trim();
      const symbols = raw
        ? raw.split(',').map((s) => s.trim().toUpperCase()).filter(Boolean)
        : [];
      let query = supabase.from('ticker_meta').select('symbol, halal_status, note');
      if (symbols.length) query = query.in('symbol', symbols);
      const { data, error } = await query;
      if (error) throw error;
      const meta = {};
      for (const row of data || []) {
        meta[row.symbol] = { halal_status: row.halal_status, note: row.note };
      }
      return sendJson(res, 200, { meta });
    }

    if (req.method === 'POST') {
      const body = req.body || {};
      const symbol = (body.symbol || '').toString().trim().toUpperCase();
      const status = (body.halal_status || '').toString();
      if (!symbol) return sendJson(res, 400, { error: 'symbol is required' });
      if (!ALLOWED.includes(status)) return sendJson(res, 400, { error: 'invalid halal_status' });
      const row = {
        symbol,
        halal_status: status,
        note: (body.note || '').toString(),
        updated_at: new Date().toISOString(),
      };
      const { data, error } = await supabase
        .from('ticker_meta')
        .upsert(row, { onConflict: 'symbol' })
        .select()
        .single();
      if (error) throw error;
      return sendJson(res, 200, { meta: data });
    }

    res.setHeader('Allow', 'GET, POST');
    return sendJson(res, 405, { error: 'Method not allowed' });
  } catch (err) {
    return sendError(res, err);
  }
}
