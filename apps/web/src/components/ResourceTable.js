'use client';

import { useState } from 'react';
import { CATEGORIES } from '../lib/categories';
import { timeAgo, TYPE_ICONS, getScoreStyle, formatContentType } from '../lib/resource-utils';

function SortArrow({ active, ascending }) {
  if (!active) {
    return (
      <svg width="10" height="10" viewBox="0 0 16 16" fill="none" className="ml-1 text-[var(--muted)] opacity-50 group-hover:opacity-80 transition-opacity">
        <path d="M8 3l3 4H5l3-4z" fill="currentColor" />
        <path d="M8 13l3-4H5l3 4z" fill="currentColor" />
      </svg>
    );
  }
  return (
    <svg width="10" height="10" viewBox="0 0 16 16" fill="none" className="ml-1 text-[var(--accent)]">
      {ascending
        ? <path d="M8 3l4 5H4l4-5z" fill="currentColor" />
        : <path d="M8 13l4-5H4l4 5z" fill="currentColor" />
      }
    </svg>
  );
}

function ChevronIcon({ expanded }) {
  return (
    <svg
      width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      className={`transition-transform ${expanded ? 'rotate-90' : ''}`}
    >
      <path d="M6 4l4 4-4 4" />
    </svg>
  );
}

function ExpandedPanel({ resource }) {
  const tags = resource.resource_tags?.map(rt => rt.tags?.name).filter(Boolean) || [];
  const isEngagementGated = tags.includes('engagement-required');
  const displayTags = tags.filter(t => t !== 'engagement-required');
  const engagement = resource.engagement || {};
  const extracted = resource.extracted_content || {};
  const expandedLinks = resource.expanded_links || [];

  return (
    <div className="px-4 py-4 bg-[var(--surface-alt)] border-t border-[var(--border)]">
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
                <span className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
                  Engagement required
                </span>
              )}
              {displayTags.map(tag => (
                <span key={tag} className="text-[10px] rounded-md bg-[var(--background)] px-1.5 py-0.5 text-[var(--muted)]">
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* Engagement stats */}
          {(engagement.likes || engagement.retweets || engagement.replies) && (
            <div className="flex gap-3 text-xs text-[var(--muted)] mb-3">
              {engagement.likes > 0 && (
                <span className="flex items-center gap-1">
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" className="text-red-400"><path d="M8 14s-5.5-3.5-5.5-7A3.5 3.5 0 018 4a3.5 3.5 0 015.5 3c0 3.5-5.5 7-5.5 7z"/></svg>
                  {engagement.likes}
                </span>
              )}
              {engagement.retweets > 0 && (
                <span className="flex items-center gap-1">
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M1 10l3 3 3-3M4 13V5M15 6l-3-3-3 3M12 3v8"/></svg>
                  {engagement.retweets}
                </span>
              )}
              {engagement.replies > 0 && (
                <span className="flex items-center gap-1">
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2 3h12v8H5l-3 3V3z"/></svg>
                  {engagement.replies}
                </span>
              )}
              {engagement.bookmarks > 0 && (
                <span className="flex items-center gap-1">
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 2h8v12l-4-3-4 3V2z"/></svg>
                  {engagement.bookmarks}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Right column: links + extracted content */}
        <div>
          {/* Extracted content for GitHub repos */}
          {extracted.stars !== undefined && (
            <div className="text-xs mb-3 p-2.5 rounded-lg border border-[var(--border)] bg-[var(--surface)]">
              <div className="flex items-center gap-2 mb-1">
                {extracted.language && (
                  <span className="text-[var(--muted)]">{extracted.language}</span>
                )}
                <span className="text-[var(--muted)]">★ {extracted.stars?.toLocaleString()}</span>
              </div>
              {extracted.description && (
                <p className="text-[var(--muted)]">{extracted.description}</p>
              )}
            </div>
          )}

          {/* Extracted content for articles */}
          {!extracted.stars && extracted.description && (
            <div className="text-xs mb-3 p-2.5 rounded-lg border border-[var(--border)] bg-[var(--surface)]">
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
                className="text-[var(--accent)] hover:underline truncate flex items-center gap-1"
              >
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M6 8.5a3.5 3.5 0 005 0l2-2a3.5 3.5 0 00-5-5l-1 1"/><path d="M10 7.5a3.5 3.5 0 00-5 0l-2 2a3.5 3.5 0 005 5l1-1"/></svg>
                {resource.primary_url.replace(/^https?:\/\/(www\.)?/, '').slice(0, 60)}
              </a>
            )}
            {resource.tweet_url && (
              <a
                href={resource.tweet_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--accent)] hover:underline flex items-center gap-1"
              >
                <svg viewBox="0 0 24 24" fill="currentColor" width="12" height="12"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                Original tweet
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
                  className="text-[var(--accent)] hover:underline truncate flex items-center gap-1"
                >
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M6 8.5a3.5 3.5 0 005 0l2-2a3.5 3.5 0 00-5-5l-1 1"/><path d="M10 7.5a3.5 3.5 0 00-5 0l-2 2a3.5 3.5 0 005 5l1-1"/></svg>
                  {url.replace(/^https?:\/\/(www\.)?/, '').slice(0, 60)}
                </a>
              );
            })}
          </div>

          {/* Actions */}
          <div className="flex gap-3 mt-3">
            {resource.has_downloadable && (
              <a
                href={`/api/resources/${resource.id}/download`}
                className="text-xs text-[var(--accent)] hover:underline flex items-center gap-1"
              >
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M8 2v9M4 8l4 4 4-4M2 14h12" />
                </svg>
                Download .md
              </a>
            )}
            <a
              href={`/resource/${resource.id}`}
              className="text-xs text-[var(--accent)] hover:underline"
            >
              View details →
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ResourceTable({ resources, currentSort, sortHrefs, compact }) {
  const [expandedId, setExpandedId] = useState(null);

  function toggleExpand(id) {
    setExpandedId(prev => prev === id ? null : id);
  }

  const hasSortControls = sortHrefs && currentSort;

  // Toggle helpers: clicking a column toggles between its asc/desc variants
  const titleSortKey = currentSort === 'title_asc' ? 'title_desc' : 'title_asc';
  const authorSortKey = currentSort === 'author_asc' ? 'author_desc' : 'author_asc';
  const typeSortKey = currentSort === 'type_asc' ? 'type_desc' : 'type_asc';
  const dateSortKey = currentSort === 'newest' ? 'oldest' : 'newest';

  // Active state for highlighting the sorted column
  const titleActive = currentSort === 'title_asc' || currentSort === 'title_desc';
  const authorActive = currentSort === 'author_asc' || currentSort === 'author_desc';
  const typeActive = currentSort === 'type_asc' || currentSort === 'type_desc';
  const scoreActive = currentSort === 'score';
  const dateActive = currentSort === 'newest' || currentSort === 'oldest';

  return (
    <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
      <table className="w-full text-sm text-left">
        <thead>
          <tr className="border-b border-[var(--border)] bg-[var(--surface-alt)]">
            <th className="px-2 sm:px-4 py-2.5 text-xs font-medium text-[var(--muted)] w-8"></th>
            <th className="px-2 sm:px-4 py-2.5 text-xs font-medium text-[var(--muted)]">
              {hasSortControls ? (
                <a href={sortHrefs[titleSortKey]} className={`group inline-flex items-center transition-colors hover:text-[var(--foreground)] ${titleActive ? 'text-[var(--accent)] font-semibold' : ''}`}>
                  Title
                  <SortArrow active={titleActive} ascending={currentSort === 'title_asc'} />
                </a>
              ) : 'Title'}
            </th>
            <th className="px-2 sm:px-4 py-2.5 text-xs font-medium text-[var(--muted)] hidden lg:table-cell">
              {hasSortControls ? (
                <a href={sortHrefs[authorSortKey]} className={`group inline-flex items-center transition-colors hover:text-[var(--foreground)] ${authorActive ? 'text-[var(--accent)] font-semibold' : ''}`}>
                  Author
                  <SortArrow active={authorActive} ascending={currentSort === 'author_asc'} />
                </a>
              ) : 'Author'}
            </th>
            <th className="px-2 sm:px-4 py-2.5 text-xs font-medium text-[var(--muted)] hidden lg:table-cell">Category</th>
            {!compact && (
              <th className="px-2 sm:px-4 py-2.5 text-xs font-medium text-[var(--muted)] hidden xl:table-cell">
                {hasSortControls ? (
                  <a href={sortHrefs[typeSortKey]} className={`group inline-flex items-center transition-colors hover:text-[var(--foreground)] ${typeActive ? 'text-[var(--accent)] font-semibold' : ''}`}>
                    Type
                    <SortArrow active={typeActive} ascending={currentSort === 'type_asc'} />
                  </a>
                ) : 'Type'}
              </th>
            )}
            <th className="px-2 sm:px-4 py-2.5 text-xs font-medium text-[var(--muted)]">
              {hasSortControls ? (
                <a href={sortHrefs.score} className={`group inline-flex items-center transition-colors hover:text-[var(--foreground)] ${scoreActive ? 'text-[var(--accent)] font-semibold' : ''}`}>
                  Score
                  <SortArrow active={scoreActive} ascending={false} />
                </a>
              ) : 'Score'}
            </th>
            <th className="px-2 sm:px-4 py-2.5 text-xs font-medium text-[var(--muted)] hidden sm:table-cell">
              {hasSortControls ? (
                <a href={sortHrefs[dateSortKey]} className={`group inline-flex items-center transition-colors hover:text-[var(--foreground)] ${dateActive ? 'text-[var(--accent)] font-semibold' : ''}`}>
                  Date
                  <SortArrow active={dateActive} ascending={currentSort === 'oldest'} />
                </a>
              ) : 'Date'}
            </th>
          </tr>
        </thead>
          {resources.map(resource => {
            const category = CATEGORIES.find(c => c.name === resource.categories?.name);
            const typeIcon = TYPE_ICONS[resource.content_type] || '\u{1F426}';
            const score = resource.ai_quality_score;
            const scoreStyle = getScoreStyle(score);
            const isExpanded = expandedId === resource.id;

            return (
              <tbody key={resource.id}>
                <tr
                  className={`border-b border-[var(--border)] cursor-pointer transition-colors hover:bg-[var(--surface-alt)] ${
                    isExpanded ? 'bg-[var(--surface-alt)]' : ''
                  }`}
                  onClick={() => toggleExpand(resource.id)}
                >
                  <td className="px-2 sm:px-4 py-3 text-[var(--muted)]">
                    <ChevronIcon expanded={isExpanded} />
                  </td>
                  <td className="px-2 sm:px-4 py-3">
                    <div className="font-medium text-sm leading-snug line-clamp-2 sm:line-clamp-1">
                      {resource.title}
                    </div>
                  </td>
                  <td className="px-2 sm:px-4 py-3 hidden lg:table-cell">
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
                  <td className="px-2 sm:px-4 py-3 hidden lg:table-cell">
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
                  {!compact && (
                    <td className="px-2 sm:px-4 py-3 hidden xl:table-cell">
                      <span className="text-xs text-[var(--muted)]" title={formatContentType(resource.content_type)}>
                        {typeIcon}
                      </span>
                    </td>
                  )}
                  <td className="px-2 sm:px-4 py-3">
                    {score && scoreStyle && (
                      <span
                        className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-semibold ${scoreStyle}`}
                        title={`Quality score: ${score}/10`}
                      >
                        {score}/10
                      </span>
                    )}
                  </td>
                  <td className="px-2 sm:px-4 py-3 text-xs text-[var(--muted)] whitespace-nowrap hidden sm:table-cell">
                    {timeAgo(resource.tweet_created_at || resource.discovered_at)}
                  </td>
                </tr>
                {isExpanded && (
                  <tr>
                    <td colSpan={compact ? 6 : 7} className="p-0">
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
