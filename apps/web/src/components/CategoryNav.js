import { CATEGORIES } from '../lib/categories';

export default function CategoryNav({ activeSlug }) {
  return (
    <div className="flex flex-wrap gap-2">
      <a
        href="/browse"
        className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
          !activeSlug
            ? 'bg-[var(--accent)] text-white'
            : 'bg-[var(--surface-alt)] text-[var(--muted)] hover:text-[var(--foreground)]'
        }`}
      >
        All
      </a>
      {CATEGORIES.map(cat => (
        <a
          key={cat.slug}
          href={`/category/${cat.slug}`}
          className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
            activeSlug === cat.slug
              ? 'text-white'
              : 'hover:opacity-80'
          }`}
          style={{
            backgroundColor: activeSlug === cat.slug ? cat.color : cat.color + '15',
            color: activeSlug === cat.slug ? '#fff' : cat.color,
          }}
        >
          {cat.icon} {cat.name}
        </a>
      ))}
    </div>
  );
}
