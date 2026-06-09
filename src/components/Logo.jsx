export default function Logo({ size = 30 }) {
  return (
    <svg className="brand-logo" width={size} height={size} viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="CLVR">
      <defs>
        <linearGradient id="clvrTile" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--accent-2)" />
          <stop offset="1" stopColor="var(--accent)" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="10" fill="url(#clvrTile)" />
      <path
        d="M16 4 C17.1 11.4 20.6 14.9 28 16 C20.6 17.1 17.1 20.6 16 28 C14.9 20.6 11.4 17.1 4 16 C11.4 14.9 14.9 11.4 16 4 Z"
        fill="#ffffff"
      />
    </svg>
  );
}
