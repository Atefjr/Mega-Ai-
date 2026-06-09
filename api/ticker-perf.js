import { getBasicFinancials, sendJson, sendError } from './_lib.js';

export default async function handler(req, res) {
  try {
    const raw = (req.query?.symbols || '').toString().trim();
    if (!raw) return sendJson(res, 200, { perf: {} });
    const symbols = [...new Set(raw.split(',').map((s) => s.trim().toUpperCase()).filter(Boolean))].slice(0, 12);
    const entries = await Promise.all(
      symbols.map(async (sym) => {
        try {
          const m = await getBasicFinancials(sym);
          // Finnhub free tier reliably exposes 1Y; 5Y needs a paid data tier.
          return [sym, { oneYear: m['52WeekPriceReturnDaily'] ?? null, fiveYear: null }];
        } catch {
          return [sym, { oneYear: null, fiveYear: null }];
        }
      })
    );
    return sendJson(res, 200, { perf: Object.fromEntries(entries) });
  } catch (err) {
    return sendError(res, err);
  }
}
