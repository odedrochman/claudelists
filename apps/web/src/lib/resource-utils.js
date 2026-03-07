export function timeAgo(dateStr) {
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

export const TYPE_ICONS = {
  github_repo: '\u{1F4E6}',
  article: '\u{1F4C4}',
  thread: '\u{1F9F5}',
  video: '\u{1F3AC}',
  media: '\u{1F5BC}\uFE0F',
  tweet: '\u{1F426}',
};

export const SCORE_COLORS = {
  high: 'text-emerald-600 bg-emerald-50 border-emerald-200',    // 8-10
  good: 'text-blue-600 bg-blue-50 border-blue-200',             // 6-7
  mid: 'text-[var(--muted)] bg-[var(--border)]/50 border-[var(--border)]', // 4-5
  low: 'text-orange-600 bg-orange-50 border-orange-200',        // 1-3
};

export function getScoreStyle(score) {
  if (!score) return null;
  if (score >= 8) return SCORE_COLORS.high;
  if (score >= 6) return SCORE_COLORS.good;
  if (score >= 4) return SCORE_COLORS.mid;
  return SCORE_COLORS.low;
}

export const SORT_OPTIONS = {
  score: { column: 'ai_quality_score', ascending: false, nullsFirst: false, label: 'Top Rated' },
  newest: { column: 'discovered_at', ascending: false, nullsFirst: false, label: 'Newest' },
  oldest: { column: 'discovered_at', ascending: true, nullsFirst: false, label: 'Oldest' },
};
