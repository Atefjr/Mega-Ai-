import { getSupabase, sendJson, sendError, getWorkspace } from './_lib.js';
import { analyzeStock } from './_ai.js';

const FRESH_MS = 24 * 60 * 60 * 1000; // serve cached analysis for a day

export default async function handler(req, res) {
  try {
    const ws = getWorkspace(req);
    if (!ws) return sendJson(res, 401, { error: 'Missing access code' });
    const supabase = getSupabase();

    if (req.method === 'GET') {
      const ticker = (req.query?.ticker || '').toString().trim().toUpperCase();
      if (ticker) {
        const { data } = await supabase
          .from('stock_analyses')
          .select('ticker, data, created_at')
          .eq('ticker', ticker)
          .maybeSingle();
        if (!data) return sendJson(res, 200, { analysis: null });
        return sendJson(res, 200, { analysis: data.data, cached: true, created_at: data.created_at });
      }
      // list recent analyses (lightweight: ticker + date + verdict)
      const { data, error } = await supabase
        .from('stock_analyses')
        .select('ticker, data, created_at')
        .order('created_at', { ascending: false })
        .limit(30);
      if (error) throw error;
      const recent = (data || []).map((r) => ({
        ticker: r.ticker,
        created_at: r.created_at,
        verdict: r.data?.verdict || null,
        company: r.data?.company || null,
      }));
      return sendJson(res, 200, { recent });
    }

    if (req.method !== 'POST') {
      res.setHeader('Allow', 'GET, POST');
      return sendJson(res, 405, { error: 'Method not allowed' });
    }
    const body = req.body || {};
    const ticker = (body.ticker || '').toString().trim().toUpperCase();
    if (!ticker) return sendJson(res, 400, { error: 'ticker is required' });
    const force = !!body.force;

    if (!force) {
      const { data: cached } = await supabase
        .from('stock_analyses')
        .select('ticker, data, created_at')
        .eq('ticker', ticker)
        .maybeSingle();
      if (cached && cached.created_at && Date.now() - new Date(cached.created_at).getTime() < FRESH_MS) {
        return sendJson(res, 200, { analysis: cached.data, cached: true, created_at: cached.created_at });
      }
    }

    const analysis = await analyzeStock(ticker);
    const created_at = new Date().toISOString();
    await supabase.from('stock_analyses').upsert({ ticker, data: analysis, created_at }, { onConflict: 'ticker' });
    return sendJson(res, 200, { analysis, cached: false, created_at });
  } catch (err) {
    return sendError(res, err);
  }
}
