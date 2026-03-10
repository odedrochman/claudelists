import { Suspense } from 'react';
import { createServerClient } from '../../lib/supabase';
import { SORT_OPTIONS, formatContentType, SKILL_LEVELS, CONTENT_FORMATS, CLAUDE_TOOLS, formatContentFormat } from '../../lib/resource-utils';
import ResourceCard from '../../components/ResourceCard';
import ResourceTable from '../../components/ResourceTable';
import ViewToggle from '../../components/ViewToggle';
import SearchBar from '../../components/SearchBar';
import CategoryNav from '../../components/CategoryNav';
import FadeIn from '../../components/animations/FadeIn';
import { StaggerContainer, StaggerItem } from '../../components/animations/StaggerChildren';

export const revalidate = 300;

export const metadata = {
  title: 'Browse Claude Resources - ClaudeLists',
  description: 'Search, filter, and explore the best Claude ecosystem resources. MCP servers, prompts, GitHub repos, tutorials, and tools, scored and organized by the community.',
  alternates: {
    canonical: 'https://claudelists.com/browse',
  },
};

const PAGE_SIZE = 100;

async function getResources({ q, category, contentType, tag, skillLevel, contentFormat, claudeTool, sort = 'newest', page = 1 }) {
  const supabase = createServerClient();
  const offset = (page - 1) * PAGE_SIZE;
  const sortOpt = SORT_OPTIONS[sort] || SORT_OPTIONS.newest;

  // Use inner joins when filtering by tag so only matching resources are returned
  const selectStr = tag
    ? '*, categories(name, slug), resource_tags!inner(tags!inner(name))'
    : '*, categories(name, slug), resource_tags(tags(name))';

  let query = supabase
    .from('resources')
    .select(selectStr, { count: 'exact' })
    .eq('status', 'published')
    .order(sortOpt.column, { ascending: sortOpt.ascending, nullsFirst: sortOpt.nullsFirst })
    .range(offset, offset + PAGE_SIZE - 1);

  // Secondary sort: break ties or handle nulls
  if (sortOpt.secondary) {
    query = query.order(sortOpt.secondary.column, { ascending: sortOpt.secondary.ascending });
  } else if (sort === 'score') {
    query = query.order('tweet_created_at', { ascending: false, nullsFirst: false });
    query = query.order('discovered_at', { ascending: false });
  }

  if (q) {
    query = query.textSearch('fts', q, { type: 'websearch' });
  }
  if (category) {
    query = query.eq('categories.slug', category);
  }
  if (contentType) {
    query = query.eq('content_type', contentType);
  }
  if (tag) {
    query = query.eq('resource_tags.tags.name', tag);
  }
  if (skillLevel) {
    query = query.eq('skill_level', skillLevel);
  }
  if (contentFormat) {
    query = query.eq('content_format', contentFormat);
  }
  if (claudeTool) {
    query = query.eq('claude_tool', claudeTool);
  }

  const { data, count } = await query;
  return { resources: data || [], total: count || 0 };
}

async function BrowseContent({ searchParams }) {
  const params = await searchParams;
  const q = params.q || '';
  const category = params.category || '';
  const contentType = params.type || '';
  const tag = params.tag || '';
  const skillLevel = params.skill || '';
  const contentFormat = params.format || '';
  const claudeTool = params.tool || '';
  const sort = params.sort || 'newest';
  const page = parseInt(params.page || '1', 10);
  const view = params.view || 'list';

  const { resources, total } = await getResources({ q, category, contentType, tag, skillLevel, contentFormat, claudeTool, sort, page });
  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <>
      {view === 'list' ? (
        <>
          {/* Table: visible on md+, hidden on mobile */}
          <div className="hidden md:block">
            <ResourceTable
              resources={resources}
              currentSort={sort}
              sortHrefs={{
                score: buildFilterHref(params, 'sort', 'score'),
                newest: buildFilterHref(params, 'sort', 'newest'),
                oldest: buildFilterHref(params, 'sort', 'oldest'),
                title_asc: buildFilterHref(params, 'sort', 'title_asc'),
                title_desc: buildFilterHref(params, 'sort', 'title_desc'),
                author_asc: buildFilterHref(params, 'sort', 'author_asc'),
                author_desc: buildFilterHref(params, 'sort', 'author_desc'),
                type_asc: buildFilterHref(params, 'sort', 'type_asc'),
                type_desc: buildFilterHref(params, 'sort', 'type_desc'),
              }}
            />
          </div>
          {/* Fallback cards on mobile */}
          <StaggerContainer className="md:hidden grid grid-cols-1 sm:grid-cols-2 gap-4">
            {resources.map(resource => (
              <StaggerItem key={resource.id}>
                <ResourceCard resource={resource} />
              </StaggerItem>
            ))}
          </StaggerContainer>
        </>
      ) : (
        <StaggerContainer className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {resources.map(resource => (
            <StaggerItem key={resource.id}>
              <ResourceCard resource={resource} />
            </StaggerItem>
          ))}
        </StaggerContainer>
      )}

      {resources.length === 0 && (
        <div className="text-center py-12">
          <p className="text-[var(--muted)] mb-2">No resources match your filters.</p>
          <p className="text-sm text-[var(--muted)]/70">
            Try removing some filters or <a href="/browse" className="text-[var(--accent)] hover:underline">browse all resources</a>.
          </p>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-8">
          {page > 1 && (
            <a
              href={`/browse?${new URLSearchParams({ ...params, page: page - 1 })}`}
              className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm hover:border-[var(--accent)]"
            >
              Previous
            </a>
          )}
          <span className="flex items-center text-sm text-[var(--muted)]">
            Page {page} of {totalPages}
          </span>
          {page < totalPages && (
            <a
              href={`/browse?${new URLSearchParams({ ...params, page: page + 1 })}`}
              className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm hover:border-[var(--accent)]"
            >
              Next
            </a>
          )}
        </div>
      )}
    </>
  );
}

function buildFilterHref(currentParams, key, value) {
  const params = new URLSearchParams();
  // Preserve existing filters except the one being toggled and reset page
  if (currentParams?.type && key !== 'type') params.set('type', currentParams.type);
  if (currentParams?.tag && key !== 'tag') params.set('tag', currentParams.tag);
  if (currentParams?.skill && key !== 'skill') params.set('skill', currentParams.skill);
  if (currentParams?.format && key !== 'format') params.set('format', currentParams.format);
  if (currentParams?.tool && key !== 'tool') params.set('tool', currentParams.tool);
  if (currentParams?.q) params.set('q', currentParams.q);
  if (currentParams?.category) params.set('category', currentParams.category);
  if (currentParams?.sort && key !== 'sort') params.set('sort', currentParams.sort);
  if (currentParams?.view && key !== 'view') params.set('view', currentParams.view);
  // Toggle: if already active, remove it; otherwise set it
  if (currentParams?.[key] !== value) params.set(key, value);
  const qs = params.toString();
  return `/browse${qs ? `?${qs}` : ''}`;
}

export default async function BrowsePage({ searchParams }) {
  const params = await searchParams;
  const view = params?.view || 'list';
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      <FadeIn>
        <h1 className="text-2xl font-bold mb-6">Explore Resources</h1>
      </FadeIn>

      <div className="mb-6">
        <Suspense fallback={<div className="h-10" />}>
          <SearchBar />
        </Suspense>
      </div>

      <div className="mb-8">
        <CategoryNav />
      </div>

      {/* Sort options + view toggle */}
      <div className="flex items-center justify-between gap-2 mb-4">
        <div className="flex items-center gap-2">
          <span className="text-xs text-[var(--muted)]">Sort:</span>
          {Object.entries(SORT_OPTIONS).filter(([, opt]) => opt.pill).map(([key, opt]) => (
            <a
              key={key}
              href={buildFilterHref(params, 'sort', key)}
              className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                (params?.sort || 'newest') === key
                  ? 'border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--foreground)]'
                  : 'border-[var(--border)] text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--foreground)]'
              }`}
            >
              {opt.label}
            </a>
          ))}
        </div>
        <ViewToggle
          currentView={view}
          buildViewHref={(v) => buildFilterHref(params, 'view', v)}
        />
      </div>

      {/* Content type & tag filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        {['tweet', 'github_repo', 'article', 'thread', 'video'].map(type => (
          <a
            key={type}
            href={buildFilterHref(params, 'type', type)}
            className={`rounded-full border px-3 py-1 text-xs transition-colors ${
              params?.type === type
                ? 'border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--foreground)]'
                : 'border-[var(--border)] text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--foreground)]'
            }`}
          >
            {formatContentType(type)}
          </a>
        ))}
        <a
          href={buildFilterHref(params, 'tag', 'engagement-required')}
          className={`rounded-full border px-3 py-1 text-xs transition-colors ${
            params?.tag === 'engagement-required'
              ? 'border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100'
              : 'border-[var(--border)] text-[var(--muted)] hover:border-amber-300 hover:text-amber-700'
          }`}
        >
          Engagement required
        </a>
      </div>

      {/* Skill level & content format filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        {Object.entries(SKILL_LEVELS).map(([key, { label, color }]) => (
          <a
            key={key}
            href={buildFilterHref(params, 'skill', key)}
            className={`rounded-full border px-3 py-1 text-xs transition-colors ${
              params?.skill === key
                ? color
                : 'border-[var(--border)] text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--foreground)]'
            }`}
          >
            {label}
          </a>
        ))}
        <span className="w-px bg-[var(--border)] mx-1" />
        {Object.entries(CONTENT_FORMATS).map(([key, { label }]) => (
          <a
            key={key}
            href={buildFilterHref(params, 'format', key)}
            className={`rounded-full border px-3 py-1 text-xs transition-colors ${
              params?.format === key
                ? 'border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--foreground)]'
                : 'border-[var(--border)] text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--foreground)]'
            }`}
          >
            {label}
          </a>
        ))}
      </div>

      {/* Claude Tool filter */}
      <div className="flex flex-wrap gap-2 mb-6">
        <span className="text-xs text-[var(--muted)] self-center">Tool:</span>
        {Object.entries(CLAUDE_TOOLS).map(([key, { label, color }]) => (
          <a
            key={key}
            href={buildFilterHref(params, 'tool', key)}
            className={`rounded-full border px-3 py-1 text-xs transition-colors ${
              params?.tool === key
                ? color
                : 'border-[var(--border)] text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--foreground)]'
            }`}
          >
            {label}
          </a>
        ))}
      </div>

      <Suspense fallback={<div className="text-center py-12 text-[var(--muted)]">Loading...</div>}>
        <BrowseContent searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
