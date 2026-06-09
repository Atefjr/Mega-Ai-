import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';

export default function NotificationBell() {
  const [unread, setUnread] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const { unread: u } = await api.getNotifications();
        if (alive) setUnread(u || 0);
      } catch {
        /* non-critical */
      }
    };
    load();
    const t = setInterval(load, 60000);
    const onFocus = () => load();
    window.addEventListener('focus', onFocus);
    window.addEventListener('sma:notifications', load);
    return () => {
      alive = false;
      clearInterval(t);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('sma:notifications', load);
    };
  }, []);

  return (
    <button className="bell" onClick={() => navigate('/notifications')} title="Notifications" aria-label="Notifications">
      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.7 21a2 2 0 0 1-3.4 0" />
      </svg>
      {unread > 0 && <span className="bell-badge">{unread > 9 ? '9+' : unread}</span>}
    </button>
  );
}
