export function ErrorBanner({ error }) {
  if (!error) return null;
  if (error.code === 'CONFIG') {
    return (
      <div className="banner">
        <b>Backend not configured yet.</b> {error.message} See <code>README.md</code> → Setup. Add
        your keys in <code>.env</code> (local) or your Vercel project's Environment Variables, then reload.
      </div>
    );
  }
  return <div className="banner">{error.message || 'Something went wrong.'}</div>;
}

export function Empty({ icon = '○', title, children }) {
  return (
    <div className="empty">
      <div className="empty-icon">{icon}</div>
      <h3>{title}</h3>
      {children}
    </div>
  );
}

export function Skeletons({ count = 3, className = 'grid grid-trades' }) {
  return (
    <div className={className}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="skeleton" />
      ))}
    </div>
  );
}
