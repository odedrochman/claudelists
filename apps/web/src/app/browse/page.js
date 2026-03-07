import { Suspense } from 'react';
import { createServerClient } from '../../lib/supabase';
import ResourceCard from '../../components/ResourceCard';
import SearchBar from '../../components/SearchBar';
import CategoryNav from '../../components/CategoryNav';

export const metadata = {
  title: 'Browse - ClaudeLists',
  description: 'Search and filter Claude ecosystem resources.',
};

const PAGE_SIZE = 24;

async function getResources({ q, category, contentType, page = 1 }) {
  const supabase = createServerClient();
  const offset = (page - 1) * PAGE_SIZE;

  let query = supabase
    .from('resources')
    .select('*, categories(name, slug)', { count: 'exact' })
    .eq('status', 'published')
    .order('discovered_at', { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1);

  if (q) {
    query = query.textSearch('fts', q, { type: 'websearch' });
  }
  if (category) {
    query = query.eq('categories.slug', category);
  }
  if (contentType) {
    query = query.eq('content_type', contentType);
  }

  const { data, count } = await query;
  return { resources: data || [], total: count || 0 };
}

async function BrowseContent({ searchParams }) {
  const params = await searchParams;
  const q = params.q || '';
  const category = params.category || '';
  const contentType = params.type || '';
  const page = parseInt(params.page || '1', 10);

  const { resources, total } = await getResources({ q, category, contentType, page });
  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {resources.map(resource => (
          <ResourceCard key={resource.id} resource={resource} />
        ))}
      </div>

      {resources.length === 0 && (
        <p className="text-center text-[var(--muted)] py-12">
          No resources found. Try a different search or filter.
        </p>
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

export default function BrowsePage({ searchParams }) {
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-2xl font-bold mb-6">Browse Resources</h1>

      <div className="mb-6">
        <Suspense fallback={<div className="h-10" />}>
          <SearchBar />
        </Suspense>
      </div>

      <div className="mb-8">
        <CategoryNav />
      </div>

      {/* Content type filter */}
      <div className="flex flex-wrap gap-2 mb-6">
        {['tweet', 'github_repo', 'article', 'thread', 'video'].map(type => (
          <a
            key={type}
            href={`/browse?type=${type}`}
            className="rounded-full border border-[var(--border)] px-3 py-1 text-xs text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--foreground)] transition-colors"
          >
            {type.replace('_', ' ')}
          </a>
        ))}
      </div>

      <Suspense fallback={<div className="text-center py-12 text-[var(--muted)]">Loading...</div>}>
        <BrowseContent searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
