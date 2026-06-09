async function request(path, options = {}) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  if (!res.ok) {
    const err = new Error((data && data.error) || `Request failed (${res.status})`);
    err.status = res.status;
    err.code = data && data.code;
    throw err;
  }
  return data;
}

export const api = {
  getTrades: () => request('/api/trades'),
  createTrade: (payload) => request('/api/trades', { method: 'POST', body: JSON.stringify(payload) }),
  closeTrade: (id, exitPrice) =>
    request('/api/trade-close', { method: 'POST', body: JSON.stringify({ id, exit_price: exitPrice }) }),

  getTheses: () => request('/api/theses'),
  createThesis: (payload) => request('/api/theses', { method: 'POST', body: JSON.stringify(payload) }),
  updateThesis: (payload) => request('/api/theses', { method: 'PATCH', body: JSON.stringify(payload) }),

  getHistory: () => request('/api/history'),
  updateHistory: (payload) => request('/api/history', { method: 'PATCH', body: JSON.stringify(payload) }),
  deleteHistory: (id) => request(`/api/history?id=${encodeURIComponent(id)}`, { method: 'DELETE' }),

  analyze: ({ ticker, force } = {}) =>
    request('/api/analyze', { method: 'POST', body: JSON.stringify({ ticker, force }) }),
  getTickerPerf: (symbols) => {
    const list = Array.isArray(symbols) ? symbols.join(',') : symbols;
    return request(`/api/ticker-perf${list ? `?symbols=${encodeURIComponent(list)}` : ''}`);
  },

  getQuotes: (symbols) => {
    const list = Array.isArray(symbols) ? symbols.join(',') : symbols;
    if (!list) return Promise.resolve({ quotes: {} });
    return request(`/api/quotes?symbols=${encodeURIComponent(list)}`);
  },
  getNews: (symbol, limit = 3) =>
    request(`/api/news?symbol=${encodeURIComponent(symbol)}&limit=${limit}`),

  getTickerMeta: (symbols) => {
    const list = Array.isArray(symbols) ? symbols.join(',') : symbols;
    return request(`/api/ticker-meta${list ? `?symbols=${encodeURIComponent(list)}` : ''}`);
  },
  setTickerMeta: (symbol, halal_status) =>
    request('/api/ticker-meta', { method: 'POST', body: JSON.stringify({ symbol, halal_status }) }),

  research: ({ name, description, thesis_id, exclude } = {}) =>
    request('/api/ai', {
      method: 'POST',
      body: JSON.stringify({ type: 'research', thesis: { name, description }, thesis_id, exclude }),
    }),

  refreshStatus: (payload = {}) =>
    request('/api/refresh-status', { method: 'POST', body: JSON.stringify(payload) }),
};
