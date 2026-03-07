'use client';

import { useState } from 'react';
import { CATEGORIES } from '../lib/categories';
import { timeAgo, TYPE_ICONS, getScoreStyle } from '../lib/resource-utils';

function SortArrow({ active, ascending }) {
  if (!active) return <span className="text-[var(--border)] ml-1">↕</span>;
  return <span className="text-[var(--accent)] ml-1">{ascending ? '↑' : '↓'}</span>;
}

function ExpandedPanel({ resource }) {
  const tags = resource.resource_tags?.map(rt => rt.tags?.name).filter(Boolean) || [];
  const isEngagementGated = tags.includes('engagement-required');
  const displayTags = tags.filter(t => t !== 'engagement-required');
  const engagement = resource.engagement || {};
  const extracted = resource.extracted_content || {};
  const expandedLinks = resource.expanded_links || [];

  return (
    <div className="px-4 py-4 bg-[var(--background)] border-t border-[var(--border)]">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left column: summary + tags */}
        <div>
          {resource.summary && (
            <p className="text-sm text-[var(--muted)] mb-3">{resource.summary}</p>
          )}

          {/* Tags */}
          {(displayTags.length > 0 || isEngagementGated) && (
            <div className="flex flex-wrap gap-1 mb-3">
              {isEngagementGated && (
                <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium bg-amber-100 text-amber-700">
                  🔒 DM-gated
                </span>
              )}
              {displayTags.map(tag => (
                <span key={tag} className="text-[10px] rounded bg-[var(--border)] px-1.5 py-0.5 text-[var(--muted)]">
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* Engagement stats */}
          {(engagement.likes || engagement.retweets || engagement.replies) && (
            <div className="flex gap-3 text-xs text-[var(--muted)] mb-3">
              {engagement.likes > 0 && <span>❤️ {engagement.likes}</span>}
              {engagement.retweets > 0 && <span>🔁 {engagement.retweets}</span>}
              {engagement.replies > 0 && <span>💬 {engagement.replies}</span>}
              {engagement.bookmarks > 0 && <span>🔖 {engagement.bookmarks}</span>}
            </div>
          )}
        </div>

        {/* Right column: links + extracted content */}
        <div>
          {/* Extracted content for GitHub repos */}
          {extracted.stars !== undefined && (
            <div className="text-xs mb-3 p-2 rounded border border-[var(--border)]">
              <div className="flex items-center gap-2 mb-1">
                {extracted.language && (
                  <span className="text-[var(--muted)]">{extracted.language}</span>
                )}
                <span className="text-[var(--muted)]">⭐ {extracted.stars?.toLocaleString()}</span>
              </div>
              {extracted.description && (
                <p className="text-[var(--muted)]">{extracted.description}</p>
              )}
            </div>
          )}

          {/* Extracted content for articles */}
          {!extracted.stars && extracted.description && (
            <div className="text-xs mb-3 p-2 rounded border border-[var(--border)]">
              <p className="text-[var(--muted)] line-clamp-3">{extracted.description}</p>
            </div>
          )}

          {/* Links */}
          <div className="flex flex-col gap-1 text-xs">
            {resource.primary_url && (
              <a
                href={resource.primary_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--accent)] hover:underline truncate"
              >
                🔗 {resource.primary_url.replace(/^https?:\/\/(www\.)?/, '').slice(0, 60)}
              </a>
            )}
            {resource.tweet_url && (
              <a
                href={resource.tweet_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--accent)] hover:underline"
              >
                🐦 Original tweet
              </a>
            )}
            {expandedLinks.length > 0 && expandedLinks.slice(0, 3).map((link, i) => {
              const url = typeof link === 'string' ? link : link.expanded || link.original;
              if (!url || url === resource.primary_url) return null;
              return (
                <a
                  key={i}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[var(--accent)] hover:underline truncate"
                >
                  🔗 {url.replace(/^https?:\/\/(www\.)?/, '').slice(0, 60)}
                </a>
              );
            })}
          </div>

          {/* Actions */}
          <div className="flex gap-3 mt-3">
            {resource.has_downloadable && (
              <a
                href={`/api/resources/${resource.id}/download`}
                className="text-xs text-[var(--accent)] hover:underline"
              >
                ⬇ Download .md
              </a>
            )}
            <a
              href={`/resource/${resource.id}`}
              className="text-xs text-[var(--accent)] hover:underline"
            >
              View full page →
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ResourceTable({ resources, currentSort, sortHrefs }) {
  const [expandedId, setExpandedId] = useState(null);

  function toggleExpand(id) {
    setExpandedId(prev => prev === id ? null : id);
  }

  // Determine sort link for date column: toggle between newest/oldest
  const dateSortKey = currentSort === 'newest' ? 'oldest' : 'newest';

  return (
    <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
      <table className="w-full text-sm text-left">
        <thead>
          <tr className="border-b border-[var(--border)] bg-[var(--border)]/30">
            <th className="px-4 py-2.5 text-xs font-medium text-[var(--muted)] w-8"></th>
            <th className="px-4 py-2.5 text-xs font-medium text-[var(--muted)]">Title</th>
            <th className="px-4 py-2.5 text-xs font-medium text-[var(--muted)] hidden lg:table-cell">Author</th>
            <th className="px-4 py-2.5 text-xs font-medium text-[var(--muted)] hidden lg:table-cell">Category</th>
            <th className="px-4 py-2.5 text-xs font-medium text-[var(--muted)] hidden xl:table-cell">Type</th>
            <th className="px-4 py-2.5 text-xs font-medium text-[var(--muted)]">
              <a href={sortHrefs.score} className="inline-flex items-center hover:text-[var(--foreground)] transition-colors">
                Score
                <SortArrow active={currentSort === 'score'} ascending={false} />
              </a>
            </th>
            <th className="px-4 py-2.5 text-xs font-medium text-[var(--muted)]">
              <a href={sortHrefs[dateSortKey]} className="inline-flex items-center hover:text-[var(--foreground)] transition-colors">
                Date
                <SortArrow
                  active={currentSort === 'newest' || currentSort === 'oldest'}
                  ascending={currentSort === 'oldest'}
                />
              </a>
            </th>
          </tr>
        </thead>
          {resources.map(resource => {
            const category = CATEGORIES.find(c => c.name === resource.categories?.name);
            const typeIcon = TYPE_ICONS[resource.content_type] || '🐦';
            const score = resource.ai_quality_score;
            const scoreStyle = getScoreStyle(score);
            const isExpanded = expandedId === resource.id;

            return (
              <tbody key={resource.id}>
                <tr
                  className={`border-b border-[var(--border)] cursor-pointer transition-colors hover:bg-[var(--border)]/20 ${
                    isExpanded ? 'bg-[var(--border)]/10' : ''
                  }`}
                  onClick={() => toggleExpand(resource.id)}
                >
                  <td className="px-4 py-3 text-xs text-[var(--muted)]">
                    <span className={`inline-block transition-transform ${isExpanded ? 'rotate-90' : ''}`}>
                      ›
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-sm leading-snug line-clamp-1">
                      {resource.title}
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    <a
                      href={`https://x.com/${resource.author_handle}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
                      onClick={e => e.stopPropagation()}
                    >
                      @{resource.author_handle}
                    </a>
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    {category && (
                      <a
                        href={`/category/${category.slug}`}
                        className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium whitespace-nowrap"
                        style={{ backgroundColor: category.color + '15', color: category.color }}
                        onClick={e => e.stopPropagation()}
                      >
                        {category.icon} {category.name}
                      </a>
                    )}
                  </td>
                  <td className="px-4 py-3 hidden xl:table-cell">
                    <span className="text-xs" title={resource.content_type}>
                      {typeIcon}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {score && scoreStyle && (
                      <span
                        className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-semibold ${scoreStyle}`}
                        title={`Quality score: ${score}/10`}
                      >
                        {score}/10
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-[var(--muted)] whitespace-nowrap">
                    {timeAgo(resource.tweet_created_at || resource.discovered_at)}
                  </td>
                </tr>
                {isExpanded && (
                  <tr>
                    <td colSpan={7} className="p-0">
                      <ExpandedPanel resource={resource} />
                    </td>
                  </tr>
                )}
              </tbody>
            );
          })}
      </table>
    </div>
  );
}
