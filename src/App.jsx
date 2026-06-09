import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import LiveTrades from './pages/LiveTrades.jsx';
import Research from './pages/Research.jsx';
import ResearchThesis from './pages/ResearchThesis.jsx';
import History from './pages/History.jsx';
import Analyze from './pages/Analyze.jsx';
import Settings from './pages/Settings.jsx';
import Notifications from './pages/Notifications.jsx';
import Logo from './components/Logo.jsx';
import NotificationBell from './components/NotificationBell.jsx';
import CodeLogin from './components/CodeLogin.jsx';
import { APP_NAME, APP_VERSION } from './lib/settings.js';
import { useWorkspace } from './lib/session.js';

export default function App() {
  const ws = useWorkspace();

  if (!ws || !ws.code) {
    return <CodeLogin />;
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar-inner">
          <NavLink to="/live" className="brand">
            <Logo size={30} />
            <span className="brand-name">{APP_NAME}</span>
          </NavLink>
          <nav className="nav">
            <NavLink to="/live" className={({ isActive }) => (isActive ? 'active' : '')}>Live</NavLink>
            <NavLink to="/paper" className={({ isActive }) => (isActive ? 'active' : '')}>Paper</NavLink>
            <NavLink to="/research" className={({ isActive }) => (isActive ? 'active' : '')}>Research</NavLink>
            <NavLink to="/analyze" className={({ isActive }) => (isActive ? 'active' : '')}>Analyze</NavLink>
            <NavLink to="/history" className={({ isActive }) => (isActive ? 'active' : '')}>History</NavLink>
            <NavLink to="/settings" className={({ isActive }) => (isActive ? 'active' : '')}>Settings</NavLink>
          </nav>
          <NotificationBell />
        </div>
      </header>

      <main className="main">
        <Routes>
          <Route path="/" element={<Navigate to="/live" replace />} />
          <Route path="/live" element={<LiveTrades />} />
          <Route path="/paper" element={<LiveTrades paper />} />
          <Route path="/research" element={<Research />} />
          <Route path="/research/:id" element={<ResearchThesis />} />
          <Route path="/analyze" element={<Analyze />} />
          <Route path="/history" element={<History />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/notifications" element={<Notifications />} />
          <Route path="*" element={<Navigate to="/live" replace />} />
        </Routes>
      </main>

      <footer className="app-footer">{APP_NAME} · v{APP_VERSION}{ws.label ? ` · ${ws.label}` : ''}</footer>
    </div>
  );
}
