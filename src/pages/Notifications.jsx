import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { fmtDate } from '../lib/format.js';
import { ErrorBanner, Empty } from '../components/States.jsx';

function dotColor(n) {
  if (n.type === 'status_change') {
    const to = n.meta?.to;
    if (to === 'Broken') return 'var(--red)';
    if (to === 'Cautious') return 'var(--amber)';
    return 'var(--green)';
  }
  return 'var(--accent)';
}

function ping() {
  window.dispatchEvent(new Event('sma:notifications'));
}

export default function Notifications() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  async function load() {
    try {
      const { notifications } = await api.getNotifications();
      setRows(notifications || []);
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function markAll() {
    try {
      await api.markAllNotificationsRead();
      setRows((rs) => rs.map((r) => ({ ...r, read: true })));
      ping();
    } catch (e) { setError(e); }
  }

  async function remove(id) {
    try {
      await api.deleteNotification(id);
      setRows((rs) => rs.filter((r) => r.id !== id));
      ping();
    } catch (e) { setError(e); }
  }

  async function clearAll() {
    if (!window.confirm('Clear all notifications?')) return;
    try {
      await api.clearNotifications();
      setRows([]);
      ping();
    } catch (e) { setError(e); }
  }

  async function open(n) {
    if (!n.read) {
      try { await api.markNotificationRead(n.id); } catch { /* non-critical */ }
      setRows((rs) => rs.map((r) => (r.id === n.id ? { ...r, read: true } : r)));
      ping();
    }
    if (n.thesis_id) navigate(`/research/${n.thesis_id}`);
    else if (n.ticker) navigate(`/analyze?ticker=${n.ticker}`);
  }

  const unread = rows.filter((r) => !r.read).length;

  return (
    <div>
      <div className="page-head" style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <div className="page-kicker">Alerts</div>
          <h1 className="page-title">Notifications</h1>
          <p className="page-sub">Thesis status changes and fresh stock ideas land here.</p>
        </div>
        {rows.length > 0 && (
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-sm" onClick={markAll} disabled={!unread}>Mark all read</button>
            <button className="btn btn-sm btn-ghost" onClick={clearAll}>Clear all</button>
          </div>
        )}
      </div>

      <ErrorBanner error={error} />

      {loading ? (
        <div className="empty"><span className="spinner" style={{ borderTopColor: 'var(--accent)', width: 22, height: 22 }} /></div>
      ) : rows.length === 0 ? (
        <Empty icon="🔔" title="No notifications yet">
          <p>When a thesis changes status or research turns up new ideas, you'll see it here.</p>
        </Empty>
      ) : (
        <div className="notif-list">
          {rows.map((n) => (
            <div key={n.id} className={`card notif ${n.read ? '' : 'unread'}`}>
              <span className="notif-dot" style={{ background: dotColor(n) }} />
              <div className="notif-body" onClick={() => open(n)} style={{ cursor: 'pointer' }}>
                <div className="notif-title">{n.title}</div>
                {n.body && <div className="notif-text">{n.body}</div>}
                <div className="notif-meta">{n.type === 'status_change' ? 'Status change' : 'New ideas'} · {fmtDate(n.created_at)}</div>
              </div>
              <button className="notif-x" onClick={() => remove(n.id)} title="Dismiss">×</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
