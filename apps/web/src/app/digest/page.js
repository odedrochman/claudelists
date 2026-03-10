import { createServerClient } from '../../lib/supabase';
import ArticleCard from '../../components/ArticleCard';
import FadeIn from '../../components/animations/FadeIn';
import { StaggerContainer, StaggerItem } from '../../components/animations/StaggerChildren';

export const revalidate = 300;

export const metadata = {
  title: 'Digest - ClaudeLists',
  description: 'Curated digests of the Claude ecosystem. Daily picks, weekly roundups, and monthly summaries of the best Claude resources.',
  alternates: {
    canonical: 'https://claudelists.com/digest',
  },
  openGraph: {
    title: 'Digest - ClaudeLists',
    description: 'Curated digests of the Claude ecosystem. Daily picks, weekly roundups, and monthly summaries.',
  },
};

async function getArticles(type) {
  const supabase = createServerClient();

  let query = supabase
    .from('articles')
    .select(`
      id, slug, title, article_type, content, meta_description,
      published_at, article_resources ( resource_id )
    `)
    .eq('status', 'published')
    .order('published_at', { ascending: false })
    .limit(50);

  if (type && type !== 'all') {
    query = query.eq('article_type', type);
  }

  const { data } = await query;
  return data || [];
}

export default async function ArticlesPage({ searchParams }) {
  const { type } = await searchParams;
  const filterType = type || 'all';
  const articles = await getArticles(filterType);

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <section className="py-10">
        <FadeIn>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Digest</h1>
              <p className="text-sm text-[var(--muted)] mt-1">
                Curated coverage of the Claude ecosystem, updated daily.
              </p>
            </div>
          </div>
        </FadeIn>

        {/* Type filter */}
        <div className="flex gap-2 mb-8">
          {['all', 'daily', 'weekly', 'monthly', 'editorial'].map((t) => (
            <a
              key={t}
              href={`/digest${t === 'all' ? '' : `?type=${t}`}`}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                filterType === t
                  ? 'bg-[var(--accent)] text-white'
                  : 'bg-[var(--surface)] text-[var(--muted)] border border-[var(--border)] hover:bg-[var(--surface-alt)]'
              }`}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </a>
          ))}
        </div>

        {articles.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-[var(--muted)] text-lg">No digests yet. Check back soon!</p>
          </div>
        ) : (
          <StaggerContainer className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {articles.map((article) => (
              <StaggerItem key={article.id}>
                <ArticleCard article={article} />
              </StaggerItem>
            ))}
          </StaggerContainer>
        )}
      </section>
    </div>
  );
}
