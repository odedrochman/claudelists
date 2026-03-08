import { createServerClient } from '../lib/supabase';
import { CATEGORIES } from '../lib/categories';

const BASE_URL = 'https://claudelists.com';

export default async function sitemap() {
  const supabase = createServerClient();
  const [{ data: resources }, { data: articles }] = await Promise.all([
    supabase
      .from('resources')
      .select('id, discovered_at')
      .eq('status', 'published')
      .order('discovered_at', { ascending: false }),
    supabase
      .from('articles')
      .select('slug, published_at')
      .eq('status', 'published')
      .order('published_at', { ascending: false }),
  ]);

  const resourceEntries = (resources || []).map((r) => ({
    url: `${BASE_URL}/resource/${r.id}`,
    lastModified: r.discovered_at || new Date().toISOString(),
    changeFrequency: 'monthly',
    priority: 0.6,
  }));

  const articleEntries = (articles || []).map((a) => ({
    url: `${BASE_URL}/digest/${a.slug}`,
    lastModified: a.published_at || new Date().toISOString(),
    changeFrequency: 'weekly',
    priority: 0.7,
  }));

  const categoryEntries = CATEGORIES.map((c) => ({
    url: `${BASE_URL}/category/${c.slug}`,
    lastModified: new Date().toISOString(),
    changeFrequency: 'weekly',
    priority: 0.7,
  }));

  return [
    { url: BASE_URL, lastModified: new Date().toISOString(), changeFrequency: 'daily', priority: 1 },
    { url: `${BASE_URL}/browse`, lastModified: new Date().toISOString(), changeFrequency: 'daily', priority: 0.9 },
    { url: `${BASE_URL}/digest`, lastModified: new Date().toISOString(), changeFrequency: 'daily', priority: 0.8 },
    { url: `${BASE_URL}/about`, lastModified: new Date().toISOString(), changeFrequency: 'monthly', priority: 0.5 },
    ...categoryEntries,
    ...articleEntries,
    ...resourceEntries,
  ];
}
