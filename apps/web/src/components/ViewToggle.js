export default function ViewToggle({ currentView, buildViewHref }) {
  const isList = currentView === 'list';

  return (
    <div className="hidden md:flex items-center justify-center gap-1 rounded-full border border-[var(--border)] bg-[var(--surface)] p-1">
      <a
        href={buildViewHref('cards')}
        className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium transition-all ${
          !isList
            ? 'bg-[var(--accent)] text-white shadow-sm'
            : 'text-[var(--muted)] hover:text-[var(--foreground)]'
        }`}
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
          <rect x="1" y="1" width="6" height="6" rx="1" />
          <rect x="9" y="1" width="6" height="6" rx="1" />
          <rect x="1" y="9" width="6" height="6" rx="1" />
          <rect x="9" y="9" width="6" height="6" rx="1" />
        </svg>
        Cards
      </a>
      <a
        href={buildViewHref('list')}
        className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium transition-all ${
          isList
            ? 'bg-[var(--accent)] text-white shadow-sm'
            : 'text-[var(--muted)] hover:text-[var(--foreground)]'
        }`}
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
          <line x1="1" y1="3" x2="15" y2="3" />
          <line x1="1" y1="8" x2="15" y2="8" />
          <line x1="1" y1="13" x2="15" y2="13" />
        </svg>
        List
      </a>
    </div>
  );
}
