import { NextResponse } from 'next/server';
import { createServiceClient } from '../../../../lib/supabase';

function checkAdminKey(request) {
  const { searchParams } = new URL(request.url);
  const key = searchParams.get('key');
  if (!key || key !== process.env.ADMIN_SECRET_KEY) {
    return false;
  }
  return true;
}

export async function GET(request) {
  if (!checkAdminKey(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status') || 'draft';

  const supabase = createServiceClient();

  let query = supabase
    .from('articles')
    .select(`
      id, slug, title, article_type, content, status, scheduled_for,
      published_at, reviewer_notes, meta_description, og_title,
      thread_url, promo_tweet_url, created_at, updated_at,
      article_resources ( resource_id )
    `)
    .order('created_at', { ascending: false });

  if (status !== 'all') {
    query = query.eq('status', status);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Admin articles fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch articles' }, { status: 500 });
  }

  // Add resource count
  const articles = (data || []).map(a => ({
    ...a,
    resourceCount: (a.article_resources || []).length,
  }));

  return NextResponse.json({ articles });
}
