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

export const TYPE_LABELS = {
  tweet: 'Tweet',
  github_repo: 'GitHub Repo',
  article: 'Article',
  thread: 'Thread',
  video: 'Video',
  media: 'Media',
  x_article: 'Article',
};

export function formatContentType(type) {
  return TYPE_LABELS[type] || (type ? type.replace(/_/g, ' ') : 'Resource');
}

export const SCORE_COLORS = {
  high: 'text-emerald-700 bg-emerald-50 border-emerald-200',    // 8-10
  good: 'text-[var(--accent)] bg-[var(--accent)]/8 border-[var(--accent)]/20', // 6-7
  mid: 'text-[var(--muted)] bg-[var(--surface-alt)] border-[var(--border)]',   // 4-5
  low: 'text-orange-600 bg-orange-50 border-orange-200',        // 1-3
};

export function getScoreStyle(score) {
  if (!score) return null;
  if (score >= 8) return SCORE_COLORS.high;
  if (score >= 6) return SCORE_COLORS.good;
  if (score >= 4) return SCORE_COLORS.mid;
  return SCORE_COLORS.low;
}

export const SKILL_LEVELS = {
  beginner: { label: 'Beginner', color: 'text-emerald-700 border-emerald-300 bg-emerald-50' },
  intermediate: { label: 'Intermediate', color: 'text-blue-700 border-blue-300 bg-blue-50' },
  advanced: { label: 'Advanced', color: 'text-purple-700 border-purple-300 bg-purple-50' },
};

export const CONTENT_FORMATS = {
  video: { label: 'Video' },
  'written-guide': { label: 'Written Guide' },
  'prompt-collection': { label: 'Prompts' },
  'code-example': { label: 'Code Example' },
  'case-study': { label: 'Case Study' },
  news: { label: 'News' },
  discussion: { label: 'Discussion' },
};

export function formatSkillLevel(level) {
  return SKILL_LEVELS[level]?.label || level;
}

export function formatContentFormat(format) {
  return CONTENT_FORMATS[format]?.label || (format ? format.replace(/-/g, ' ') : '');
}

export const CLAUDE_TOOLS = {
  'claude-chat': { label: 'Claude Chat', color: 'text-gray-700 border-gray-300 bg-gray-50' },
  'claude-code': { label: 'Claude Code', color: 'text-sky-700 border-sky-300 bg-sky-50' },
  'claude-cowork': { label: 'Claude Cowork', color: 'text-orange-700 border-orange-300 bg-orange-50' },
  'mcp': { label: 'MCP', color: 'text-violet-700 border-violet-300 bg-violet-50' },
  'api': { label: 'API', color: 'text-teal-700 border-teal-300 bg-teal-50' },
  'multiple': { label: 'Multiple Tools', color: 'text-indigo-700 border-indigo-300 bg-indigo-50' },
};

export function formatClaudeTool(tool) {
  return CLAUDE_TOOLS[tool]?.label || tool;
}

export const SORT_OPTIONS = {
  score: { column: 'ai_quality_score', ascending: false, nullsFirst: false, label: 'Top Rated', pill: true },
  newest: { column: 'tweet_created_at', ascending: false, nullsFirst: false, label: 'Newest', pill: true, secondary: { column: 'discovered_at', ascending: false } },
  oldest: { column: 'tweet_created_at', ascending: true, nullsFirst: true, label: 'Oldest', pill: true, secondary: { column: 'discovered_at', ascending: true } },
  title_asc: { column: 'title', ascending: true, nullsFirst: false, label: 'Title A-Z' },
  title_desc: { column: 'title', ascending: false, nullsFirst: false, label: 'Title Z-A' },
  author_asc: { column: 'author_handle', ascending: true, nullsFirst: false, label: 'Author A-Z' },
  author_desc: { column: 'author_handle', ascending: false, nullsFirst: false, label: 'Author Z-A' },
  type_asc: { column: 'content_type', ascending: true, nullsFirst: false, label: 'Type A-Z' },
  type_desc: { column: 'content_type', ascending: false, nullsFirst: false, label: 'Type Z-A' },
};
