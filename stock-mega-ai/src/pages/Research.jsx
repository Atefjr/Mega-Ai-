import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { ErrorBanner, Empty, Skeletons } from '../components/States.jsx';
import HalalBadge from '../components/HalalBadge.jsx';
import ThesisModal from '../components/ThesisModal.jsx';

export default function Research() {
  const [theses, setTheses] = useState([]);
  const [meta, setMeta] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const navigate = useNavigate();

  const load = useCallback(async () => {
    setError(null);
    try {
      const { theses: t } = await api.getTheses();
      setTheses(t || []);
      const symbols = [
        ...new Set(
          (t || []).flatMap((th) => [
            ...(th.trades || []).map((x) => x.ticker),
            ...(th.suggested_tickers || []).map((x) => x.ticker),
          ])
        ),
      ];
      if (symbols.length) {
        try {
          const { meta: m } = await api.getTickerMeta(symbols);
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
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleCreate(payload) {
    await api.createThesis(payload);
    setModalOpen(false);
    setLoading(true);
    await load();
  }

  function goLive(ticker, e) {
    e.stopPropagation();
    navigate(`/live?highlight=${encodeURIComponent(ticker)}`);
  }

  return (
    <div>
      <div className="page-head" style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <div className="page-kicker">Theses</div>
          <h1 className="page-title">Research</h1>
          <p className="page-sub">Each thesis groups the tickers you hold and the ones AI suggests. Open one to research new fits.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setModalOpen(true)}>+ New thesis</button>
      </div>

      <ErrorBanner error={error} />

      {loading ? (
        <Skeletons count={3} className="grid grid-theses" />
      ) : theses.length === 0 ? (
        <Empty icon="✺" title="No theses yet">
          <p>Create your first investment thesis to start grouping tickers around an idea.</p>
          <button className="btn btn-primary" onClick={() => setModalOpen(true)}>+ New thesis</button>
        </Empty>
      ) : (
        <div className="grid grid-theses">
          {theses.map((th, i) => {
            const live = th.trades || [];
            const suggested = th.suggested_tickers || [];
            return (
              <div
                key={th.id}
                className="card thesis-card reveal"
                style={{ animationDelay: `${i * 60}ms` }}
                onClick={() => navigate(`/research/${th.id}`)}
              >
                <div className="thesis-icon">{th.icon || '📈'}</div>
                <div className="thesis-name">{th.name}</div>
                <div className="thesis-desc clamp">{th.description || 'No description yet.'}</div>

                <div className="chips-block">
                  <div className="chips-label">Live tickers</div>
                  {live.length === 0 ? (
                    <div className="news-empty">None held yet.</div>
                  ) : (
                    <div className="chips">
                      {live.map((t) => (
                        <button key={t.id} className="chip" onClick={(e) => goLive(t.ticker, e)} title="Open on Live Trades">
                          <HalalBadge status={meta[t.ticker]?.halal_status} size={13} />
                          {t.ticker}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="chips-block">
                  <div className="chips-label">Suggested</div>
                  {suggested.length === 0 ? (
                    <div className="news-empty">No suggestions yet.</div>
                  ) : (
                    <div className="chips">
                      {suggested.map((s) => (
                        <button
                          key={s.id}
                          className="chip suggested"
                          onClick={(e) => { e.stopPropagation(); navigate(`/research/${th.id}`); }}
                          title="Open thesis research"
                        >
                          <HalalBadge status={meta[s.ticker]?.halal_status} size={13} />
                          {s.ticker}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ThesisModal open={modalOpen} onClose={() => setModalOpen(false)} onSubmit={handleCreate} />
    </div>
  );
}
