import { Suspense } from 'react';
import { createServerClient } from '../../lib/supabase';
import { SORT_OPTIONS, formatContentType } from '../../lib/resource-utils';
import ResourceCard from '../../components/ResourceCard';
import ResourceTable from '../../components/ResourceTable';
import ViewToggle from '../../components/ViewToggle';
import SearchBar from '../../components/SearchBar';
import CategoryNav from '../../components/CategoryNav';

export const revalidate = 300;

export const metadata = {
  title: 'Browse Claude Resources - ClaudeLists',
  description: 'Search, filter, and explore the best Claude ecosystem resources. MCP servers, prompts, GitHub repos, tutorials, and tools, scored and organized by the community.',
  alternates: {
    canonical: 'https://claudelists.com/browse',
  },
};

const PAGE_SIZE = 24;

async function getResources({ q, category, contentType, tag, sort = 'score', page = 1 }) {
  const supabase = createServerClient();
  const offset = (page - 1) * PAGE_SIZE;
  const sortOpt = SORT_OPTIONS[sort] || SORT_OPTIONS.score;

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

  const { data, count } = await query;
  return { resources: data || [], total: count || 0 };
}

async function BrowseContent({ searchParams }) {
  const params = await searchParams;
  const q = params.q || '';
  const category = params.category || '';
  const contentType = params.type || '';
  const tag = params.tag || '';
  const sort = params.sort || 'score';
  const page = parseInt(params.page || '1', 10);
  const view = params.view || 'list';

  const { resources, total } = await getResources({ q, category, contentType, tag, sort, page });
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
          <div className="md:hidden grid grid-cols-1 sm:grid-cols-2 gap-4">
            {resources.map(resource => (
              <ResourceCard key={resource.id} resource={resource} />
            ))}
          </div>
        </>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {resources.map(resource => (
            <ResourceCard key={resource.id} resource={resource} />
          ))}
        </div>
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
      <h1 className="text-2xl font-bold mb-6">Explore Resources</h1>

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
                (params?.sort || 'score') === key
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
      <div className="flex flex-wrap gap-2 mb-6">
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

      <Suspense fallback={<div className="text-center py-12 text-[var(--muted)]">Loading...</div>}>
        <BrowseContent searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
