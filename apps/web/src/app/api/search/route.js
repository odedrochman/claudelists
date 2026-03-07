import { createServerClient } from '../../../lib/supabase';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q')?.trim();

  if (!q || q.length < 2) {
    return Response.json({ results: [] });
  }

  const supabase = createServerClient();

  // Use full-text search with websearch syntax
  const { data, error } = await supabase
    .from('resources')
    .select('id, title, summary, content_type, ai_quality_score, author_handle, categories(name, slug)')
    .eq('status', 'published')
    .textSearch('fts', q, { type: 'websearch' })
    .order('ai_quality_score', { ascending: false, nullsFirst: false })
    .limit(8);

  if (error) {
    // Fallback: if websearch parsing fails (e.g. special chars), do ilike search
    const { data: fallback } = await supabase
      .from('resources')
      .select('id, title, summary, content_type, ai_quality_score, author_handle, categories(name, slug)')
      .eq('status', 'published')
      .or(`title.ilike.%${q}%,summary.ilike.%${q}%,tweet_text.ilike.%${q}%`)
      .order('ai_quality_score', { ascending: false, nullsFirst: false })
      .limit(8);

    return Response.json({ results: fallback || [] });
  }

  return Response.json({ results: data || [] });
}
