export function fmtMoney(value, opts = {}) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—';
  const n = Number(value);
  return n.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: opts.cents === false ? 0 : 2,
    maximumFractionDigits: 2,
  });
}

export function fmtSignedMoney(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—';
  const n = Number(value);
  const sign = n > 0 ? '+' : '';
  return sign + fmtMoney(n);
}

export function fmtPct(value, withSign = true) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—';
  const n = Number(value);
  const sign = withSign && n > 0 ? '+' : '';
  return `${sign}${n.toFixed(2)}%`;
}

export function fmtPrice(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—';
  return Number(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function signClass(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return 'flat';
  const n = Number(value);
  if (n > 0) return 'pos';
  if (n < 0) return 'neg';
  return 'flat';
}

export function fmtDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

/** Position math from dollar-based input. */
export function positionStats(trade, currentPrice) {
  const amount = Number(trade.amount_invested);
  const avgCost = Number(trade.avg_cost);
  const shares = avgCost > 0 ? amount / avgCost : 0;
  if (currentPrice === null || currentPrice === undefined || !(currentPrice > 0)) {
    return { shares, value: null, pnl: null, returnPct: null };
  }
  const value = shares * currentPrice;
  return {
    shares,
    value,
    pnl: value - amount,
    returnPct: (currentPrice / avgCost - 1) * 100,
  };
}
