import { getSupabase, sendJson, sendError } from './_lib.js';

const FIELDS = 'id, name, icon, description, cautious_criteria, break_criteria, example_ticker, created_at';

function pickThesisFields(body) {
  const out = {};
  if (body.name != null) out.name = String(body.name).trim();
  if (body.icon != null) out.icon = String(body.icon).slice(0, 8);
  if (body.description != null) out.description = String(body.description);
  if (body.cautious_criteria != null) out.cautious_criteria = String(body.cautious_criteria);
  if (body.break_criteria != null) out.break_criteria = String(body.break_criteria);
  if (body.example_ticker != null) out.example_ticker = String(body.example_ticker).toUpperCase().slice(0, 8);
  return out;
}

export default async function handler(req, res) {
  try {
    const supabase = getSupabase();

    if (req.method === 'GET') {
      const { data, error } = await supabase
        .from('theses')
        .select(`${FIELDS}, suggested_tickers(id, ticker, reasons_for, reasons_against), trades(id, ticker)`)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return sendJson(res, 200, { theses: data || [] });
    }

    if (req.method === 'POST') {
      const body = req.body || {};
      const fields = pickThesisFields(body);
      if (!fields.name) return sendJson(res, 400, { error: 'name is required' });
      if (!fields.icon) fields.icon = '📈';
      const { data, error } = await supabase.from('theses').insert(fields).select(FIELDS).single();
      if (error) throw error;
      return sendJson(res, 201, { thesis: data });
    }

    if (req.method === 'PATCH') {
      const body = req.body || {};
      const id = (body.id || '').toString();
      if (!id) return sendJson(res, 400, { error: 'id is required' });
      const fields = pickThesisFields(body);
      delete fields.id;
      if (Object.keys(fields).length === 0) return sendJson(res, 400, { error: 'no fields to update' });
      const { data, error } = await supabase.from('theses').update(fields).eq('id', id).select(FIELDS).single();
      if (error) throw error;
      return sendJson(res, 200, { thesis: data });
    }

    res.setHeader('Allow', 'GET, POST, PATCH');
    return sendJson(res, 405, { error: 'Method not allowed' });
  } catch (err) {
    return sendError(res, err);
  }
}
