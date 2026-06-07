import { useEffect, useState } from 'react';
import { fmtSignedMoney, fmtPct, signClass, positionStats } from '../lib/format.js';

export default function CloseTradeModal({ open, onClose, onSubmit, trade, defaultPrice }) {
  const [price, setPrice] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setPrice(defaultPrice > 0 ? String(defaultPrice) : '');
      setError('');
      setSubmitting(false);
    }
  }, [open, defaultPrice]);

  if (!open || !trade) return null;

  const p = Number(price);
  const preview = p > 0 ? positionStats(trade, p) : null;

  async function submit() {
    setError('');
    if (!(p > 0)) return setError('Enter a close price greater than 0.');
    setSubmitting(true);
    try {
      await onSubmit(p);
    } catch (err) {
      setError(err.message || 'Something went wrong.');
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>Close {trade.ticker}</h3>
        <p className="modal-sub">Enter the price to close at. It defaults to the live price when one is available — edit it for delisted or untradable tickers.</p>

        <div className="field">
          <label>Close price ($/share)</label>
          <input className="mono" type="number" min="0" step="0.01" value={price}
            onChange={(e) => setPrice(e.target.value)} autoFocus placeholder="0.00" />
          {!(defaultPrice > 0) && <div className="hint">No live price available for this ticker — enter one manually.</div>}
        </div>

        {preview && (
          <div className="derived">
            Realized P&L <span className={`mono ${signClass(preview.pnl)}`} style={{ fontWeight: 700 }}>{fmtSignedMoney(preview.pnl)}</span>
            {' · '}
            <span className={`mono ${signClass(preview.returnPct)}`}>{fmtPct(preview.returnPct)}</span>
          </div>
        )}

        {error && <div className="form-error">{error}</div>}

        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={onClose} disabled={submitting}>Cancel</button>
          <button className="btn btn-danger" onClick={submit} disabled={submitting}>
            {submitting ? <span className="spinner" style={{ borderTopColor: 'var(--red)' }} /> : 'Close trade'}
          </button>
        </div>
      </div>
    </div>
  );
}
