import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import { fmtMoney, fmtSignedMoney, fmtPct, fmtPrice, fmtDate, signClass, positionStats } from '../lib/format.js';
import StatusBadge from '../components/StatusBadge.jsx';
import ConfidenceScore from '../components/ConfidenceScore.jsx';
import HalalBadge from '../components/HalalBadge.jsx';
import InvestModal from '../components/InvestModal.jsx';
import CloseTradeModal from '../components/CloseTradeModal.jsx';
import { ErrorBanner, Empty, Skeletons } from '../components/States.jsx';

export default function LiveTrades({ paper = false }) {
  const [trades, setTrades] = useState([]);
  const [theses, setTheses] = useState([]);
  const [quotes, setQuotes] = useState({});
  const [news, setNews] = useState({});
  const [meta, setMeta] = useState({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [closingId, setClosingId] = useState(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalInitial, setModalInitial] = useState({});
  const [evaluating, setEvaluating] = useState(false);
  const [evaluatingId, setEvaluatingId] = useState(null);
  const [closeOpen, setCloseOpen] = useState(false);
  const [closeTarget, setCloseTarget] = useState(null);

  const navigate = useNavigate();
  const [params] = useSearchParams();
  const highlight = (params.get('highlight') || '').toUpperCase();
  const cardRefs = useRef({});

  const loadPrices = useCallback(async (tickers) => {
    if (!tickers.length) return;
    const { quotes: q } = await api.getQuotes(tickers);
    setQuotes(q || {});
    try {
      const { meta: m } = await api.getTickerMeta(tickers);
      setMeta(m || {});
    } catch {
      /* halal meta is non-critical; ignore */
    }
    const newsEntries = await Promise.all(
      tickers.map(async (t) => {
        try {
          const { news: n } = await api.getNews(t, 3);
          return [t, n || []];
        } catch {
          return [t, []];
        }
      })
    );
    setNews(Object.fromEntries(newsEntries));
  }, []);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [{ trades: t }, { theses: th }] = await Promise.all([api.getTrades(!paper ? false : true), api.getTheses()]);
      setTrades(t || []);
      setTheses(th || []);
      const tickers = [...new Set((t || []).map((x) => x.ticker))];
      await loadPrices(tickers);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [loadPrices, paper]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (highlight && cardRefs.current[highlight]) {
      cardRefs.current[highlight].scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [highlight, trades]);

  async function refresh() {
    setRefreshing(true);
    try {
      const tickers = [...new Set(trades.map((x) => x.ticker))];
      await loadPrices(tickers);
    } catch (err) {
      setError(err);
    } finally {
      setRefreshing(false);
    }
  }

  function openNewPurchase(trade) {
    setModalInitial({ ticker: trade.ticker, thesis_id: trade.thesis_id || '' });
    setModalOpen(true);
  }

  async function cycleHalal(ticker, next) {
    const prev = meta[ticker];
    setMeta((m) => ({ ...m, [ticker]: { ...m[ticker], halal_status: next } })); // optimistic
    try {
      await api.setTickerMeta(ticker, next);
    } catch (err) {
      setMeta((m) => ({ ...m, [ticker]: prev })); // revert on failure
      setError(err);
    }
  }

  async function handleInvest(payload) {
    await api.createTrade({ ...payload, is_paper: paper });
    setModalOpen(false);
    setLoading(true);
    await load();
  }

  function mergeStatus(results) {
    if (!Array.isArray(results)) return;
    const now = new Date().toISOString();
    setTrades((ts) =>
      ts.map((t) => {
        const r = results.find((x) => x.id === t.id && !x.error);
        return r
          ? { ...t, status_label: r.label, status_rationale: r.rationale, status_updated_at: now }
          : t;
      })
    );
  }

  async function evaluateAll() {
    setEvaluating(true);
    setError(null);
    try {
      const { results } = await api.refreshStatus({});
      mergeStatus(results);
    } catch (err) {
      setError(err);
    } finally {
      setEvaluating(false);
    }
  }

  async function evaluateOne(trade) {
    setEvaluatingId(trade.id);
    setError(null);
    try {
      const { results } = await api.refreshStatus({ id: trade.id });
      mergeStatus(results);
      const r = (results || []).find((x) => x.id === trade.id);
      if (r && r.error) setError(new Error(r.error));
    } catch (err) {
      setError(err);
    } finally {
      setEvaluatingId(null);
    }
  }

  function handleClose(trade) {
    setCloseTarget(trade);
    setCloseOpen(true);
  }

  async function doClose(price) {
    if (!closeTarget) return;
    setClosingId(closeTarget.id);
    try {
      await api.closeTrade(closeTarget.id, price);
      setCloseOpen(false);
      navigate('/history');
    } catch (err) {
      setClosingId(null);
      throw err; // surfaced by the modal
    }
  }

  const [sortBy, setSortBy] = useState('default');

  const totalInvested = useMemo(
    () => trades.reduce((s, t) => s + Number(t.amount_invested || 0), 0),
    [trades]
  );

  const enriched = useMemo(
    () => trades.map((t) => {
      const price = quotes[t.ticker]?.current ?? null;
      const st = positionStats(t, price);
      return { trade: t, returnPct: st.returnPct, pnl: st.pnl };
    }),
    [trades, quotes]
  );

  const sortedTrades = useMemo(() => {
    const arr = [...enriched];
    const num = (v) => (v == null || Number.isNaN(v) ? -Infinity : v);
    switch (sortBy) {
      case 'return': arr.sort((a, b) => num(b.returnPct) - num(a.returnPct)); break;
      case 'pnl': arr.sort((a, b) => num(b.pnl) - num(a.pnl)); break;
      case 'conviction': arr.sort((a, b) => num(b.trade.status_conviction) - num(a.trade.status_conviction)); break;
      case 'ticker': arr.sort((a, b) => a.trade.ticker.localeCompare(b.trade.ticker)); break;
      case 'thesis': arr.sort((a, b) => (a.trade.thesis?.name || '').localeCompare(b.trade.thesis?.name || '')); break;
      default: break;
    }
    return arr;
  }, [enriched, sortBy]);

  const bestThesis = useMemo(() => {
    const byThesis = {};
    for (const e of enriched) {
      const name = e.trade.thesis?.name;
      if (!name || e.pnl == null) continue;
      const amt = Number(e.trade.amount_invested || 0);
      byThesis[name] = byThesis[name] || { name, icon: e.trade.thesis?.icon || '', invested: 0, pnl: 0 };
      byThesis[name].invested += amt;
      byThesis[name].pnl += e.pnl;
    }
    const arr = Object.values(byThesis)
      .filter((t) => t.invested > 0)
      .map((t) => ({ ...t, returnPct: (t.pnl / t.invested) * 100 }))
      .sort((a, b) => b.returnPct - a.returnPct);
    return arr[0] || null;
  }, [enriched]);

  return (
    <div>
      <div className="page-head" style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <div className="page-kicker">{paper ? 'Paper Portfolio' : 'Open Positions'}</div>
          <h1 className="page-title">{paper ? 'Paper Trades' : 'Live Trades'}</h1>
          {!loading && trades.length > 0 && (
            <p className="page-sub mono">{trades.length} position{trades.length !== 1 ? 's' : ''} · {fmtMoney(totalInvested)} {paper ? 'on paper' : 'invested'}</p>
          )}
          {!loading && bestThesis && (
            <p className="summary-line">
              Top thesis: <b>{bestThesis.icon} {bestThesis.name}</b>
              <span className={`perf-chip ${signClass(bestThesis.returnPct)}`}>{fmtPct(bestThesis.returnPct)}</span>
            </p>
          )}
        </div>
        {!loading && trades.length > 0 && (
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-primary" onClick={() => { setModalInitial({}); setModalOpen(true); }}>+ New trade</button>
            <button className="btn" onClick={evaluateAll} disabled={evaluating} title="Re-score every thesis with Claude">
              {evaluating ? <span className="spinner" style={{ borderTopColor: 'var(--accent)' }} /> : '✦'} Evaluate theses
            </button>
            <button className="btn" onClick={refresh} disabled={refreshing}>
              {refreshing ? <span className="spinner" style={{ borderTopColor: 'var(--accent)' }} /> : '↻'} Refresh prices
            </button>
          </div>
        )}
      </div>

      <ErrorBanner error={error} />

      {loading ? (
        <Skeletons count={3} className="grid grid-trades" />
      ) : trades.length === 0 ? (
        <Empty icon="◎" title={paper ? 'No paper positions' : 'No open positions'}>
          <p>{paper ? 'Paper-trade ideas to validate the app without committing real money. Add one directly, or open one from a research candidate.' : 'Open a position from a thesis on the Research page, or add one directly.'}</p>
          <button className="btn btn-primary" onClick={() => { setModalInitial({}); setModalOpen(true); }}>+ New position</button>
        </Empty>
      ) : (
        <>
          <div className="controls-row">
            <span style={{ fontSize: 12, color: 'var(--text-faint)' }}>Sort</span>
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
              <option value="default">Default</option>
              <option value="return">Return %</option>
              <option value="pnl">Live P&amp;L</option>
              <option value="conviction">Conviction</option>
              <option value="thesis">Thesis</option>
              <option value="ticker">Ticker</option>
            </select>
          </div>
          <div className="grid grid-trades">
          {sortedTrades.map(({ trade }, i) => {
            const q = quotes[trade.ticker] || {};
            const price = q.current ?? null;
            const stats = positionStats(trade, price);
            const isHi = highlight && trade.ticker === highlight;
            const tNews = news[trade.ticker] || [];
            return (
              <div
                key={trade.id}
                ref={(el) => { if (el) cardRefs.current[trade.ticker] = el; }}
                className={`card trade reveal${isHi ? ' highlight' : ''}`}
                style={{ animationDelay: `${i * 60}ms` }}
              >
                <div className="trade-top">
                  <div>
                    <div className="ticker-line">
                      <span className="ticker">{trade.ticker}</span>
                      <HalalBadge
                        status={meta[trade.ticker]?.halal_status}
                        onCycle={(next) => cycleHalal(trade.ticker, next)}
                      />
                    </div>
                    <div className="ticker-meta">
                      <span className="price mono">{price ? `$${fmtPrice(price)}` : 'No quote'}</span>
                      {q.changePct != null && (
                        <span className={`daychg mono ${signClass(q.changePct)}`}>
                          {fmtPct(q.changePct)} today
                        </span>
                      )}
                    </div>
                  </div>
                  <StatusBadge label={trade.status_label} />
                </div>

                <div className="metrics">
                  <div className="metric">
                    <div className="metric-label">Return since buy</div>
                    <div className={`metric-value mono ${signClass(stats.returnPct)}`}>{fmtPct(stats.returnPct)}</div>
                  </div>
                  <div className="metric">
                    <div className="metric-label">Live P&L</div>
                    <div className={`metric-value mono ${signClass(stats.pnl)}`}>{fmtSignedMoney(stats.pnl)}</div>
                  </div>
                </div>

                <div className="thesis-row">
                  <span className="t-name">
                    <span className="t-icon">{trade.thesis?.icon || '•'}</span>
                    {trade.thesis?.name || 'Unassigned'}
                  </span>
                </div>
                {trade.status_rationale && (
                  <div className="status-rationale">
                    {trade.status_rationale}
                    {trade.status_updated_at && <span className="status-asof"> · as of {fmtDate(trade.status_updated_at)}</span>}
                  </div>
                )}

                <ConfidenceScore conviction={trade.status_conviction} signals={trade.status_signals} />

                <div className="news">
                  <div className="news-head">Latest news</div>
                  {tNews.length === 0 ? (
                    <div className="news-empty">No recent headlines.</div>
                  ) : (
                    tNews.map((n, idx) => (
                      <a key={idx} className="news-item" href={n.url} target="_blank" rel="noreferrer">
                        {n.headline} {n.source && <span className="src">· {n.source}</span>}
                      </a>
                    ))
                  )}
                </div>

                <div className="amount">Amount invested: <b className="mono">{fmtMoney(trade.amount_invested)}</b></div>

                <div className="actions">
                  <button className="btn btn-sm" onClick={() => openNewPurchase(trade)}>+ Buy more</button>
                  <button className="btn btn-sm" onClick={() => navigate(`/analyze?ticker=${trade.ticker}`)} title="Full analysis">
                    Analyze
                  </button>
                  <button
                    className="btn btn-sm"
                    disabled={!trade.thesis_id}
                    title={trade.thesis_id ? 'Go to this thesis' : 'No thesis attached'}
                    onClick={() => trade.thesis_id && navigate(`/research/${trade.thesis_id}`)}
                  >
                    Research →
                  </button>
                  <button
                    className="btn btn-sm"
                    onClick={() => evaluateOne(trade)}
                    disabled={evaluatingId === trade.id}
                    title="Re-score this thesis with Claude"
                  >
                    {evaluatingId === trade.id ? <span className="spinner" style={{ borderTopColor: 'var(--accent)' }} /> : '✦ Re-check'}
                  </button>
                  <button className="btn btn-sm btn-danger" onClick={() => handleClose(trade)} disabled={closingId === trade.id}>
                    {closingId === trade.id ? <span className="spinner" style={{ borderTopColor: 'var(--red)' }} /> : 'Close trade'}
                  </button>
                </div>
              </div>
            );
          })}
          </div>
        </>
      )}

      <InvestModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={handleInvest}
        theses={theses}
        initial={modalInitial}
        title={modalInitial.ticker ? `Buy more — ${modalInitial.ticker}` : 'New position'}
      />

      <CloseTradeModal
        open={closeOpen}
        onClose={() => setCloseOpen(false)}
        onSubmit={doClose}
        trade={closeTarget}
        defaultPrice={closeTarget ? quotes[closeTarget.ticker]?.current : null}
      />
    </div>
  );
}
