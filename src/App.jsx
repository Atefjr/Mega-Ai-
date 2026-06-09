import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import LiveTrades from './pages/LiveTrades.jsx';
import Research from './pages/Research.jsx';
import ResearchThesis from './pages/ResearchThesis.jsx';
import History from './pages/History.jsx';
import Analyze from './pages/Analyze.jsx';
import Settings from './pages/Settings.jsx';
import { APP_VERSION } from './lib/settings.js';

export default function App() {
  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar-inner">
          <NavLink to="/live" className="brand">
            <span className="brand-mark">▲</span>
            <span className="brand-name">Stock <span>Mega</span> AI</span>
          </NavLink>
          <nav className="nav">
            <NavLink to="/live" className={({ isActive }) => (isActive ? 'active' : '')}>Live Trades</NavLink>
            <NavLink to="/research" className={({ isActive }) => (isActive ? 'active' : '')}>Research</NavLink>
            <NavLink to="/analyze" className={({ isActive }) => (isActive ? 'active' : '')}>Analyze</NavLink>
            <NavLink to="/history" className={({ isActive }) => (isActive ? 'active' : '')}>History</NavLink>
            <NavLink to="/settings" className={({ isActive }) => (isActive ? 'active' : '')}>Settings</NavLink>
          </nav>
        </div>
      </header>

      <main className="main">
        <Routes>
          <Route path="/" element={<Navigate to="/live" replace />} />
          <Route path="/live" element={<LiveTrades />} />
          <Route path="/research" element={<Research />} />
          <Route path="/research/:id" element={<ResearchThesis />} />
          <Route path="/analyze" element={<Analyze />} />
          <Route path="/history" element={<History />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/live" replace />} />
        </Routes>
      </main>

      <footer className="app-footer">Stock Mega AI · v{APP_VERSION}</footer>
    </div>
  );
}
