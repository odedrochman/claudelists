import { createServerClient } from '../../../lib/supabase';
import { NextResponse } from 'next/server';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q');
  const category = searchParams.get('category');
  const contentType = searchParams.get('type');
  const page = parseInt(searchParams.get('page') || '1', 10);
  const limit = Math.min(parseInt(searchParams.get('limit') || '24', 10), 100);
  const offset = (page - 1) * limit;

  const supabase = createServerClient();

  let query = supabase
    .from('resources')
    .select('*, categories(name, slug)', { count: 'exact' })
    .eq('status', 'published')
    .order('discovered_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (q) {
    query = query.textSearch('fts', q, { type: 'websearch' });
  }
  if (category) {
    query = query.eq('categories.slug', category);
  }
  if (contentType) {
    query = query.eq('content_type', contentType);
  }

  const { data, count, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    resources: data,
    total: count,
    page,
    pageSize: limit,
    totalPages: Math.ceil((count || 0) / limit),
  });
}
