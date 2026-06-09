import { getQuotes, getCompanyNews, getBasicFinancials, getSupabase, sendJson, sendError } from './_lib.js';

const ALLOWED = ['halal', 'not_halal', 'unknown'];
const splitSyms = (raw) => (raw || '').toString().trim().split(',').map((s) => s.trim().toUpperCase()).filter(Boolean);

export default async function handler(req, res) {
  try {
    const kind = (req.query?.kind || (req.body && req.body.kind) || '').toString();

    if (req.method === 'GET') {
      if (kind === 'quotes') {
        const symbols = splitSyms(req.query?.symbols);
        if (!symbols.length) return sendJson(res, 200, { quotes: {} });
        const quotes = await getQuotes(symbols);
        return sendJson(res, 200, { quotes });
      }

      if (kind === 'news') {
        const symbol = (req.query?.symbol || '').toString().trim();
        if (!symbol) return sendJson(res, 400, { error: 'symbol is required' });
        const limit = Math.min(parseInt(req.query?.limit, 10) || 3, 10);
        const news = await getCompanyNews(symbol, limit);
        return sendJson(res, 200, { news });
      }

      if (kind === 'perf') {
        const symbols = splitSyms(req.query?.symbols).slice(0, 12);
        if (!symbols.length) return sendJson(res, 200, { perf: {} });
        const entries = await Promise.all(
          symbols.map(async (sym) => {
            try {
              const m = await getBasicFinancials(sym);
              return [sym, { oneYear: m['52WeekPriceReturnDaily'] ?? null, fiveYear: null }];
            } catch {
              return [sym, { oneYear: null, fiveYear: null }];
            }
          })
        );
        return sendJson(res, 200, { perf: Object.fromEntries(entries) });
      }

      if (kind === 'meta') {
        const symbols = splitSyms(req.query?.symbols);
        const supabase = getSupabase();
        let query = supabase.from('ticker_meta').select('symbol, halal_status, note');
        if (symbols.length) query = query.in('symbol', symbols);
        const { data, error } = await query;
        if (error) throw error;
        const meta = {};
        for (const row of data || []) meta[row.symbol] = { halal_status: row.halal_status, note: row.note };
        return sendJson(res, 200, { meta });
      }

      return sendJson(res, 400, { error: 'unknown kind (use quotes | news | perf | meta)' });
    }

    if (req.method === 'POST') {
      if (kind === 'meta') {
        const body = req.body || {};
        const symbol = (body.symbol || '').toString().trim().toUpperCase();
        const status = (body.halal_status || '').toString();
        if (!symbol) return sendJson(res, 400, { error: 'symbol is required' });
        if (!ALLOWED.includes(status)) return sendJson(res, 400, { error: 'invalid halal_status' });
        const supabase = getSupabase();
        const row = { symbol, halal_status: status, note: (body.note || '').toString(), updated_at: new Date().toISOString() };
        const { data, error } = await supabase.from('ticker_meta').upsert(row, { onConflict: 'symbol' }).select().single();
        if (error) throw error;
        return sendJson(res, 200, { meta: data });
      }
      return sendJson(res, 400, { error: 'unknown kind' });
    }

    res.setHeader('Allow', 'GET, POST');
    return sendJson(res, 405, { error: 'Method not allowed' });
  } catch (err) {
    return sendError(res, err);
  }
}
