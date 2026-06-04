import { getSupabase, sendJson, sendError } from './_lib.js';

export default async function handler(req, res) {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('history')
      .select('*')
      .order('closed_at', { ascending: false });
    if (error) throw error;
    return sendJson(res, 200, { history: data || [] });
  } catch (err) {
    return sendError(res, err);
  }
}
