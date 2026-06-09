import { getSupabase, sendJson, sendError, addNotification, getWorkspace } from './_lib.js';
import { computeThesisStatus } from './_ai.js';

// Cost guard: never classify more than this many positions in one manual run.
const MAX = 25;

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return sendJson(res, 405, { error: 'Method not allowed' });
    }
    const supabase = getSupabase();
    const onlyId = (req.body?.id || '').toString();

    const ws = getWorkspace(req);
    if (!ws) return sendJson(res, 401, { error: 'Missing access code' });
    let query = supabase
      .from('trades')
      .select('id, ticker, avg_cost, status_label, thesis_id, thesis:theses(name, description, cautious_criteria, break_criteria)')
      .eq('workspace', ws);
    if (onlyId) query = query.eq('id', onlyId);

    const { data: trades, error } = await query;
    if (error) throw error;

    const list = (trades || []).slice(0, MAX);
    const results = [];
    for (const trade of list) {
      try {
        const prevLabel = trade.status_label || null;
        const { label, rationale, conviction, signals } = await computeThesisStatus(trade);
        await supabase
          .from('trades')
          .update({
            status_label: label,
            status_rationale: rationale,
            status_conviction: conviction,
            status_signals: signals,
            status_updated_at: new Date().toISOString(),
          })
          .eq('id', trade.id);
        if (label && prevLabel && label !== prevLabel) {
          await addNotification(supabase, {
            type: 'status_change',
            title: `${trade.ticker}: ${prevLabel} → ${label}`,
            body: rationale || '',
            ticker: trade.ticker,
            thesis_id: trade.thesis_id,
            thesis_name: trade.thesis?.name || null,
            meta: { from: prevLabel, to: label, conviction },
            workspace: ws,
          });
        }
        results.push({ id: trade.id, ticker: trade.ticker, label, rationale, conviction, signals });
      } catch (e) {
        results.push({ id: trade.id, ticker: trade.ticker, error: String(e.message || e) });
      }
    }
    return sendJson(res, 200, { updated: results.length, results });
  } catch (err) {
    return sendError(res, err);
  }
}
