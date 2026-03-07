import { createServerClient } from '../lib/supabase';
import ResourceCard from '../components/ResourceCard';
import CategoryNav from '../components/CategoryNav';

export const revalidate = 300; // Revalidate every 5 minutes

async function getLatestResources() {
  const supabase = createServerClient();
  const { data } = await supabase
    .from('resources')
    .select('*, categories(name, slug)')
    .eq('status', 'published')
    .order('discovered_at', { ascending: false })
    .limit(12);
  return data || [];
}

async function getStats() {
  const supabase = createServerClient();
  const { count } = await supabase
    .from('resources')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'published');
  return { total: count || 0 };
}

export default async function HomePage() {
  const [resources, stats] = await Promise.all([
    getLatestResources(),
    getStats(),
  ]);

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      {/* Hero */}
      <section className="py-16 text-center">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          <span className="text-[var(--accent)]">Claude</span>Lists
        </h1>
        <p className="mt-4 text-lg text-[var(--muted)] max-w-2xl mx-auto">
          Curated directory of Claude ecosystem resources. MCP servers, prompts, CLAUDE.md configs, tools, and more &mdash; discovered daily from the community.
        </p>
        <div className="mt-6 flex items-center justify-center gap-4">
          <a
            href="/browse"
            className="rounded-lg bg-[var(--accent)] px-5 py-2.5 text-sm font-medium text-white hover:opacity-90 transition-opacity"
          >
            Browse Resources
          </a>
          <span className="text-sm text-[var(--muted)]">
            {stats.total} resources and growing
          </span>
        </div>
      </section>

      {/* Categories */}
      <section className="mb-10">
        <CategoryNav />
      </section>

      {/* Latest Resources */}
      <section>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold">Latest Discoveries</h2>
          <a href="/browse" className="text-sm text-[var(--accent)] hover:underline">
            View all &rarr;
          </a>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {resources.map(resource => (
            <ResourceCard key={resource.id} resource={resource} />
          ))}
        </div>

        {resources.length === 0 && (
          <p className="text-center text-[var(--muted)] py-12">
            No resources yet. The pipeline is running &mdash; check back soon!
          </p>
        )}
      </section>

      {/* CTA */}
      <section className="my-16 text-center rounded-lg border border-[var(--border)] p-8">
        <h2 className="text-lg font-semibold mb-2">Found a Claude resource?</h2>
        <p className="text-sm text-[var(--muted)] mb-4">
          Tag <a href="https://x.com/claudelists" className="text-[var(--accent)] hover:underline" target="_blank" rel="noopener noreferrer">@claudelists</a> on Twitter and we&apos;ll add it to the directory.
        </p>
      </section>
    </div>
  );
}
