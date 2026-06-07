import { useEffect, useState } from 'react';

const today = () => new Date().toISOString().slice(0, 10);

export default function InvestModal({ open, onClose, onSubmit, theses = [], initial = {}, title = 'New position' }) {
  const [ticker, setTicker] = useState('');
  const [amount, setAmount] = useState('');
  const [avgCost, setAvgCost] = useState('');
  const [purchasedAt, setPurchasedAt] = useState(today());
  const [thesisId, setThesisId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setTicker((initial.ticker || '').toUpperCase());
      setAmount(initial.amount_invested ? String(initial.amount_invested) : '');
      setAvgCost(initial.avg_cost ? String(initial.avg_cost) : '');
      setPurchasedAt(initial.purchased_at || today());
      setThesisId(initial.thesis_id || '');
      setError('');
      setSubmitting(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initial.ticker, initial.thesis_id]);

  if (!open) return null;

  const amountNum = Number(amount);
  const costNum = Number(avgCost);
  const shares = costNum > 0 ? amountNum / costNum : 0;
  const sharesValid = amountNum > 0 && costNum > 0;

  async function submit() {
    setError('');
    if (!ticker.trim()) return setError('Ticker is required.');
    if (!(amountNum > 0)) return setError('Amount invested must be greater than 0.');
    if (!(costNum > 0)) return setError('Cost per share must be greater than 0.');
    setSubmitting(true);
    try {
      await onSubmit({
        ticker: ticker.trim().toUpperCase(),
        amount_invested: amountNum,
        avg_cost: costNum,
        purchased_at: purchasedAt || today(),
        thesis_id: thesisId || null,
      });
    } catch (err) {
      setError(err.message || 'Something went wrong.');
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>{title}</h3>
        <p className="modal-sub">Enter the dollars invested and the price per share for this purchase. Buying more of a ticker you already hold is folded into one position with an averaged cost.</p>

        <div className="field">
          <label>Ticker</label>
          <input
            className="mono"
            value={ticker}
            onChange={(e) => setTicker(e.target.value.toUpperCase())}
            placeholder="NVDA"
            autoFocus
          />
        </div>

        <div className="field-row">
          <div className="field">
            <label>Amount invested ($)</label>
            <input className="mono" type="number" min="0" step="0.01" value={amount}
              onChange={(e) => setAmount(e.target.value)} placeholder="5000" />
          </div>
          <div className="field">
            <label>Cost per share ($)</label>
            <input className="mono" type="number" min="0" step="0.01" value={avgCost}
              onChange={(e) => setAvgCost(e.target.value)} placeholder="118.50" />
          </div>
        </div>

        {sharesValid && (
          <div className="derived">≈ <b>{shares.toLocaleString('en-US', { maximumFractionDigits: 4 })}</b> shares</div>
        )}

        <div className="field-row">
          <div className="field">
            <label>Date purchased</label>
            <input type="date" value={purchasedAt} onChange={(e) => setPurchasedAt(e.target.value)} />
          </div>
          <div className="field">
            <label>Thesis</label>
            <select value={thesisId} onChange={(e) => setThesisId(e.target.value)}>
              <option value="">— None —</option>
              {theses.map((t) => (
                <option key={t.id} value={t.id}>{t.icon ? `${t.icon} ` : ''}{t.name}</option>
              ))}
            </select>
          </div>
        </div>

        {error && <div className="form-error">{error}</div>}

        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={onClose} disabled={submitting}>Cancel</button>
          <button className="btn btn-primary" onClick={submit} disabled={submitting}>
            {submitting ? <span className="spinner" /> : 'Create position'}
          </button>
        </div>
      </div>
    </div>
  );
}
