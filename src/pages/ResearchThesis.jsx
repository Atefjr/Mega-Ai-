import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import { fmtPct, signClass } from '../lib/format.js';
import { ErrorBanner, Empty } from '../components/States.jsx';
import InvestModal from '../components/InvestModal.jsx';
import ThesisModal from '../components/ThesisModal.jsx';
import HalalBadge from '../components/HalalBadge.jsx';

function PerfChip({ perf }) {
  if (!perf) return null;
  const oneY = perf.oneYear;
  return (
    <span className="perf-inline">
      <span className="perf-k">1Y</span>
      {oneY == null ? <span className="perf-v muted">—</span> : <span className={`perf-v mono ${signClass(oneY)}`}>{fmtPct(oneY)}</span>}
      <span className="perf-k" style={{ marginLeft: 8 }}>5Y</span>
      <span className="perf-v muted" title="5-year history needs a paid data tier (see Settings)">—</span>
    </span>
  );
}

function CandidateRow({ c, onInvest, onAnalyze, status, onCycle, perf }) {
  return (
    <div className="candidate">
      <div className="candidate-head">
        <span className="ticker-line">
          <HalalBadge status={status} onCycle={onCycle} size={17} />
          <span className="candidate-ticker mono">{c.ticker}</span>
          <PerfChip perf={perf} />
        </span>
        <span className="chip-row">
          <button className="btn btn-sm" onClick={() => onAnalyze(c.ticker)} title="Full analysis">Analyze</button>
          <button className="btn btn-sm btn-primary" onClick={() => onInvest(c.ticker)}>Invest</button>
        </span>
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
  const [perf, setPerf] = useState({});
  const [heldReturns, setHeldReturns] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [researching, setResearching] = useState(false);
  const [result, setResult] = useState(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalInitial, setModalInitial] = useState({});
  const [editOpen, setEditOpen] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const { theses: t } = await api.getTheses();
      setTheses(t || []);
      const th = (t || []).find((x) => x.id === id) || null;
      setThesis(th);
      if (th) {
        const suggestedSyms = (th.suggested_tickers || []).map((x) => x.ticker);
        const heldSyms = (th.trades || []).map((x) => x.ticker);
        await fetchMeta([...new Set([...heldSyms, ...suggestedSyms])]);
        loadPerf(suggestedSyms);
        loadHeldReturns(th);
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

  async function loadPerf(symbols) {
    const list = [...new Set((symbols || []).filter(Boolean))];
    if (!list.length) return;
    try {
      const { perf: p } = await api.getTickerPerf(list);
      setPerf((prev) => ({ ...prev, ...(p || {}) }));
    } catch {
      /* non-critical */
    }
  }

  async function loadHeldReturns(th) {
    try {
      const { trades } = await api.getTrades();
      const mine = (trades || []).filter((t) => t.thesis_id === th.id);
      if (!mine.length) return;
      const syms = [...new Set(mine.map((t) => t.ticker))];
      const { quotes } = await api.getQuotes(syms);
      const map = {};
      for (const t of mine) {
        const price = quotes[t.ticker]?.current ?? null;
        const avg = Number(t.avg_cost);
        map[t.ticker] = price && avg ? (price / avg - 1) * 100 : null;
      }
      setHeldReturns(map);
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
      const held = (thesis?.trades || []).map((t) => t.ticker);
      const r = await api.research({
        name: thesis?.name || '',
        description: thesis?.description || '',
        thesis_id: id,
        exclude: held,
      });
      setResult(r);
      const syms = (r?.candidates || []).map((c) => c.ticker);
      await fetchMeta(syms);
      loadPerf(syms);
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

  async function handleEdit(fields) {
    await api.updateThesis({ id, ...fields });
    setEditOpen(false);
    await load();
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

      <div className="detail-head" style={{ justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div className="detail-icon">{thesis.icon || '📈'}</div>
          <div>
            <div className="page-kicker">Thesis</div>
            <h1 className="page-title">{thesis.name}</h1>
          </div>
        </div>
        <button className="btn btn-sm" onClick={() => setEditOpen(true)}>✎ Edit</button>
      </div>

      <div className="card" style={{ padding: 20, marginBottom: 18 }}>
        <div className="thesis-desc">{thesis.description || 'No description yet.'}</div>
        {(thesis.cautious_criteria || thesis.break_criteria) && (
          <div className="criteria">
            {thesis.cautious_criteria && (
              <div className="criteria-item cautious">
                <div className="criteria-label">Turns cautious if</div>
                <div className="criteria-body">{thesis.cautious_criteria}</div>
              </div>
            )}
            {thesis.break_criteria && (
              <div className="criteria-item broken">
                <div className="criteria-label">Breaks if</div>
                <div className="criteria-body">{thesis.break_criteria}</div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="chips-block" style={{ marginBottom: 22 }}>
        <div className="chips-label">Live trades under this thesis</div>
        {live.length === 0 ? (
          <div className="news-empty">None held yet.</div>
        ) : (
          <div className="chips">
            {live.map((t) => {
              const r = heldReturns[t.ticker];
              return (
                <button key={t.id} className="chip" onClick={() => navigate(`/live?highlight=${encodeURIComponent(t.ticker)}`)}>
                  <HalalBadge status={meta[t.ticker]?.halal_status} size={13} />
                  {t.ticker}
                  {r != null && <span className={`perf-chip ${signClass(r)}`}>{fmtPct(r)}</span>}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 4 }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, margin: 0, letterSpacing: '-0.02em' }}>Candidates</h2>
        <button className="btn btn-primary" onClick={runResearch} disabled={researching}>
          {researching ? <span className="spinner" /> : '✦'} Research new stocks
        </button>
      </div>

      {suggested.length > 0 && (
        <div className="card research-result">
          <div className="chips-label" style={{ marginBottom: 6 }}>Suggested for this thesis</div>
          {suggested.map((s) => (
            <CandidateRow key={s.id} c={s} onInvest={invest} onAnalyze={(tk) => navigate(`/analyze?ticker=${tk}`)} status={meta[s.ticker]?.halal_status} onCycle={(next) => cycleHalal(s.ticker, next)} perf={perf[s.ticker]} />
          ))}
        </div>
      )}

      {result && (
        <div className="card research-result">
          {result.summary && <p className="thesis-desc" style={{ marginBottom: 10 }}>{result.summary}</p>}
          {(result.candidates || []).map((c, i) => (
            <CandidateRow key={i} c={c} onInvest={invest} onAnalyze={(tk) => navigate(`/analyze?ticker=${tk}`)} status={meta[c.ticker]?.halal_status} onCycle={(next) => cycleHalal(c.ticker, next)} perf={perf[c.ticker]} />
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

      <ThesisModal
        open={editOpen}
        mode="edit"
        initial={thesis}
        onClose={() => setEditOpen(false)}
        onSubmit={handleEdit}
      />
    </div>
  );
}
