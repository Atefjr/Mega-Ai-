import { useSettings } from '../lib/settings.js';

function bandColor(v) {
  if (v == null) return 'var(--text-faint)';
  if (v >= 67) return 'var(--green)';
  if (v >= 34) return 'var(--amber)';
  return 'var(--red)';
}

export default function ConfidenceScore({ conviction, signals, compact = false }) {
  const settings = useSettings();
  if (!settings.showConfidence) return null;
  const v = conviction;
  if (v == null && !signals) {
    return (
      <div className="conviction conviction-pending" title="Run Evaluate to score this thesis.">
        <span className="conviction-label">Conviction</span>
        <span className="conviction-pending-note">not scored yet — run Evaluate</span>
      </div>
    );
  }
  return (
    <div className="conviction" title="Model's read of how strongly current evidence supports the thesis. Not a probability of profit; not financial advice.">
      <div className="conviction-head">
        <span className="conviction-label">Conviction</span>
        <span className="conviction-num mono" style={{ color: bandColor(v) }}>{v != null ? v : '—'}</span>
      </div>
      <div className="conviction-bar"><span style={{ width: `${v || 0}%`, background: bandColor(v) }} /></div>
      {!compact && signals && (
        <div className="conviction-signals">
          {['execution', 'price', 'sentiment'].map((k) => (
            <div key={k} className="sig">
              <span className="sig-label">{k}</span>
              <div className="sig-bar"><span style={{ width: `${signals[k] || 0}%`, background: bandColor(signals[k]) }} /></div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
