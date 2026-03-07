import { createServerClient } from '../../../lib/supabase';
import { CATEGORIES } from '../../../lib/categories';
import { SORT_OPTIONS } from '../../../lib/resource-utils';
import ResourceCard from '../../../components/ResourceCard';
import ResourceTable from '../../../components/ResourceTable';
import ViewToggle from '../../../components/ViewToggle';
import CategoryNav from '../../../components/CategoryNav';

export async function generateStaticParams() {
  return CATEGORIES.map(c => ({ slug: c.slug }));
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const category = CATEGORIES.find(c => c.slug === slug);
  if (!category) return { title: 'Category - ClaudeLists' };
  return {
    title: `${category.name} - ClaudeLists`,
    description: `Browse ${category.name.toLowerCase()} resources in the Claude ecosystem.`,
  };
}

async function getCategoryResources(slug, { contentType, tag, sort = 'score' } = {}) {
  const supabase = createServerClient();
  const sortOpt = SORT_OPTIONS[sort] || SORT_OPTIONS.score;
  const selectStr = tag
    ? '*, categories!inner(name, slug), resource_tags!inner(tags!inner(name))'
    : '*, categories!inner(name, slug), resource_tags(tags(name))';
  let query = supabase
    .from('resources')
    .select(selectStr)
    .eq('categories.slug', slug)
    .eq('status', 'published')
    .order(sortOpt.column, { ascending: sortOpt.ascending, nullsFirst: sortOpt.nullsFirst })
    .limit(50);
  if (sort === 'score') {
    query = query.order('discovered_at', { ascending: false });
  }
  if (contentType) query = query.eq('content_type', contentType);
  if (tag) query = query.eq('resource_tags.tags.name', tag);
  const { data } = await query;
  return data || [];
}

export const revalidate = 300;

function buildCategoryFilterHref(slug, currentParams, key, value) {
  const params = new URLSearchParams();
  if (currentParams?.type && key !== 'type') params.set('type', currentParams.type);
  if (currentParams?.tag && key !== 'tag') params.set('tag', currentParams.tag);
  if (currentParams?.sort && key !== 'sort') params.set('sort', currentParams.sort);
  if (currentParams?.view && key !== 'view') params.set('view', currentParams.view);
  if (currentParams?.[key] !== value) params.set(key, value);
  const qs = params.toString();
  return `/category/${slug}${qs ? `?${qs}` : ''}`;
}

export default async function CategoryPage({ params, searchParams }) {
  const { slug } = await params;
  const sp = await searchParams;
  const category = CATEGORIES.find(c => c.slug === slug);
  const contentType = sp?.type || '';
  const tag = sp?.tag || '';
  const sort = sp?.sort || 'score';
  const view = sp?.view || 'cards';
  const resources = await getCategoryResources(slug, { contentType, tag, sort });

  if (!category) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-16 text-center">
        <h1 className="text-2xl font-bold">Category not found</h1>
        <a href="/browse" className="text-[var(--accent)] hover:underline mt-4 inline-block">
          Back to browse
        </a>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <span className="text-3xl">{category.icon}</span>
          <h1 className="text-2xl font-bold">{category.name}</h1>
          <span className="text-sm text-[var(--muted)]">({resources.length})</span>
        </div>
      </div>

      <div className="mb-8">
        <CategoryNav activeSlug={slug} />
      </div>

      {/* Sort options + view toggle */}
      <div className="flex items-center justify-between gap-2 mb-4">
        <div className="flex items-center gap-2">
          <span className="text-xs text-[var(--muted)]">Sort:</span>
          {Object.entries(SORT_OPTIONS).map(([key, opt]) => (
            <a
              key={key}
              href={buildCategoryFilterHref(slug, sp, 'sort', key)}
              className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                (sp?.sort || 'score') === key
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
          buildViewHref={(v) => buildCategoryFilterHref(slug, sp, 'view', v)}
        />
      </div>

      {/* Content type & tag filters */}
      <div className="flex flex-wrap gap-2 mb-6">
        {['tweet', 'github_repo', 'article', 'thread', 'video'].map(type => (
          <a
            key={type}
            href={buildCategoryFilterHref(slug, sp, 'type', type)}
            className={`rounded-full border px-3 py-1 text-xs transition-colors ${
              sp?.type === type
                ? 'border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--foreground)]'
                : 'border-[var(--border)] text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--foreground)]'
            }`}
          >
            {type.replace('_', ' ')}
          </a>
        ))}
        <a
          href={buildCategoryFilterHref(slug, sp, 'tag', 'engagement-required')}
          className={`rounded-full border px-3 py-1 text-xs transition-colors ${
            sp?.tag === 'engagement-required'
              ? 'border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100'
              : 'border-[var(--border)] text-[var(--muted)] hover:border-amber-300 hover:text-amber-700'
          }`}
        >
          🔒 DM-gated
        </a>
      </div>

      {view === 'table' ? (
        <>
          <div className="hidden md:block">
            <ResourceTable
              resources={resources}
              currentSort={sort}
              sortHrefs={{
                score: buildCategoryFilterHref(slug, sp, 'sort', 'score'),
                newest: buildCategoryFilterHref(slug, sp, 'sort', 'newest'),
                oldest: buildCategoryFilterHref(slug, sp, 'sort', 'oldest'),
              }}
            />
          </div>
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
        <p className="text-center text-[var(--muted)] py-12">
          No resources in this category yet.
        </p>
      )}
    </div>
  );
}
