'use client';

import { CATEGORIES } from '../lib/categories';

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const now = new Date();
  const date = new Date(dateStr);
  const seconds = Math.floor((now - date) / 1000);

  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

const TYPE_ICONS = {
  github_repo: '📦',
  article: '📄',
  thread: '🧵',
  video: '🎬',
  media: '🖼️',
  tweet: '🐦',
};

export default function ResourceCard({ resource }) {
  const category = CATEGORIES.find(c => c.name === resource.categories?.name);
  const typeIcon = TYPE_ICONS[resource.content_type] || '🐦';

  return (
    <div className="group rounded-lg border border-[var(--border)] p-4 hover:border-[var(--accent)]/50 transition-all hover:shadow-sm">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 text-xs text-[var(--muted)]">
          <span>{typeIcon}</span>
          {category && (
            <a
              href={`/category/${category.slug}`}
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
              style={{ backgroundColor: category.color + '15', color: category.color }}
            >
              {category.icon} {category.name}
            </a>
          )}
        </div>
        {resource.has_downloadable && (
          <a
            href={`/api/resources/${resource.id}/download`}
            className="shrink-0 text-xs text-[var(--accent)] hover:underline flex items-center gap-1"
            title="Download .md file"
          >
            ⬇ .md
          </a>
        )}
      </div>

      <a href={`/resource/${resource.id}`} className="block">
        <h3 className="font-semibold text-sm leading-snug mb-1 group-hover:text-[var(--accent)] transition-colors line-clamp-2">
          {resource.title}
        </h3>
        <p className="text-xs text-[var(--muted)] line-clamp-2 mb-3">
          {resource.summary}
        </p>
      </a>

      <div className="flex items-center justify-between text-xs text-[var(--muted)]">
        <a
          href={`https://x.com/${resource.author_handle}`}
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-[var(--foreground)] transition-colors"
        >
          @{resource.author_handle}
        </a>
        <span>{timeAgo(resource.tweet_created_at || resource.discovered_at)}</span>
      </div>

      {resource.tags?.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {resource.tags.slice(0, 4).map(tag => (
            <span key={tag} className="text-[10px] rounded bg-[var(--border)] px-1.5 py-0.5 text-[var(--muted)]">
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
