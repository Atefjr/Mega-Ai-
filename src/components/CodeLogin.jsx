import { useState } from 'react';
import { api } from '../lib/api.js';
import { setWorkspace } from '../lib/session.js';
import Logo from './Logo.jsx';
import { APP_NAME } from '../lib/settings.js';

export default function CodeLogin() {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function submit() {
    const c = code.trim();
    if (!c) return;
    setBusy(true);
    setErr('');
    try {
      const r = await api.checkWorkspace(c);
      setWorkspace({ code: r.code, label: r.label || '' });
    } catch (e) {
      setErr(e.status === 401 ? "That code wasn't recognized. Check it and try again." : e.message || 'Something went wrong.');
      setBusy(false);
    }
  }

  return (
    <div className="gate">
      <div className="gate-card card">
        <div className="gate-brand">
          <Logo size={40} />
          <span className="brand-name" style={{ fontSize: 24 }}>{APP_NAME}</span>
        </div>
        <h1 className="gate-title">Enter your access code</h1>
        <p className="gate-sub">This is a private testing build. Use the code you were given — your theses, trades, and history are kept separate from everyone else's.</p>
        <input
          className="gate-input mono"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
          placeholder="access code"
          autoFocus
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
        />
        {err && <div className="form-error">{err}</div>}
        <button className="btn btn-primary gate-btn" onClick={submit} disabled={busy}>
          {busy ? <span className="spinner" /> : 'Enter'}
        </button>
      </div>
    </div>
  );
}
