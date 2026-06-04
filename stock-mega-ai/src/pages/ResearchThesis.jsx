import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import { ErrorBanner, Empty } from '../components/States.jsx';
import InvestModal from '../components/InvestModal.jsx';
import HalalBadge from '../components/HalalBadge.jsx';

function CandidateRow({ c, onInvest, status, onCycle }) {
  return (
    <div className="candidate">
      <div className="candidate-head">
        <span className="ticker-line">
          <HalalBadge status={status} onCycle={onCycle} size={17} />
          <span className="candidate-ticker mono">{c.ticker}</span>
        </span>
        <button className="btn btn-sm btn-primary" onClick={() => onInvest(c.ticker)}>Invest</button>
      </div>
      <div className="pro-con">
        <div className="pc for">
          <div className="pc-label">Case for</div>
          <div className="pc-body">{c.reasons_for || '—'}</div>
        </div>
        <div className="pc against">
          <div className="pc-label">Case against</div>
          <div className="pc-body">{c.reasons_against || '—'}</div>
        </div>
      </div>
    </div>
  );
}

export default function ResearchThesis() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [thesis, setThesis] = useState(null);
  const [theses, setTheses] = useState([]);
  const [meta, setMeta] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [researching, setResearching] = useState(false);
  const [result, setResult] = useState(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalInitial, setModalInitial] = useState({});

  const load = useCallback(async () => {
    setError(null);
    try {
      const { theses: t } = await api.getTheses();
      setTheses(t || []);
      const th = (t || []).find((x) => x.id === id) || null;
      setThesis(th);
      if (th) {
        const symbols = [
          ...new Set([
            ...(th.trades || []).map((x) => x.ticker),
            ...(th.suggested_tickers || []).map((x) => x.ticker),
          ]),
        ];
        await fetchMeta(symbols);
      }
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  async function fetchMeta(symbols) {
    const list = (symbols || []).filter(Boolean);
    if (!list.length) return;
    try {
      const { meta: m } = await api.getTickerMeta(list);
      setMeta((prev) => ({ ...prev, ...(m || {}) }));
    } catch {
      /* non-critical */
    }
  }

  async function cycleHalal(ticker, next) {
    const prev = meta[ticker];
    setMeta((m) => ({ ...m, [ticker]: { ...m[ticker], halal_status: next } }));
    try {
      await api.setTickerMeta(ticker, next);
    } catch (err) {
      setMeta((m) => ({ ...m, [ticker]: prev }));
      setError(err);
    }
  }

  async function runResearch() {
    setResearching(true);
    setError(null);
    try {
      const r = await api.research(thesis?.name || '');
      setResult(r);
      await fetchMeta((r?.candidates || []).map((c) => c.ticker));
    } catch (err) {
      setError(err);
    } finally {
      setResearching(false);
    }
  }

  function invest(ticker) {
    setModalInitial({ ticker, thesis_id: id });
    setModalOpen(true);
  }

  async function handleInvest(payload) {
    await api.createTrade(payload);
    setModalOpen(false);
    navigate(`/live?highlight=${encodeURIComponent(payload.ticker)}`);
  }

  if (loading) {
    return <div className="empty"><span className="spinner" style={{ borderTopColor: 'var(--accent)', width: 22, height: 22 }} /></div>;
  }
  if (!thesis) {
    return (
      <Empty icon="?" title="Thesis not found">
        <p>This thesis may have been removed.</p>
        <button className="btn btn-primary" onClick={() => navigate('/research')}>← Back to Research</button>
      </Empty>
    );
  }

  const live = thesis.trades || [];
  const suggested = thesis.suggested_tickers || [];

  return (
    <div>
      <button className="btn btn-ghost btn-sm" onClick={() => navigate('/research')} style={{ marginBottom: 20 }}>← All theses</button>

      <ErrorBanner error={error} />

      <div className="detail-head">
        <div className="detail-icon">{thesis.icon || '📈'}</div>
        <div>
          <div className="page-kicker">Thesis</div>
          <h1 className="page-title">{thesis.name}</h1>
        </div>
      </div>

      <div className="card" style={{ padding: 20, marginBottom: 18 }}>
        <div className="thesis-desc">{thesis.description || 'No description yet.'}</div>
      </div>

      <div className="chips-block" style={{ marginBottom: 22 }}>
        <div className="chips-label">Live trades under this thesis</div>
        {live.length === 0 ? (
          <div className="news-empty">None held yet.</div>
        ) : (
          <div className="chips">
            {live.map((t) => (
              <button key={t.id} className="chip" onClick={() => navigate(`/live?highlight=${encodeURIComponent(t.ticker)}`)}>
                <HalalBadge status={meta[t.ticker]?.halal_status} size={13} />
                {t.ticker}
              </button>
            ))}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 4 }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, margin: 0, letterSpacing: '-0.02em' }}>Candidates</h2>
        <button className="btn btn-primary" onClick={runResearch} disabled={researching}>
          {researching ? <span className="spinner" /> : '✦'} Research new stocks
        </button>
      </div>

      {/* Seeded / existing suggestions */}
      {suggested.length > 0 && (
        <div className="card research-result">
          <div className="chips-label" style={{ marginBottom: 6 }}>Suggested for this thesis</div>
          {suggested.map((s) => (
            <CandidateRow key={s.id} c={s} onInvest={invest} status={meta[s.ticker]?.halal_status} onCycle={(next) => cycleHalal(s.ticker, next)} />
          ))}
        </div>
      )}

      {/* Fresh AI research output */}
      {result && (
        <div className="card research-result">
          {result.stub && <div className="stub-note">⚙ Placeholder output — Claude-generated research is wired in Slice 2.</div>}
          {result.summary && <p className="thesis-desc" style={{ marginBottom: 10 }}>{result.summary}</p>}
          {(result.candidates || []).map((c, i) => (
            <CandidateRow key={i} c={c} onInvest={invest} status={meta[c.ticker]?.halal_status} onCycle={(next) => cycleHalal(c.ticker, next)} />
          ))}
        </div>
      )}

      {!result && suggested.length === 0 && (
        <div className="news-empty" style={{ padding: '14px 0' }}>
          No candidates yet — run research to surface tickers that fit this thesis.
        </div>
      )}

      <InvestModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={handleInvest}
        theses={theses}
        initial={modalInitial}
        title={modalInitial.ticker ? `Invest — ${modalInitial.ticker}` : 'New position'}
      />
    </div>
  );
}
