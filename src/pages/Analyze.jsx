import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import { fmtPrice } from '../lib/format.js';
import { ErrorBanner } from '../components/States.jsx';

function verdictClass(v) {
  const s = (v || '').toLowerCase();
  if (s.includes('bull')) return 'intact';
  if (s.includes('bear')) return 'broken';
  return 'cautious';
}

function Para({ title, text }) {
  if (!text) return null;
  return (
    <div className="an-block">
      <div className="an-block-title">{title}</div>
      <p className="an-para">{text}</p>
    </div>
  );
}

function List({ title, items, tone }) {
  if (!items || !items.length) return null;
  return (
    <div className="an-block">
      <div className="an-block-title">{title}</div>
      <ul className={`an-list ${tone || ''}`}>{items.map((x, i) => <li key={i}>{x}</li>)}</ul>
    </div>
  );
}

function metricCell(label, val) {
  const ok = val != null && val !== '' && !Number.isNaN(Number(val));
  return (
    <div className="an-metric" key={label}>
      <div className="an-metric-label">{label}</div>
      <div className="an-metric-val mono">{ok ? Number(val).toLocaleString('en-US', { maximumFractionDigits: 2 }) : '—'}</div>
    </div>
  );
}

export default function Analyze() {
  const [params, setParams] = useSearchParams();
  const initial = (params.get('ticker') || '').toUpperCase();
  const [ticker, setTicker] = useState(initial);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [meta, setMeta] = useState({ cached: false, created_at: null });

  async function run(sym, force = false) {
    const t = (sym || ticker || '').trim().toUpperCase();
    if (!t) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const r = await api.analyze({ ticker: t, force });
      setResult(r.analysis || null);
      setMeta({ cached: r.cached, created_at: r.created_at });
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (initial) run(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial]);

  const a = result;
  const ev = a && a._evidence;
  const m = ev && ev.metrics;

  return (
    <div>
      <div className="page-head">
        <div className="page-kicker">Deep Dive</div>
        <h1 className="page-title">Stock Analysis</h1>
        <p className="page-sub">Plug in a US-listed ticker for a high-level read — valuation, growth, quality, the bull/bear case, and risks. Decision support, not financial advice.</p>
      </div>

      <div className="analyze-bar">
        <input
          className="mono"
          value={ticker}
          onChange={(e) => setTicker(e.target.value.toUpperCase())}
          onKeyDown={(e) => { if (e.key === 'Enter') { setParams(ticker ? { ticker } : {}); run(); } }}
          placeholder="e.g. NVDA"
        />
        <button className="btn btn-primary" disabled={loading} onClick={() => { setParams(ticker ? { ticker } : {}); run(); }}>
          {loading ? <span className="spinner" /> : 'Analyze'}
        </button>
        {a && <button className="btn" disabled={loading} onClick={() => run(ticker, true)} title="Re-run, ignoring the cached copy">↻ Refresh</button>}
      </div>

      <ErrorBanner error={error} />

      {loading && (
        <div className="empty">
          <span className="spinner" style={{ borderTopColor: 'var(--accent)', width: 22, height: 22 }} />
          <p style={{ marginTop: 12 }}>Researching {ticker}… this runs a live web search, so give it a few seconds.</p>
        </div>
      )}

      {a && !loading && (
        <div className="card analysis reveal">
          <div className="an-head">
            <div>
              <div className="an-company">{a.company || a.ticker}</div>
              <div className="an-ticker mono">{a.ticker}{ev && ev.price ? ` · $${fmtPrice(ev.price)}` : ''}</div>
            </div>
            {a.verdict && <span className={`badge ${verdictClass(a.verdict)}`}><span className="dot" />{a.verdict}</span>}
          </div>
          {a.verdict_note && <p className="an-para" style={{ marginTop: 6 }}>{a.verdict_note}</p>}
          {a.snapshot && <p className="an-para">{a.snapshot}</p>}

          {m && (
            <div className="an-metrics">
              {metricCell('P/E', m.peTTM)}
              {metricCell('P/S', m.psTTM)}
              {metricCell('Gross %', m.grossMarginTTM)}
              {metricCell('Op %', m.operatingMarginTTM)}
              {metricCell('Rev YoY %', m.revenueGrowthYoY)}
              {metricCell('1Y %', m.return1Y)}
              {metricCell('ROE %', m.roeTTM)}
              {metricCell('D/E', m.debtToEquity)}
            </div>
          )}

          <Para title="Valuation" text={a.valuation} />
          <Para title="Growth" text={a.growth} />
          <Para title="Profitability" text={a.profitability} />
          <Para title="Balance sheet" text={a.balance_sheet} />
          <Para title="Moat" text={a.moat} />

          <div className="an-cases">
            <List title="Bull case" items={a.bull_case} tone="for" />
            <List title="Bear case" items={a.bear_case} tone="against" />
          </div>
          <List title="Risks" items={a.risks} tone="against" />
          <List title="What to watch" items={a.what_to_watch} />

          <div className="an-foot mono">
            {meta.cached ? 'cached' : 'fresh'}{meta.created_at ? ` · ${new Date(meta.created_at).toLocaleString()}` : ''} · not financial advice
          </div>
        </div>
      )}
    </div>
  );
}
