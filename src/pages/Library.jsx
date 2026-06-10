import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { THESIS_LIBRARY } from '../lib/thesisLibrary.js';
import { ErrorBanner } from '../components/States.jsx';

function LibraryItem({ item, owned, onAdd, adding }) {
  const [openDetail, setOpenDetail] = useState(false);
  return (
    <div className="card lib-item">
      <div className="lib-head" onClick={() => setOpenDetail((v) => !v)}>
        <span className="lib-icon">{item.icon}</span>
        <div className="lib-titlebox">
          <div className="lib-name">{item.name}</div>
          {!openDetail && <div className="lib-teaser">{item.description}</div>}
        </div>
        {owned ? (
          <span className="lib-added">✓ Added</span>
        ) : (
          <button
            className="btn btn-sm btn-primary"
            disabled={adding}
            onClick={(e) => { e.stopPropagation(); onAdd(item); }}
          >
            {adding ? <span className="spinner" /> : '+ Add'}
          </button>
        )}
      </div>
      {openDetail && (
        <div className="lib-detail">
          <p className="lib-para">{item.description}</p>
          <div className="criteria">
            <div className="criteria-item cautious">
              <div className="criteria-label">Turns cautious if</div>
              <div className="criteria-body">{item.cautious_criteria}</div>
            </div>
            <div className="criteria-item broken">
              <div className="criteria-label">Breaks if</div>
              <div className="criteria-body">{item.break_criteria}</div>
            </div>
          </div>
          {item.example_ticker && (
            <div className="lib-example mono">Example: {item.example_ticker}</div>
          )}
        </div>
      )}
    </div>
  );
}

export default function Library() {
  const navigate = useNavigate();
  const [ownedNames, setOwnedNames] = useState(new Set());
  const [addingName, setAddingName] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { theses } = await api.getTheses();
        setOwnedNames(new Set((theses || []).map((t) => (t.name || '').toLowerCase())));
      } catch (e) {
        setError(e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function add(item) {
    setAddingName(item.name);
    setError(null);
    try {
      await api.createThesis({
        name: item.name,
        icon: item.icon,
        description: item.description,
        cautious_criteria: item.cautious_criteria,
        break_criteria: item.break_criteria,
        example_ticker: item.example_ticker || '',
      });
      setOwnedNames((s) => new Set([...s, item.name.toLowerCase()]));
    } catch (e) {
      setError(e);
    } finally {
      setAddingName(null);
    }
  }

  const total = useMemo(() => THESIS_LIBRARY.reduce((s, g) => s + g.items.length, 0), []);

  return (
    <div>
      <button className="btn btn-ghost btn-sm" onClick={() => navigate('/research')} style={{ marginBottom: 20 }}>← Research</button>
      <div className="page-head">
        <div className="page-kicker">Starter ideas</div>
        <h1 className="page-title">Thesis Library</h1>
        <p className="page-sub">
          {total} ready-made theses — investing angles you can add to your own list with one tap, then edit to make yours.
          Deleted one? Re-add it here anytime. Example tickers illustrate the idea, not recommendations.
        </p>
      </div>

      <ErrorBanner error={error} />

      {loading ? (
        <div className="empty"><span className="spinner" style={{ borderTopColor: 'var(--accent)', width: 22, height: 22 }} /></div>
      ) : (
        THESIS_LIBRARY.map((group) => (
          <div key={group.category} className="lib-group">
            <h2 className="lib-cat">{group.category}</h2>
            {group.items.map((item) => (
              <LibraryItem
                key={item.name}
                item={item}
                owned={ownedNames.has(item.name.toLowerCase())}
                adding={addingName === item.name}
                onAdd={add}
              />
            ))}
          </div>
        ))
      )}
    </div>
  );
}
