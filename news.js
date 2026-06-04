import { getCompanyNews, sendJson, sendError } from './_lib.js';

export default async function handler(req, res) {
  try {
    const symbol = (req.query?.symbol || '').toString().trim();
    if (!symbol) return sendJson(res, 400, { error: 'symbol is required' });
    const limit = Math.min(parseInt(req.query?.limit, 10) || 3, 10);
    const news = await getCompanyNews(symbol, limit);
    return sendJson(res, 200, { news });
  } catch (err) {
    return sendError(res, err);
  }
}
