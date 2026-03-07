export default function ViewToggle({ currentView, buildViewHref }) {
  const isTable = currentView === 'table';

  return (
    <div className="hidden md:flex items-center gap-1 border border-[var(--border)] rounded-lg p-0.5">
      <a
        href={buildViewHref('cards')}
        className={`rounded px-2 py-1 text-xs transition-colors ${
          !isTable
            ? 'bg-[var(--accent)]/10 text-[var(--foreground)]'
            : 'text-[var(--muted)] hover:text-[var(--foreground)]'
        }`}
        title="Card view"
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="1" y="1" width="6" height="6" rx="1" />
          <rect x="9" y="1" width="6" height="6" rx="1" />
          <rect x="1" y="9" width="6" height="6" rx="1" />
          <rect x="9" y="9" width="6" height="6" rx="1" />
        </svg>
      </a>
      <a
        href={buildViewHref('table')}
        className={`rounded px-2 py-1 text-xs transition-colors ${
          isTable
            ? 'bg-[var(--accent)]/10 text-[var(--foreground)]'
            : 'text-[var(--muted)] hover:text-[var(--foreground)]'
        }`}
        title="Table view"
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
          <line x1="1" y1="3" x2="15" y2="3" />
          <line x1="1" y1="8" x2="15" y2="8" />
          <line x1="1" y1="13" x2="15" y2="13" />
        </svg>
      </a>
    </div>
  );
}
