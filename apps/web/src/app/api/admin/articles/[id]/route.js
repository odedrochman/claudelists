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

  if (!['publish_site', 'reject', 'update'].includes(action)) {
    return NextResponse.json({ error: 'Action must be publish_site, reject, or update' }, { status: 400 });
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

  // Update draft content
  if (action === 'update') {
    if (article.status !== 'draft') {
      return NextResponse.json({ error: 'Only draft articles can be edited' }, { status: 400 });
    }

    const { content, title: newTitle, meta_description, article_type, og_quote } = body;
    const updates = { updated_at: new Date().toISOString() };
    if (content !== undefined) updates.content = content;
    if (newTitle !== undefined) updates.title = newTitle;
    if (meta_description !== undefined) updates.meta_description = meta_description;
    if (article_type !== undefined) updates.article_type = article_type;
    if (og_quote !== undefined) updates.og_quote = og_quote;

    const { error: updateError } = await supabase
      .from('articles')
      .update(updates)
      .eq('id', id);

    if (updateError) {
      console.error('Article update error:', updateError);
      return NextResponse.json({ error: 'Failed to update article' }, { status: 500 });
    }

    return NextResponse.json({ success: true, action: 'update' });
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

    // Reset featured_in_daily on linked resources so they're available for future digests
    const { data: linkedResources } = await supabase
      .from('article_resources')
      .select('resource_id')
      .eq('article_id', id);

    if (linkedResources && linkedResources.length > 0) {
      const resourceIds = linkedResources.map(r => r.resource_id);
      const { error: resetError } = await supabase
        .from('resources')
        .update({ featured_in_daily: false, featured_daily_at: null })
        .in('id', resourceIds);

      if (resetError) {
        console.warn('Failed to reset featured_in_daily on rejected article resources:', resetError.message);
      }
    }

    return NextResponse.json({ success: true, action: 'reject' });
  }
}
