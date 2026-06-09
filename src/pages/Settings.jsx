import { useState } from 'react';
import { APP_VERSION, useSettings, setSetting } from '../lib/settings.js';
import { api } from '../lib/api.js';

function Toggle({ on, onClick }) {
  return (
    <button className={`toggle ${on ? 'on' : ''}`} onClick={onClick} aria-pressed={on} aria-label="toggle">
      <span className="knob" />
    </button>
  );
}

export default function Settings() {
  const settings = useSettings();
  const [debugOut, setDebugOut] = useState(null);
  const [testing, setTesting] = useState(false);

  async function runTest() {
    setTesting(true);
    const out = {};
    const checks = [
      ['trades', () => api.getTrades()],
      ['theses', () => api.getTheses()],
      ['history', () => api.getHistory()],
    ];
    for (const [name, fn] of checks) {
      try {
        const r = await fn();
        const firstArr = Object.values(r).find((v) => Array.isArray(v));
        out[name] = `ok (${firstArr ? firstArr.length : '?'} rows)`;
      } catch (e) {
        out[name] = `error: ${e.message}`;
      }
    }
    setDebugOut(out);
    setTesting(false);
  }

  return (
    <div>
      <div className="page-head">
        <div className="page-kicker">Preferences</div>
        <h1 className="page-title">Settings</h1>
      </div>

      <div className="card settings-section">
        <h2>Appearance</h2>
        <p className="sec-sub">How the dashboard looks.</p>
        <div className="setting-row">
          <div>
            <div className="s-label">Theme</div>
            <div className="s-desc">Dark is the default command-deck look.</div>
          </div>
          <div className="seg">
            <button className={settings.theme === 'dark' ? 'on' : ''} onClick={() => setSetting('theme', 'dark')}>Dark</button>
            <button className={settings.theme === 'light' ? 'on' : ''} onClick={() => setSetting('theme', 'light')}>Light</button>
          </div>
        </div>
      </div>

      <div className="card settings-section">
        <h2>Display</h2>
        <p className="sec-sub">What shows on your positions.</p>
        <div className="setting-row">
          <div>
            <div className="s-label">Show conviction score</div>
            <div className="s-desc">The 0–100 thesis conviction bar on each position. A model judgment, not a probability of profit.</div>
          </div>
          <Toggle on={settings.showConfidence} onClick={() => setSetting('showConfidence', !settings.showConfidence)} />
        </div>
      </div>

      <div className="card settings-section">
        <h2>Data &amp; automation</h2>
        <p className="sec-sub">Where numbers come from and when they refresh.</p>
        <div className="setting-row">
          <div>
            <div className="s-label">5-year performance</div>
            <div className="s-desc">Research shows 1-year return on the free data tier. 5-year history needs a paid market-data plan; add it later and it lights up automatically.</div>
          </div>
          <span className="badge-soon">data upgrade</span>
        </div>
        <div className="setting-row">
          <div>
            <div className="s-label">Daily refresh (cron)</div>
            <div className="s-desc">Thesis status + price snapshot run once per weekday after the US close. The schedule lives in vercel.json and changes on redeploy.</div>
          </div>
          <span className="badge-soon">≈22:00 UTC</span>
        </div>
      </div>

      <div className="card settings-section">
        <h2>Debug</h2>
        <p className="sec-sub">For checking the backend is wired up.</p>
        <div className="setting-row">
          <div>
            <div className="s-label">Debug mode</div>
            <div className="s-desc">Surface extra detail and the API test below.</div>
          </div>
          <Toggle on={settings.debug} onClick={() => setSetting('debug', !settings.debug)} />
        </div>
        {settings.debug && (
          <div style={{ marginTop: 14 }}>
            <button className="btn btn-sm" onClick={runTest} disabled={testing}>
              {testing ? <span className="spinner" style={{ borderTopColor: 'var(--accent)' }} /> : 'Test API endpoints'}
            </button>
            {debugOut && <pre className="debug-pre" style={{ marginTop: 12 }}>{JSON.stringify(debugOut, null, 2)}</pre>}
            <pre className="debug-pre" style={{ marginTop: 12 }}>{JSON.stringify({ version: APP_VERSION, settings }, null, 2)}</pre>
          </div>
        )}
      </div>

      <div className="card settings-section placeholder-card">
        <h2>Account &amp; billing <span className="badge-soon">when you launch</span></h2>
        <p className="sec-sub">Single-user right now. User accounts, login, subscription and payments land here if you open it up to others.</p>
        <div className="setting-row"><div className="s-label">Profile &amp; account management</div><span className="badge-soon">soon</span></div>
        <div className="setting-row"><div className="s-label">Subscription / payments</div><span className="badge-soon">soon</span></div>
        <div className="setting-row"><div className="s-label">Account history</div><span className="badge-soon">soon</span></div>
      </div>

      <div className="card settings-section">
        <h2>About</h2>
        <div className="setting-row">
          <div className="s-label">Version</div>
          <span className="mono" style={{ color: 'var(--text-dim)' }}>v{APP_VERSION}</span>
        </div>
      </div>
    </div>
  );
}
