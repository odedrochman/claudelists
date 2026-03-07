import { createServerClient } from '../lib/supabase';
import ResourceTable from '../components/ResourceTable';
import CategoryNav from '../components/CategoryNav';

export const revalidate = 300; // Revalidate every 5 minutes

async function getFeaturedResources() {
  const supabase = createServerClient();
  const { data } = await supabase
    .from('resources')
    .select('*, categories(name, slug), resource_tags(tags(name))')
    .eq('status', 'published')
    .order('ai_quality_score', { ascending: false, nullsFirst: false })
    .order('discovered_at', { ascending: false })
    .limit(6);
  return data || [];
}

async function getRecentResources() {
  const supabase = createServerClient();
  const { data } = await supabase
    .from('resources')
    .select('*, categories(name, slug), resource_tags(tags(name))')
    .eq('status', 'published')
    .order('discovered_at', { ascending: false })
    .limit(6);
  return data || [];
}

async function getStats() {
  const supabase = createServerClient();
  const { count } = await supabase
    .from('resources')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'published');
  const { data: cats } = await supabase
    .from('categories')
    .select('id', { count: 'exact', head: true });
  return { total: count || 0, categories: cats?.length || 10 };
}

function XIcon({ size = 16 }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" width={size} height={size}>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

export default async function HomePage() {
  const [featured, recent, stats] = await Promise.all([
    getFeaturedResources(),
    getRecentResources(),
    getStats(),
  ]);

  // Deduplicate: remove from recent any that are already in featured
  const featuredIds = new Set(featured.map(r => r.id));
  const recentUnique = recent.filter(r => !featuredIds.has(r.id));

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      {/* Hero */}
      <section className="py-16 sm:py-20 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-[var(--accent)]/20 bg-[var(--accent)]/5 px-3 py-1 text-xs text-[var(--accent)] font-medium mb-6">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-[var(--accent)] animate-pulse" />
          Updated daily from the community
        </div>
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          The <span className="text-[var(--accent)]">Claude</span> Resource Directory
        </h1>
        <p className="mt-4 text-lg text-[var(--muted)] max-w-2xl mx-auto leading-relaxed">
          {stats.total} curated resources across {stats.categories} categories. MCP servers, prompts, CLAUDE.md configs, tools, and more. Discovered daily from the community.
        </p>
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
          <a
            href="/browse"
            className="rounded-lg bg-[var(--accent)] px-6 py-2.5 text-sm font-medium text-white hover:opacity-90 transition-opacity"
          >
            Explore Resources
          </a>
          <a
            href="/submit"
            className="rounded-lg border border-[var(--border)] px-6 py-2.5 text-sm font-medium text-[var(--foreground)] hover:border-[var(--accent)] transition-colors"
          >
            Submit a Resource
          </a>
        </div>
      </section>

      {/* Categories */}
      <section className="mb-10">
        <CategoryNav />
      </section>

      {/* Featured Resources (Top Rated) */}
      <section className="mb-12">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Featured Resources</h2>
          <a href="/browse?sort=score" className="text-sm text-[var(--accent)] hover:underline">
            See all →
          </a>
        </div>
        {featured.length > 0 ? (
          <ResourceTable resources={featured} compact />
        ) : (
          <p className="text-center text-[var(--muted)] py-12">
            No resources yet. Check back soon!
          </p>
        )}
      </section>

      {/* Recent Additions */}
      {recentUnique.length > 0 && (
        <section className="mb-12">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Recent Additions</h2>
            <a href="/browse?sort=newest" className="text-sm text-[var(--accent)] hover:underline">
              See all →
            </a>
          </div>
          <ResourceTable resources={recentUnique} compact />
        </section>
      )}

      {/* CTA */}
      <section className="my-16 text-center rounded-xl border border-[var(--accent)]/20 bg-[var(--accent)]/5 p-8 sm:p-10">
        <h2 className="text-lg font-semibold mb-2">Found a great Claude resource?</h2>
        <p className="text-sm text-[var(--muted)] mb-5 max-w-md mx-auto">
          Help grow the directory. Submit it directly or share on X and tag <strong className="text-[var(--foreground)]">@claudelists</strong>.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <a
            href="/submit"
            className="inline-flex items-center gap-2 rounded-lg bg-[var(--accent)] text-white px-5 py-2.5 text-sm font-medium hover:opacity-90 transition-opacity"
          >
            Submit a Resource
          </a>
          <a
            href="https://x.com/claudelists"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] px-5 py-2.5 text-sm font-medium text-[var(--foreground)] hover:border-[var(--accent)] transition-colors"
          >
            <XIcon /> Follow @claudelists
          </a>
        </div>
      </section>
    </div>
  );
}
