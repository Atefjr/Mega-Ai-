import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api.js';
import { fmtMoney, fmtSignedMoney, fmtPct, fmtDate, signClass } from '../lib/format.js';
import { ErrorBanner, Empty } from '../components/States.jsx';
import HalalBadge from '../components/HalalBadge.jsx';

export default function History() {
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const { history } = await api.getHistory();
        setRows(history || []);
        const tickers = [...new Set((history || []).map((r) => r.ticker))];
        if (tickers.length) {
          try {
            const { meta: m } = await api.getTickerMeta(tickers);
            setMeta(m || {});
          } catch {
            /* non-critical */
          }
        }
      } catch (err) {
        setError(err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const summary = useMemo(() => {
    const invested = rows.reduce((s, r) => s + Number(r.amount_invested || 0), 0);
    const pnl = rows.reduce((s, r) => s + Number(r.pnl || 0), 0);
    const returned = invested + pnl;
    const returnPct = invested > 0 ? (pnl / invested) * 100 : null;
    return { invested, returned, pnl, returnPct };
  }, [rows]);

  return (
    <div>
      <div className="page-head">
        <div className="page-kicker">Closed Trades</div>
        <h1 className="page-title">History</h1>
        <p className="page-sub">Every position you've closed, with its realized performance and how long you held it.</p>
      </div>

      <ErrorBanner error={error} />

      {!loading && rows.length > 0 && (
        <div className="summary-grid reveal">
          <div className="summary-cell">
            <div className="metric-label">Total invested</div>
            <div className="summary-value mono">{fmtMoney(summary.invested)}</div>
          </div>
          <div className="summary-cell">
            <div className="metric-label">Total returned</div>
            <div className="summary-value mono">{fmtMoney(summary.returned)}</div>
          </div>
          <div className="summary-cell">
            <div className="metric-label">Net P&amp;L</div>
            <div className={`summary-value mono ${signClass(summary.pnl)}`}>
              {fmtSignedMoney(summary.pnl)}
              {summary.returnPct != null && <span className="summary-pct"> · {fmtPct(summary.returnPct)}</span>}
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="empty"><span className="spinner" style={{ borderTopColor: 'var(--accent)', width: 22, height: 22 }} /></div>
      ) : rows.length === 0 ? (
        <Empty icon="⌁" title="No closed trades yet">
          <p>When you close a position on the Live Trades page, it lands here with its final P&L.</p>
        </Empty>
      ) : (
        <div className="card table-wrap reveal">
          <table className="history">
            <thead>
              <tr>
                <th>Ticker</th>
                <th>Performance</th>
                <th>Timeline</th>
                <th>Thesis</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>
                    <div className="ticker-line">
                      <span className="h-ticker">{r.ticker}</span>
                      <HalalBadge status={meta[r.ticker]?.halal_status} size={16} />
                    </div>
                    <div className="amount mono" style={{ marginTop: 2 }}>{fmtMoney(r.amount_invested)} in</div>
                  </td>
                  <td>
                    <div className={`mono ${signClass(r.performance_pct)}`} style={{ fontWeight: 700, fontSize: 15 }}>
                      {fmtPct(r.performance_pct)}
                    </div>
                    <div className={`amount mono ${signClass(r.pnl)}`} style={{ marginTop: 2 }}>{fmtSignedMoney(r.pnl)}</div>
                  </td>
                  <td>
                    <div className="timeline">
                      {fmtDate(r.purchased_at)} <span className="arrow">→</span> {fmtDate(r.closed_at)}
                    </div>
                  </td>
                  <td>
                    <div style={{ fontSize: 14 }}>{r.thesis_name || '—'}</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
