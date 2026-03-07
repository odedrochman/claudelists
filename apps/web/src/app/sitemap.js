import { createServerClient } from '../lib/supabase';
import { CATEGORIES } from '../lib/categories';

const BASE_URL = 'https://claudelists.com';

export default async function sitemap() {
  const supabase = createServerClient();
  const { data: resources } = await supabase
    .from('resources')
    .select('id, discovered_at')
    .eq('status', 'published')
    .order('discovered_at', { ascending: false });

  const resourceEntries = (resources || []).map((r) => ({
    url: `${BASE_URL}/resource/${r.id}`,
    lastModified: r.discovered_at || new Date().toISOString(),
  }));

  const categoryEntries = CATEGORIES.map((c) => ({
    url: `${BASE_URL}/category/${c.slug}`,
    lastModified: new Date().toISOString(),
  }));

  return [
    { url: BASE_URL, lastModified: new Date().toISOString(), changeFrequency: 'daily', priority: 1 },
    { url: `${BASE_URL}/browse`, lastModified: new Date().toISOString(), changeFrequency: 'daily', priority: 0.9 },
    { url: `${BASE_URL}/about`, lastModified: new Date().toISOString(), changeFrequency: 'monthly', priority: 0.5 },
    ...categoryEntries,
    ...resourceEntries,
  ];
}
