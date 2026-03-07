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

const SCORE_COLORS = {
  high: 'text-emerald-600 bg-emerald-50 border-emerald-200',    // 8-10
  good: 'text-blue-600 bg-blue-50 border-blue-200',             // 6-7
  mid: 'text-[var(--muted)] bg-[var(--border)]/50 border-[var(--border)]', // 4-5
  low: 'text-orange-600 bg-orange-50 border-orange-200',        // 1-3
};

function getScoreStyle(score) {
  if (!score) return null;
  if (score >= 8) return SCORE_COLORS.high;
  if (score >= 6) return SCORE_COLORS.good;
  if (score >= 4) return SCORE_COLORS.mid;
  return SCORE_COLORS.low;
}

export default function ResourceCard({ resource }) {
  const category = CATEGORIES.find(c => c.name === resource.categories?.name);
  const typeIcon = TYPE_ICONS[resource.content_type] || '🐦';
  const tags = resource.resource_tags?.map(rt => rt.tags?.name).filter(Boolean) || resource.tags || [];
  const isEngagementGated = tags.includes('engagement-required');
  const score = resource.ai_quality_score;
  const scoreStyle = getScoreStyle(score);

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
          {isEngagementGated && (
            <span
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-700"
              title="Requires engagement (like/RT/comment) to receive content via DM"
            >
              🔒 DM-gated
            </span>
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
        <div className="flex items-center gap-2">
          {score && scoreStyle && (
            <span
              className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-semibold ${scoreStyle}`}
              title={`Quality score: ${score}/10`}
            >
              {score}/10
            </span>
          )}
          <span>{timeAgo(resource.tweet_created_at || resource.discovered_at)}</span>
        </div>
      </div>

      {tags.filter(t => t !== 'engagement-required').length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {tags.filter(t => t !== 'engagement-required').slice(0, 4).map(tag => (
            <span key={tag} className="text-[10px] rounded bg-[var(--border)] px-1.5 py-0.5 text-[var(--muted)]">
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
