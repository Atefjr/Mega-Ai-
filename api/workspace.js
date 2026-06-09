import { getSupabase, sendJson, sendError } from './_lib.js';

// Validate an access code. Used by the login gate.
export default async function handler(req, res) {
  try {
    const code = (req.query?.code || (req.body && req.body.code) || '').toString().trim();
    if (!code) return sendJson(res, 400, { error: 'code is required' });
    const supabase = getSupabase();
    const { data, error } = await supabase.from('workspaces').select('code, label').eq('code', code).maybeSingle();
    if (error) throw error;
    if (!data) return sendJson(res, 401, { error: 'Invalid access code' });
    return sendJson(res, 200, { ok: true, code: data.code, label: data.label || '' });
  } catch (err) {
    return sendError(res, err);
  }
}
