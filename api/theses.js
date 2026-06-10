import { getSupabase, sendJson, sendError, getWorkspace } from './_lib.js';

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
    const ws = getWorkspace(req);
    if (!ws) return sendJson(res, 401, { error: 'Missing access code' });
    const supabase = getSupabase();

    if (req.method === 'GET') {
      const { data, error } = await supabase
        .from('theses')
        .select(`${FIELDS}, suggested_tickers(id, ticker, reasons_for, reasons_against, conviction), trades(id, ticker, is_paper)`)
        .eq('workspace', ws)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return sendJson(res, 200, { theses: data || [] });
    }

    if (req.method === 'POST') {
      const body = req.body || {};
      const fields = pickThesisFields(body);
      if (!fields.name) return sendJson(res, 400, { error: 'name is required' });
      if (!fields.icon) fields.icon = '📈';
      fields.workspace = ws;
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
      const { data, error } = await supabase
        .from('theses')
        .update(fields)
        .eq('id', id)
        .eq('workspace', ws)
        .select(FIELDS)
        .single();
      if (error) throw error;
      return sendJson(res, 200, { thesis: data });
    }

    if (req.method === 'DELETE') {
      const id = (req.query?.id || (req.body && req.body.id) || '').toString();
      if (!id) return sendJson(res, 400, { error: 'id is required' });
      // confirm the thesis belongs to this workspace
      const { data: th, error: thErr } = await supabase
        .from('theses')
        .select('id')
        .eq('id', id)
        .eq('workspace', ws)
        .maybeSingle();
      if (thErr) throw thErr;
      if (!th) return sendJson(res, 404, { error: 'Thesis not found' });
      // detach open positions (they keep living without a thesis), drop its suggestions, then delete
      await supabase.from('trades').update({ thesis_id: null }).eq('thesis_id', id);
      await supabase.from('suggested_tickers').delete().eq('thesis_id', id);
      const { error } = await supabase.from('theses').delete().eq('id', id).eq('workspace', ws);
      if (error) throw error;
      return sendJson(res, 200, { deleted: true });
    }

    res.setHeader('Allow', 'GET, POST, PATCH, DELETE');
    return sendJson(res, 405, { error: 'Method not allowed' });
  } catch (err) {
    return sendError(res, err);
  }
}
