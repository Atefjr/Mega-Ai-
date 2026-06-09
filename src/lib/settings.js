import { useEffect, useState } from 'react';

export const APP_VERSION = '0.3.0';

const KEY = 'sma_settings';
const DEFAULTS = { theme: 'dark', showConfidence: true, debug: false };

export function getSettings() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : { ...DEFAULTS };
  } catch {
    return { ...DEFAULTS };
  }
}

export function setSetting(key, value) {
  const next = { ...getSettings(), [key]: value };
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* storage unavailable; ignore */
  }
  if (key === 'theme') applyTheme(value);
  window.dispatchEvent(new CustomEvent('sma:settings', { detail: next }));
  return next;
}

export function applyTheme(theme) {
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('data-theme', theme === 'light' ? 'light' : 'dark');
  }
}

export function useSettings() {
  const [settings, setSettings] = useState(getSettings);
  useEffect(() => {
    const onChange = (e) => setSettings(e.detail || getSettings());
    window.addEventListener('sma:settings', onChange);
    return () => window.removeEventListener('sma:settings', onChange);
  }, []);
  return settings;
}
