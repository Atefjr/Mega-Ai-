// Shared server-side helpers for the Vercel serverless functions.
// All secrets live here and are read from environment variables only.
import { createClient } from '@supabase/supabase-js';

let _supabase = null;

/** Lazily create a Supabase client using the service-role key (server-only). */
export function getSupabase() {
  if (_supabase) return _supabase;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new ConfigError(
      'Supabase is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.'
    );
  }
  _supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _supabase;
}

/** Thrown when required environment variables are missing. */
export class ConfigError extends Error {}

const FINNHUB_BASE = 'https://finnhub.io/api/v1';

function finnhubKey() {
  const key = process.env.FINNHUB_API_KEY;
  if (!key) {
    throw new ConfigError('Finnhub is not configured. Set FINNHUB_API_KEY.');
  }
  return key;
}

/** Fetch a single real-time quote. Returns Finnhub's quote shape. */
export async function getQuote(symbol) {
  const token = finnhubKey();
  const url = `${FINNHUB_BASE}/quote?symbol=${encodeURIComponent(symbol)}&token=${token}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Finnhub quote failed for ${symbol} (${res.status})`);
  }
  const q = await res.json();
  // Finnhub: c=current, d=change, dp=percent change, h/l/o, pc=prev close.
  return {
    current: numberOrNull(q.c),
    change: numberOrNull(q.d),
    changePct: numberOrNull(q.dp),
    high: numberOrNull(q.h),
    low: numberOrNull(q.l),
    open: numberOrNull(q.o),
    prevClose: numberOrNull(q.pc),
  };
}

/** Fetch quotes for many symbols. Returns { SYMBOL: quote }. */
export async function getQuotes(symbols) {
  const unique = [...new Set(symbols.map((s) => s.toUpperCase()).filter(Boolean))];
  const entries = await Promise.all(
    unique.map(async (sym) => {
      try {
        return [sym, await getQuote(sym)];
      } catch (err) {
        return [sym, { error: String(err.message || err) }];
      }
    })
  );
  return Object.fromEntries(entries);
}

/** Fetch recent company news for a symbol. */
export async function getCompanyNews(symbol, limit = 3) {
  const token = finnhubKey();
  const to = new Date();
  const from = new Date(to.getTime() - 21 * 24 * 60 * 60 * 1000); // last 21 days
  const fmt = (d) => d.toISOString().slice(0, 10);
  const url =
    `${FINNHUB_BASE}/company-news?symbol=${encodeURIComponent(symbol)}` +
    `&from=${fmt(from)}&to=${fmt(to)}&token=${token}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Finnhub news failed for ${symbol} (${res.status})`);
  }
  const items = await res.json();
  if (!Array.isArray(items)) return [];
  return items.slice(0, limit).map((n) => ({
    headline: n.headline || '',
    url: n.url || '',
    source: n.source || '',
    datetime: n.datetime ? n.datetime * 1000 : null, // seconds -> ms
    summary: n.summary || '',
  }));
}

function numberOrNull(v) {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

/** Send a JSON response. */
export function sendJson(res, status, payload) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.status(status).send(JSON.stringify(payload));
}

/** Standard error responder that maps ConfigError -> 503. */
export function sendError(res, err) {
  if (err instanceof ConfigError) {
    return sendJson(res, 503, { error: err.message, code: 'CONFIG' });
  }
  console.error(err);
  return sendJson(res, 500, { error: String(err.message || err) });
}
