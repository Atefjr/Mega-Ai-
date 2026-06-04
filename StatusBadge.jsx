export default function StatusBadge({ label }) {
  const map = {
    Intact: 'intact',
    Cautious: 'cautious',
    Broken: 'broken',
  };
  const cls = map[label] || 'pending';
  const text = label || 'Awaiting AI';
  return (
    <span className={`badge ${cls}`} title={label ? `Thesis status: ${label}` : 'Status scoring runs in Slice 2'}>
      <span className="dot" />
      {text}
    </span>
  );
}
