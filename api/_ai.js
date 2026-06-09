// Real AI logic. Not a routable endpoint (underscore prefix).
import {
  getQuote,
  getCompanyNews,
  getBasicFinancials,
  getRecommendationTrends,
  getCompanyProfile,
  anthropicMessages,
  extractText,
  extractJson,
} from './_lib.js';

// Model tiering: cheap classifier for status, stronger model for research/analysis.
const MODEL_STATUS = 'claude-haiku-4-5-20251001';
const MODEL_RESEARCH = 'claude-sonnet-4-6';

const clamp100 = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(0, Math.min(100, Math.round(n))) : null;
};

const STATUS_SYSTEM = `You monitor whether an investor's stock thesis still holds, based on recent evidence.
You are given the thesis, optional "cautious if" and "breaks if" conditions the investor wrote, the position's return so far, and market evidence.

Classify into exactly one label:
- "Intact": evidence on balance supports the thesis.
- "Cautious": mixed signals or an emerging risk (especially if a "cautious if" condition is showing), but not invalidated.
- "Broken": the core reason is invalidated or strongly contradicted (especially if a "breaks if" condition is met).
Be conservative. Ordinary volatility, or simply being down, is NOT a broken thesis on its own.

Also output a CONVICTION score 0-100 = how strongly current evidence supports the thesis holding (this is a qualitative read, NOT a probability of profit), and three 0-100 sub-signals:
- execution: fundamentals, earnings, analyst signals
- price: price action vs the 52-week range and the position
- sentiment: tone of recent news

Respond with ONLY a JSON object, no markdown, no prose:
{"label":"Intact|Cautious|Broken","conviction":0,"signals":{"execution":0,"price":0,"sentiment":0},"rationale":"<=160 chars naming the single most important signal"}`;

/** Assemble a compact, mostly-free evidence packet for one position. */
export async function buildEvidence(trade) {
  const ticker = trade.ticker;
  const ev = {
    ticker,
    thesis: {
      name: trade.thesis?.name || null,
      description: trade.thesis?.description || null,
      cautious_if: trade.thesis?.cautious_criteria || null,
      breaks_if: trade.thesis?.break_criteria || null,
    },
  };
  let price = null;

  try {
    const q = await getQuote(ticker);
    price = q.current;
    const avg = Number(trade.avg_cost);
    ev.position = {
      avg_cost: avg,
      current_price: q.current,
      return_pct: q.current && avg ? Number((((q.current / avg) - 1) * 100).toFixed(2)) : null,
      day_change_pct: q.changePct,
    };
  } catch {
    ev.position = { note: 'quote unavailable' };
  }

  try {
    const m = await getBasicFinancials(ticker);
    const high = m['52WeekHigh'];
    const low = m['52WeekLow'];
    ev.range_52w = {
      high: high ?? null,
      low: low ?? null,
      pct_from_high: high && price ? Number((((price / high) - 1) * 100).toFixed(2)) : null,
      pct_above_low: low && price ? Number((((price / low) - 1) * 100).toFixed(2)) : null,
    };
    ev.return_1y_pct = m['52WeekPriceReturnDaily'] ?? null;
  } catch {
    /* optional signal */
  }

  try {
    const r = await getRecommendationTrends(ticker);
    if (r) {
      ev.analyst_ratings = {
        strongBuy: r.strongBuy, buy: r.buy, hold: r.hold, sell: r.sell, strongSell: r.strongSell,
        period: r.period,
      };
    }
  } catch {
    /* optional signal */
  }

  try {
    const news = await getCompanyNews(ticker, 4);
    ev.recent_headlines = news.map((n) => n.headline).filter(Boolean).slice(0, 4);
  } catch {
    ev.recent_headlines = [];
  }

  return ev;
}

/** Classify thesis status for one position. */
export async function computeThesisStatus(trade) {
  const evidence = await buildEvidence(trade);
  const resp = await anthropicMessages({
    model: MODEL_STATUS,
    max_tokens: 320,
    // cache the rubric so the daily batch of classifications reuses it cheaply
    system: [{ type: 'text', text: STATUS_SYSTEM, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: 'Evidence:\n' + JSON.stringify(evidence) }],
  });
  const parsed = extractJson(extractText(resp.content)) || {};
  const label = ['Intact', 'Cautious', 'Broken'].includes(parsed.label) ? parsed.label : null;
  const rationale = (parsed.rationale || '').toString().slice(0, 240);
  const conviction = clamp100(parsed.conviction);
  const s = parsed.signals && typeof parsed.signals === 'object' ? parsed.signals : {};
  const signals = {
    execution: clamp100(s.execution),
    price: clamp100(s.price),
    sentiment: clamp100(s.sentiment),
  };
  const hasSignals = signals.execution != null || signals.price != null || signals.sentiment != null;
  return { label, rationale, conviction, signals: hasSignals ? signals : null, evidence };
}

const RESEARCH_SYSTEM = `You are an equity research assistant for thesis-driven investing.
Use web search to identify CURRENT, real, US-listed (NYSE/Nasdaq) stocks that fit the user's thesis.
Return 3-5 candidate tickers, each with a concise bull case and bear case grounded in what you find.
Respond with ONLY a JSON object — no prose, no markdown fences:
{"summary": "<=300 char overview", "candidates": [{"ticker": "TICK", "reasons_for": "...", "reasons_against": "..."}]}
Use real ticker symbols. Keep each reason under ~200 chars.`;

/** Research candidate tickers for a thesis using Sonnet + a capped web search. */
export async function researchCandidates(thesisName, thesisDescription) {
  const tools = [{ type: 'web_search_20250305', name: 'web_search', max_uses: 3 }];
  const userText = `Thesis: ${thesisName || '(unnamed)'}\n\n${thesisDescription || ''}`.trim();
  let messages = [{ role: 'user', content: userText }];
  let resp;
  for (let i = 0; i < 2; i++) {
    resp = await anthropicMessages({
      model: MODEL_RESEARCH,
      max_tokens: 1200,
      system: RESEARCH_SYSTEM,
      messages,
      tools,
    });
    if (resp.stop_reason === 'pause_turn') {
      messages = [...messages, { role: 'assistant', content: resp.content }];
      continue;
    }
    break;
  }
  const parsed = extractJson(extractText(resp.content)) || {};
  const candidates = Array.isArray(parsed.candidates)
    ? parsed.candidates
        .filter((c) => c && c.ticker)
        .slice(0, 6)
        .map((c) => ({
          ticker: String(c.ticker).toUpperCase().slice(0, 8),
          reasons_for: String(c.reasons_for || '').slice(0, 400),
          reasons_against: String(c.reasons_against || '').slice(0, 400),
        }))
    : [];
  return { summary: String(parsed.summary || '').slice(0, 600), candidates };
}

// ---------- Stock analysis ----------
function pickMetrics(m = {}) {
  const g = (k) => (m && m[k] != null ? m[k] : null);
  return {
    peTTM: g('peTTM') ?? g('peNormalizedAnnual'),
    psTTM: g('psTTM'),
    pbAnnual: g('pbAnnual'),
    grossMarginTTM: g('grossMarginTTM'),
    operatingMarginTTM: g('operatingMarginTTM'),
    netMarginTTM: g('netProfitMarginTTM'),
    roeTTM: g('roeTTM'),
    revenueGrowthYoY: g('revenueGrowthTTMYoy'),
    epsGrowthYoY: g('epsGrowthTTMYoy'),
    debtToEquity: g('totalDebt/totalEquityAnnual') ?? g('longTermDebt/equityAnnual'),
    currentRatio: g('currentRatioAnnual'),
    dividendYield: g('dividendYieldIndicatedAnnual'),
    beta: g('beta'),
    week52High: g('52WeekHigh'),
    week52Low: g('52WeekLow'),
    return1Y: g('52WeekPriceReturnDaily'),
  };
}

const ANALYZE_SYSTEM = `You are a buy-side equity analyst. Produce a high-level but rigorous analysis of one US-listed stock for a thesis-driven investor, using the structured data provided and CURRENT information from web search.
Be specific and balanced. This is decision support and educational analysis, NOT financial advice or a recommendation to buy or sell.
Respond with ONLY a JSON object — no prose, no markdown fences:
{
 "company": "name",
 "snapshot": "<=320 chars: what it does and the current setup",
 "verdict": "Bullish | Neutral | Bearish",
 "verdict_note": "<=200 chars why",
 "valuation": "<=300 chars",
 "growth": "<=300 chars",
 "profitability": "<=300 chars",
 "balance_sheet": "<=300 chars",
 "moat": "<=300 chars",
 "bull_case": ["<=160 chars", "..."],
 "bear_case": ["<=160 chars", "..."],
 "risks": ["<=160 chars", "..."],
 "what_to_watch": ["<=160 chars", "..."]
}`;

/** Hedge-fund-style structured analysis for one ticker. */
export async function analyzeStock(ticker) {
  const sym = String(ticker).toUpperCase();
  const [quote, metric, recs, news, profile] = await Promise.all([
    getQuote(sym).catch(() => null),
    getBasicFinancials(sym).catch(() => ({})),
    getRecommendationTrends(sym).catch(() => null),
    getCompanyNews(sym, 6).catch(() => []),
    getCompanyProfile(sym).catch(() => null),
  ]);

  const evidence = {
    ticker: sym,
    profile: profile
      ? { name: profile.name, industry: profile.finnhubIndustry, marketCap: profile.marketCapitalization, country: profile.country }
      : null,
    quote: quote ? { price: quote.current, dayChangePct: quote.changePct } : null,
    metrics: pickMetrics(metric),
    analyst_ratings: recs,
    headlines: (news || []).map((n) => n.headline).filter(Boolean).slice(0, 6),
  };

  const tools = [{ type: 'web_search_20250305', name: 'web_search', max_uses: 3 }];
  let messages = [{
    role: 'user',
    content:
      `Analyze ${sym} for a thesis-driven investor. Use the data below plus web search for the latest developments, then return the JSON.\n\nDATA:\n` +
      JSON.stringify(evidence),
  }];
  let resp;
  for (let i = 0; i < 2; i++) {
    resp = await anthropicMessages({
      model: MODEL_RESEARCH,
      max_tokens: 1800,
      system: ANALYZE_SYSTEM,
      messages,
      tools,
    });
    if (resp.stop_reason === 'pause_turn') {
      messages = [...messages, { role: 'assistant', content: resp.content }];
      continue;
    }
    break;
  }
  const parsed = extractJson(extractText(resp.content)) || {};
  return { ticker: sym, ...parsed, _evidence: { price: evidence.quote?.price ?? null, metrics: evidence.metrics } };
}
