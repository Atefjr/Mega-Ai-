import { getSupabase, sendJson, sendError } from './_lib.js';

const IMPOSSIBLE_ID = '00000000-0000-0000-0000-000000000000';

export default async function handler(req, res) {
  try {
    const supabase = getSupabase();

    if (req.method === 'GET') {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      const unread = (data || []).filter((n) => !n.read).length;
      return sendJson(res, 200, { notifications: data || [], unread });
    }

    if (req.method === 'PATCH') {
      const body = req.body || {};
      if (body.markAllRead) {
        const { error } = await supabase.from('notifications').update({ read: true }).eq('read', false);
        if (error) throw error;
        return sendJson(res, 200, { ok: true });
      }
      const id = (body.id || '').toString();
      if (!id) return sendJson(res, 400, { error: 'id is required' });
      const { error } = await supabase.from('notifications').update({ read: body.read !== false }).eq('id', id);
      if (error) throw error;
      return sendJson(res, 200, { ok: true });
    }

    if (req.method === 'DELETE') {
      if (req.query?.all === 'true') {
        const { error } = await supabase.from('notifications').delete().neq('id', IMPOSSIBLE_ID);
        if (error) throw error;
        return sendJson(res, 200, { ok: true });
      }
      const id = (req.query?.id || '').toString();
      if (!id) return sendJson(res, 400, { error: 'id is required' });
      const { error } = await supabase.from('notifications').delete().eq('id', id);
      if (error) throw error;
      return sendJson(res, 200, { ok: true });
    }

    res.setHeader('Allow', 'GET, PATCH, DELETE');
    return sendJson(res, 405, { error: 'Method not allowed' });
  } catch (err) {
    return sendError(res, err);
  }
}
