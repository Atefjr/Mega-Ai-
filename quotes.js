import { getQuotes, sendJson, sendError } from './_lib.js';

export default async function handler(req, res) {
  try {
    const raw = (req.query?.symbols || '').toString().trim();
    if (!raw) return sendJson(res, 200, { quotes: {} });
    const symbols = raw.split(',').map((s) => s.trim()).filter(Boolean);
    const quotes = await getQuotes(symbols);
    return sendJson(res, 200, { quotes });
  } catch (err) {
    return sendError(res, err);
  }
}
