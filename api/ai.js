// Theme research endpoint. Delegates to researchCandidates() in _ai.js, which
// uses Claude Sonnet + a capped web search and tolerates web-search pause_turn.
import { getSupabase, sendJson, sendError } from './_lib.js';
import { researchCandidates } from './_ai.js';

export default async function handler(req, res) {
  try {
    const type = (req.query?.type || (req.body && req.body.type) || '').toString();
    if (type !== 'research') {
      return sendJson(res, 400, { error: 'Unknown type. Use type=research.' });
    }

    const body = req.body || {};
    const thesis = body.thesis || {};
    const name = (thesis.name || req.query?.thesis || '').toString().trim();
    const description = (thesis.description || '').toString();
    const exclude = Array.isArray(body.exclude) ? body.exclude.map((s) => String(s).toUpperCase()) : [];
    if (!name) return sendJson(res, 400, { error: 'thesis name is required' });

    const { summary, candidates } = await researchCandidates(name, description);
    const filtered = (candidates || []).filter((c) => !exclude.includes(c.ticker)).slice(0, 6);

    // Persist as suggestions so they stick on the thesis (best-effort).
    if (body.thesis_id && filtered.length) {
      const supabase = getSupabase();
      const rows = filtered.map((c) => ({
        thesis_id: body.thesis_id,
        ticker: c.ticker,
        reasons_for: c.reasons_for,
        reasons_against: c.reasons_against,
      }));
      await supabase.from('suggested_tickers').upsert(rows, { onConflict: 'thesis_id,ticker' });
    }

    return sendJson(res, 200, { stub: false, summary, candidates: filtered });
  } catch (err) {
    return sendError(res, err);
  }
}
