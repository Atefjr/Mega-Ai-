const MOON_PATH = 'M12 3a6.364 6.364 0 0 0 9 9 9 9 0 1 1-9-9Z';

const NEXT = { unknown: 'halal', halal: 'not_halal', not_halal: 'unknown' };
const LABEL = {
  halal: 'Halal',
  not_halal: 'Not halal',
  unknown: 'Halal status not set',
};

export default function HalalBadge({ status = 'unknown', onCycle, size = 20 }) {
  const s = status || 'unknown';
  const clickable = typeof onCycle === 'function';
  const title = clickable ? `${LABEL[s]} — click to change` : LABEL[s];

  return (
    <button
      type="button"
      className={`halal halal-${s}${clickable ? ' clickable' : ''}`}
      title={title}
      aria-label={title}
      disabled={!clickable}
      onClick={clickable ? (e) => { e.stopPropagation(); onCycle(NEXT[s]); } : undefined}
    >
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        {s === 'halal' && <path d={MOON_PATH} fill="var(--moon)" />}
        {s === 'unknown' && <path d={MOON_PATH} fill="none" stroke="var(--text-faint)" strokeWidth="1.6" strokeLinejoin="round" />}
        {s === 'not_halal' && (
          <>
            <path d={MOON_PATH} fill="var(--moon-off)" />
            <line x1="4.5" y1="19.5" x2="19.5" y2="4.5" stroke="var(--red)" strokeWidth="2.2" strokeLinecap="round" />
          </>
        )}
      </svg>
    </button>
  );
}
