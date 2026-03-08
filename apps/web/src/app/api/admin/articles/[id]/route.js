import { NextResponse } from 'next/server';
import { createServiceClient } from '../../../../../lib/supabase';

function checkAdminKey(request) {
  const { searchParams } = new URL(request.url);
  const key = searchParams.get('key');
  if (!key || key !== process.env.ADMIN_SECRET_KEY) {
    return false;
  }
  return true;
}

export async function PATCH(request, { params }) {
  if (!checkAdminKey(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const { action, notes } = body;

  if (!['publish_site', 'reject'].includes(action)) {
    return NextResponse.json({ error: 'Action must be publish_site or reject' }, { status: 400 });
  }

  const supabase = createServiceClient();

  // Fetch the article
  const { data: article, error: fetchError } = await supabase
    .from('articles')
    .select('id, title, slug, status')
    .eq('id', id)
    .single();

  if (fetchError || !article) {
    return NextResponse.json({ error: 'Article not found' }, { status: 404 });
  }

  // Publish to site (draft -> published)
  if (action === 'publish_site') {
    if (article.status !== 'draft') {
      return NextResponse.json({ error: 'Only draft articles can be published' }, { status: 400 });
    }

    const { error: updateError } = await supabase
      .from('articles')
      .update({
        status: 'published',
        published_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (updateError) {
      console.error('Article publish error:', updateError);
      return NextResponse.json({ error: 'Failed to publish article' }, { status: 500 });
    }

    return NextResponse.json({ success: true, action: 'publish_site', slug: article.slug });
  }

  // Reject (draft -> rejected)
  if (action === 'reject') {
    const { error: updateError } = await supabase
      .from('articles')
      .update({
        status: 'rejected',
        reviewer_notes: notes || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (updateError) {
      console.error('Article reject error:', updateError);
      return NextResponse.json({ error: 'Failed to reject article' }, { status: 500 });
    }

    return NextResponse.json({ success: true, action: 'reject' });
  }
}
