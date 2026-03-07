import { createServerClient } from '../../../lib/supabase';
import { CATEGORIES } from '../../../lib/categories';
import ResourceCard from '../../../components/ResourceCard';
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

async function getCategoryResources(slug) {
  const supabase = createServerClient();
  const { data } = await supabase
    .from('resources')
    .select('*, categories!inner(name, slug), resource_tags(tags(name))')
    .eq('categories.slug', slug)
    .eq('status', 'published')
    .order('discovered_at', { ascending: false })
    .limit(50);
  return data || [];
}

export const revalidate = 300;

export default async function CategoryPage({ params }) {
  const { slug } = await params;
  const category = CATEGORIES.find(c => c.slug === slug);
  const resources = await getCategoryResources(slug);

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

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {resources.map(resource => (
          <ResourceCard key={resource.id} resource={resource} />
        ))}
      </div>

      {resources.length === 0 && (
        <p className="text-center text-[var(--muted)] py-12">
          No resources in this category yet.
        </p>
      )}
    </div>
  );
}
