import { useEffect, useState } from 'react';

const KEY = 'sma_workspace';

export function getWorkspace() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || 'null');
  } catch {
    return null;
  }
}

export function setWorkspace(ws) {
  try {
    localStorage.setItem(KEY, JSON.stringify(ws));
  } catch {
    /* storage unavailable */
  }
  window.dispatchEvent(new CustomEvent('sma:workspace', { detail: ws }));
}

export function clearWorkspace() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new CustomEvent('sma:workspace', { detail: null }));
}

export function getWorkspaceCode() {
  const w = getWorkspace();
  return w && w.code ? w.code : '';
}

export function useWorkspace() {
  const [ws, setWs] = useState(getWorkspace);
  useEffect(() => {
    const on = (e) => setWs(e.detail !== undefined ? e.detail : getWorkspace());
    window.addEventListener('sma:workspace', on);
    return () => window.removeEventListener('sma:workspace', on);
  }, []);
  return ws;
}
