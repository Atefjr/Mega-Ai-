import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api.js';
import { fmtMoney, fmtSignedMoney, fmtPct, fmtDate, signClass } from '../lib/format.js';
import { ErrorBanner, Empty } from '../components/States.jsx';
import HalalBadge from '../components/HalalBadge.jsx';

function EditModal({ row, onClose, onSave }) {
  const [f, setF] = useState(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (row) {
      setF({
        ticker: row.ticker || '',
        thesis_name: row.thesis_name || '',
        amount_invested: row.amount_invested ?? '',
        avg_cost: row.avg_cost ?? '',
        exit_price: row.exit_price ?? '',
        purchased_at: (row.purchased_at || '').slice(0, 10),
        closed_at: (row.closed_at || '').slice(0, 10),
      });
      setErr('');
      setSaving(false);
    }
  }, [row]);

  if (!row || !f) return null;
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));

  async function save() {
    setErr('');
    setSaving(true);
    try {
      await onSave({
        id: row.id,
        ticker: f.ticker,
        thesis_name: f.thesis_name,
        amount_invested: Number(f.amount_invested),
        avg_cost: Number(f.avg_cost),
        exit_price: Number(f.exit_price),
        purchased_at: f.purchased_at || null,
        closed_at: f.closed_at || null,
      });
    } catch (e) {
      setErr(e.message || 'Failed to save.');
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>Edit closed trade</h3>
        <p className="modal-sub">Adjust the numbers — P&amp;L and performance recompute automatically.</p>
        <div className="field-row">
          <div className="field"><label>Ticker</label><input className="mono" value={f.ticker} onChange={(e) => set('ticker', e.target.value.toUpperCase())} /></div>
          <div className="field"><label>Thesis</label><input value={f.thesis_name} onChange={(e) => set('thesis_name', e.target.value)} /></div>
        </div>
        <div className="field-row">
          <div className="field"><label>Amount invested ($)</label><input type="number" value={f.amount_invested} onChange={(e) => set('amount_invested', e.target.value)} /></div>
          <div className="field"><label>Avg cost / share ($)</label><input type="number" value={f.avg_cost} onChange={(e) => set('avg_cost', e.target.value)} /></div>
        </div>
        <div className="field-row">
          <div className="field"><label>Exit price ($)</label><input type="number" value={f.exit_price} onChange={(e) => set('exit_price', e.target.value)} /></div>
          <div className="field"><label>Purchased</label><input type="date" value={f.purchased_at} onChange={(e) => set('purchased_at', e.target.value)} /></div>
        </div>
        <div className="field"><label>Closed</label><input type="date" value={f.closed_at} onChange={(e) => set('closed_at', e.target.value)} /></div>
        {err && <div className="form-error">{err}</div>}
        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? <span className="spinner" /> : 'Save changes'}</button>
        </div>
      </div>
    </div>
  );
}

export default function History() {
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editRow, setEditRow] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [filter, setFilter] = useState('all');

  const filtered = useMemo(() => {
    if (filter === 'all') return rows;
    return rows.filter((r) => (filter === 'paper' ? r.is_paper : !r.is_paper));
  }, [rows, filter]);

  async function loadMeta(history) {
    const tickers = [...new Set((history || []).map((r) => r.ticker))];
    if (!tickers.length) return;
    try {
      const { meta: m } = await api.getTickerMeta(tickers);
      setMeta(m || {});
    } catch {
      /* non-critical */
    }
  }

  useEffect(() => {
    (async () => {
      try {
        const { history } = await api.getHistory();
        setRows(history || []);
        await loadMeta(history);
      } catch (err) {
        setError(err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const summary = useMemo(() => {
    const invested = filtered.reduce((s, r) => s + Number(r.amount_invested || 0), 0);
    const pnl = filtered.reduce((s, r) => s + Number(r.pnl || 0), 0);
    const returned = invested + pnl;
    const returnPct = invested > 0 ? (pnl / invested) * 100 : null;
    return { invested, returned, pnl, returnPct };
  }, [filtered]);

  const thesisRank = useMemo(() => {
    const by = {};
    for (const r of filtered) {
      const name = r.thesis_name || 'Unassigned';
      by[name] = by[name] || { name, invested: 0, pnl: 0, count: 0 };
      by[name].invested += Number(r.amount_invested || 0);
      by[name].pnl += Number(r.pnl || 0);
      by[name].count += 1;
    }
    return Object.values(by)
      .filter((t) => t.invested > 0)
      .map((t) => ({ ...t, returnPct: (t.pnl / t.invested) * 100 }))
      .sort((a, b) => b.returnPct - a.returnPct);
  }, [filtered]);

  const bestThesis = thesisRank[0] || null;

  async function handleSave(payload) {
    const { history } = await api.updateHistory(payload);
    setRows((rs) => rs.map((x) => (x.id === history.id ? history : x)));
    setEditRow(null);
  }

  async function handleDelete(r) {
    if (!window.confirm(`Delete the closed ${r.ticker} trade? This can't be undone.`)) return;
    setDeletingId(r.id);
    try {
      await api.deleteHistory(r.id);
      setRows((rs) => rs.filter((x) => x.id !== r.id));
    } catch (e) {
      setError(e);
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div>
      <div className="page-head" style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <div className="page-kicker">Closed Trades</div>
          <h1 className="page-title">History</h1>
          <p className="page-sub">Every position you've closed, with its realized performance and how long you held it.</p>
        </div>
        {!loading && rows.length > 0 && (
          <div className="seg">
            <button className={filter === 'all' ? 'on' : ''} onClick={() => setFilter('all')}>All</button>
            <button className={filter === 'live' ? 'on' : ''} onClick={() => setFilter('live')}>Live</button>
            <button className={filter === 'paper' ? 'on' : ''} onClick={() => setFilter('paper')}>Paper</button>
          </div>
        )}
      </div>

      <ErrorBanner error={error} />

      {!loading && filtered.length > 0 && (
        <>
          <div className={`summary-grid reveal ${bestThesis ? 'cols-4' : ''}`}>
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
            {bestThesis && (
              <div className="summary-cell">
                <div className="metric-label">Best thesis</div>
                <div className="summary-value" style={{ fontSize: 16 }}>
                  {bestThesis.name}
                  <span className={`summary-pct mono ${signClass(bestThesis.returnPct)}`}> · {fmtPct(bestThesis.returnPct)}</span>
                </div>
              </div>
            )}
          </div>

          {thesisRank.length > 1 && (
            <div className="thesis-rank">
              {thesisRank.map((t, i) => (
                <span className="rank-item" key={t.name}>
                  <span className="rank-pos">#{i + 1}</span>
                  {t.name}
                  <span className={`mono ${signClass(t.returnPct)}`}>{fmtPct(t.returnPct)}</span>
                </span>
              ))}
            </div>
          )}
        </>
      )}

      {loading ? (
        <div className="empty"><span className="spinner" style={{ borderTopColor: 'var(--accent)', width: 22, height: 22 }} /></div>
      ) : rows.length === 0 ? (
        <Empty icon="⌁" title="No closed trades yet">
          <p>When you close a position on the Live or Paper page, it lands here with its final P&L.</p>
        </Empty>
      ) : filtered.length === 0 ? (
        <div className="news-empty" style={{ padding: '18px 0' }}>No {filter} trades closed yet.</div>
      ) : (
        <div className="card table-wrap reveal">
          <table className="history">
            <thead>
              <tr>
                <th>Ticker</th>
                <th>Performance</th>
                <th>Timeline</th>
                <th>Thesis</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id}>
                  <td>
                    <div className="ticker-line">
                      <span className="h-ticker">{r.ticker}</span>
                      <HalalBadge status={meta[r.ticker]?.halal_status} size={16} />
                      {r.is_paper && <span className="paper-tag">paper</span>}
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
                  <td>
                    <div className="row-actions">
                      <button className="btn btn-sm" onClick={() => setEditRow(r)} title="Edit">✎</button>
                      <button className="btn btn-sm btn-danger" onClick={() => handleDelete(r)} disabled={deletingId === r.id} title="Delete">
                        {deletingId === r.id ? <span className="spinner" style={{ borderTopColor: 'var(--red)' }} /> : '🗑'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <EditModal row={editRow} onClose={() => setEditRow(null)} onSave={handleSave} />
    </div>
  );
}
