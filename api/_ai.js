// Real AI logic for Slice 2. Not a routable endpoint (underscore prefix).
import {
  getQuote,
  getCompanyNews,
  getBasicFinancials,
  getRecommendationTrends,
  anthropicMessages,
  extractText,
  extractJson,
} from './_lib.js';

// Model tiering: cheap classifier for status, stronger model for open-ended research.
const MODEL_STATUS = 'claude-haiku-4-5-20251001';
const MODEL_RESEARCH = 'claude-sonnet-4-6';

const STATUS_SYSTEM = `You monitor whether an investor's stock thesis still holds, based on recent evidence.
Classify the thesis into exactly one label:
- "Intact": evidence on balance supports the thesis.
- "Cautious": mixed signals or an emerging risk, but the thesis is not invalidated.
- "Broken": the core reason for the thesis is invalidated or strongly contradicted by the evidence.
Be conservative and judicious. Ordinary price volatility, or the position simply being down, is NOT by itself a broken thesis — focus on whether the underlying reasoning still holds.
Respond with ONLY a JSON object, no markdown, no prose:
{"label": "Intact" | "Cautious" | "Broken", "rationale": "<=160 chars naming the single most important signal"}`;

/** Assemble a compact, mostly-free evidence packet for one position. */
export async function buildEvidence(trade) {
  const ticker = trade.ticker;
  const ev = {
    ticker,
    thesis: {
      name: trade.thesis?.name || null,
      description: trade.thesis?.description || null,
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
    const news = await getCompanyNews(ticker, 6);
    ev.recent_headlines = news.map((n) => n.headline).filter(Boolean).slice(0, 6);
  } catch {
    ev.recent_headlines = [];
  }

  return ev;
}

/** Classify thesis status for one position. Returns { label, rationale, evidence }. */
export async function computeThesisStatus(trade) {
  const evidence = await buildEvidence(trade);
  const resp = await anthropicMessages({
    model: MODEL_STATUS,
    max_tokens: 250,
    // cache the rubric so the daily batch of classifications reuses it cheaply
    system: [{ type: 'text', text: STATUS_SYSTEM, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: 'Evidence:\n' + JSON.stringify(evidence) }],
  });
  const parsed = extractJson(extractText(resp.content)) || {};
  const label = ['Intact', 'Cautious', 'Broken'].includes(parsed.label) ? parsed.label : null;
  const rationale = (parsed.rationale || '').toString().slice(0, 240);
  return { label, rationale, evidence };
}

const RESEARCH_SYSTEM = `You are an equity research assistant for thesis-driven investing.
Use web search to identify CURRENT, real, US-listed (NYSE/Nasdaq) stocks that fit the user's thesis.
Return 3-5 candidate tickers, each with a concise bull case and bear case grounded in what you find.
Respond with ONLY a JSON object — no prose, no markdown fences:
{"summary": "<=300 char overview", "candidates": [{"ticker": "TICK", "reasons_for": "...", "reasons_against": "..."}]}
Use real ticker symbols. Keep each reason under ~200 chars.`;

/** Research candidate tickers for a thesis using Sonnet + a capped web search. */
export async function researchCandidates(thesisName, thesisDescription) {
  const tools = [{ type: 'web_search_20250305', name: 'web_search', max_uses: 5 }];
  const userText = `Thesis: ${thesisName || '(unnamed)'}\n\n${thesisDescription || ''}`.trim();
  let messages = [{ role: 'user', content: userText }];
  let resp;
  // Server-side web search may return pause_turn for long turns; continue a couple of times.
  for (let i = 0; i < 3; i++) {
    resp = await anthropicMessages({
      model: MODEL_RESEARCH,
      max_tokens: 1800,
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
