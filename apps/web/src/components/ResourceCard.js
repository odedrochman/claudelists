'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { CATEGORIES } from '../lib/categories';
import { timeAgo, TYPE_ICONS, getScoreStyle, formatContentType, SKILL_LEVELS, CONTENT_FORMATS } from '../lib/resource-utils';

export default function ResourceCard({ resource }) {
  const shouldReduceMotion = useReducedMotion();
  const category = CATEGORIES.find(c => c.name === resource.categories?.name);
  const typeIcon = TYPE_ICONS[resource.content_type] || '\u{1F426}';
  const tags = resource.resource_tags?.map(rt => rt.tags?.name).filter(Boolean) || resource.tags || [];
  const isEngagementGated = tags.includes('engagement-required');
  const score = resource.ai_quality_score;
  const scoreStyle = getScoreStyle(score);

  const Wrapper = shouldReduceMotion ? 'div' : motion.div;
  const motionProps = shouldReduceMotion ? {} : {
    whileHover: { y: -2, boxShadow: '0 8px 30px rgba(0,0,0,0.08)', transition: { duration: 0.2, ease: 'easeOut' } },
    whileTap: { scale: 0.98 },
  };

  return (
    <Wrapper {...motionProps} className="group rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 hover:border-[var(--accent)]/40 transition-colors">
      <div className="flex items-start justify-between gap-2 mb-2.5">
        <div className="flex items-center gap-2 text-xs text-[var(--muted)]">
          <span title={formatContentType(resource.content_type)}>{typeIcon}</span>
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
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200"
              title="This resource requires engagement (like/retweet/comment) to receive content via DM"
            >
              Engagement required
            </span>
          )}
          {resource.skill_level && SKILL_LEVELS[resource.skill_level] && (
            <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${SKILL_LEVELS[resource.skill_level].color}`}>
              {SKILL_LEVELS[resource.skill_level].label}
            </span>
          )}
          {resource.content_format && CONTENT_FORMATS[resource.content_format] && (
            <span className="inline-flex items-center rounded-full border border-[var(--border)] px-2 py-0.5 text-[10px] font-medium text-[var(--muted)]">
              {CONTENT_FORMATS[resource.content_format].label}
            </span>
          )}
        </div>
        {resource.has_downloadable && (
          <a
            href={`/api/resources/${resource.id}/download`}
            className="shrink-0 text-xs text-[var(--accent)] hover:text-[var(--accent-hover)] flex items-center gap-1"
            title="Download Markdown"
          >
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M8 2v9M4 8l4 4 4-4M2 14h12" />
            </svg>
            .md
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
          className="hover:text-[var(--foreground)]"
        >
          @{resource.author_handle}
        </a>
        <div className="flex items-center gap-2">
          {score && scoreStyle && (
            <span
              className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-semibold ${scoreStyle}`}
              title={`Quality score: ${score}/10`}
            >
              {score}/10
            </span>
          )}
          <span>{timeAgo(resource.tweet_created_at || resource.discovered_at)}</span>
        </div>
      </div>

      {tags.filter(t => t !== 'engagement-required').length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2.5 pt-2.5 border-t border-[var(--border)]">
          {tags.filter(t => t !== 'engagement-required').slice(0, 4).map(tag => (
            <a key={tag} href={`/browse?tag=${encodeURIComponent(tag)}`} className="text-[10px] rounded-md bg-[var(--surface-alt)] px-1.5 py-0.5 text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--border)] transition-colors">
              {tag}
            </a>
          ))}
        </div>
      )}
    </Wrapper>
  );
}
