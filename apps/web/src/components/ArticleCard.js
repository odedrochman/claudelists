const TYPE_BADGE = {
  daily: { label: 'Daily', className: 'bg-blue-50 text-blue-700' },
  weekly: { label: 'Weekly', className: 'bg-purple-50 text-purple-700' },
  monthly: { label: 'Monthly', className: 'bg-emerald-50 text-emerald-700' },
};

export default function ArticleCard({ article }) {
  const badge = TYPE_BADGE[article.article_type] || { label: article.article_type, className: 'bg-gray-100 text-gray-700' };
  const resourceCount = (article.article_resources || []).length;
  const excerpt = article.meta_description || (article.content || '').replace(/[#*\[\]]/g, '').slice(0, 150);
  const date = article.published_at
    ? new Date(article.published_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : '';

  return (
    <a
      href={`/digest/${article.slug}`}
      className="group block bg-[var(--surface)] rounded-xl border border-[var(--border)] p-5 hover:border-[var(--accent)]/40 hover:shadow-sm transition-all"
    >
      <div className="flex items-center gap-2 mb-3">
        <span className={`px-2 py-0.5 rounded text-xs font-medium ${badge.className}`}>
          {badge.label}
        </span>
        {date && <span className="text-xs text-[var(--muted)]">{date}</span>}
      </div>

      <h3 className="font-semibold text-[var(--foreground)] group-hover:text-[var(--accent)] transition-colors line-clamp-2 mb-2">
        {article.title}
      </h3>

      <p className="text-sm text-[var(--muted)] line-clamp-3 mb-3">
        {excerpt}
      </p>

      <div className="flex items-center gap-2 text-xs text-[var(--muted)]">
        <span>{resourceCount} resource{resourceCount !== 1 ? 's' : ''} featured</span>
      </div>
    </a>
  );
}
