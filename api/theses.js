import { getSupabase, sendJson, sendError } from './_lib.js';

export default async function handler(req, res) {
  try {
    const supabase = getSupabase();

    if (req.method === 'GET') {
      const { data, error } = await supabase
        .from('theses')
        .select('id, name, icon, description, created_at, suggested_tickers(id, ticker, reasons_for, reasons_against), trades(id, ticker)')
        .order('created_at', { ascending: true });
      if (error) throw error;
      return sendJson(res, 200, { theses: data || [] });
    }

    if (req.method === 'POST') {
      const body = req.body || {};
      const name = (body.name || '').toString().trim();
      if (!name) return sendJson(res, 400, { error: 'name is required' });
      const insert = {
        name,
        icon: (body.icon || '📈').toString().slice(0, 8),
        description: (body.description || '').toString(),
      };
      const { data, error } = await supabase
        .from('theses')
        .insert(insert)
        .select()
        .single();
      if (error) throw error;
      return sendJson(res, 201, { thesis: data });
    }

    res.setHeader('Allow', 'GET, POST');
    return sendJson(res, 405, { error: 'Method not allowed' });
  } catch (err) {
    return sendError(res, err);
  }
}
