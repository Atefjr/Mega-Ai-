import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import { fmtMoney, fmtSignedMoney, fmtPct, fmtPrice, signClass, positionStats } from '../lib/format.js';
import StatusBadge from '../components/StatusBadge.jsx';
import HalalBadge from '../components/HalalBadge.jsx';
import InvestModal from '../components/InvestModal.jsx';
import { ErrorBanner, Empty, Skeletons } from '../components/States.jsx';

export default function LiveTrades() {
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
      const [{ trades: t }, { theses: th }] = await Promise.all([api.getTrades(), api.getTheses()]);
      setTrades(t || []);
      setTheses(th || []);
      const tickers = [...new Set((t || []).map((x) => x.ticker))];
      await loadPrices(tickers);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [loadPrices]);

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
    await api.createTrade(payload);
    setModalOpen(false);
    setLoading(true);
    await load();
  }

  async function handleClose(trade) {
    const ok = window.confirm(`Close ${trade.ticker} at the current live price and move it to History?`);
    if (!ok) return;
    setClosingId(trade.id);
    try {
      await api.closeTrade(trade.id);
      navigate('/history');
    } catch (err) {
      setError(err);
      setClosingId(null);
    }
  }

  const totalInvested = useMemo(
    () => trades.reduce((s, t) => s + Number(t.amount_invested || 0), 0),
    [trades]
  );

  return (
    <div>
      <div className="page-head" style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <div className="page-kicker">Open Positions</div>
          <h1 className="page-title">Live Trades</h1>
          {!loading && trades.length > 0 && (
            <p className="page-sub mono">{trades.length} position{trades.length !== 1 ? 's' : ''} · {fmtMoney(totalInvested)} invested</p>
          )}
        </div>
        {!loading && trades.length > 0 && (
          <button className="btn" onClick={refresh} disabled={refreshing}>
            {refreshing ? <span className="spinner" style={{ borderTopColor: 'var(--accent)' }} /> : '↻'} Refresh prices
          </button>
        )}
      </div>

      <ErrorBanner error={error} />

      {loading ? (
        <Skeletons count={3} className="grid grid-trades" />
      ) : trades.length === 0 ? (
        <Empty icon="◎" title="No open positions">
          <p>Open a position from a thesis on the Research page, or add one directly.</p>
          <button className="btn btn-primary" onClick={() => { setModalInitial({}); setModalOpen(true); }}>+ New position</button>
        </Empty>
      ) : (
        <div className="grid grid-trades">
          {trades.map((trade, i) => {
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
                  <button
                    className="btn btn-sm"
                    disabled={!trade.thesis_id}
                    title={trade.thesis_id ? 'Go to this thesis' : 'No thesis attached'}
                    onClick={() => trade.thesis_id && navigate(`/research/${trade.thesis_id}`)}
                  >
                    Research →
                  </button>
                  <button className="btn btn-sm btn-danger" onClick={() => handleClose(trade)} disabled={closingId === trade.id}>
                    {closingId === trade.id ? <span className="spinner" style={{ borderTopColor: 'var(--red)' }} /> : 'Close trade'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <InvestModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={handleInvest}
        theses={theses}
        initial={modalInitial}
        title={modalInitial.ticker ? `Buy more — ${modalInitial.ticker}` : 'New position'}
      />
    </div>
  );
}
