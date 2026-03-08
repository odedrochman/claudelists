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

/**
 * Calculate the next occurrence of a time slot.
 * Morning = 9:00 AM, Evening = 5:00 PM (next occurrence).
 */
function getNextSlot(slot) {
  const now = new Date();
  const target = new Date(now);

  if (slot === 'morning') {
    target.setHours(9, 0, 0, 0);
    if (target <= now) target.setDate(target.getDate() + 1);
  } else if (slot === 'evening') {
    target.setHours(17, 0, 0, 0);
    if (target <= now) target.setDate(target.getDate() + 1);
  }

  return target.toISOString();
}

export async function PATCH(request, { params }) {
  if (!checkAdminKey(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const { action, notes, scheduledFor, slot } = body;

  if (!['publish_site', 'schedule_tweets', 'reject'].includes(action)) {
    return NextResponse.json({ error: 'Action must be publish_site, schedule_tweets, or reject' }, { status: 400 });
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

  // Schedule tweets (published -> scheduled for tweets)
  if (action === 'schedule_tweets') {
    if (article.status !== 'published') {
      return NextResponse.json({ error: 'Article must be published on site before scheduling tweets' }, { status: 400 });
    }

    let scheduled;
    if (slot === 'now') {
      scheduled = new Date().toISOString();
    } else if (scheduledFor) {
      scheduled = new Date(scheduledFor).toISOString();
    } else if (slot === 'morning' || slot === 'evening') {
      scheduled = getNextSlot(slot);
    } else {
      scheduled = new Date().toISOString();
    }

    const { error: updateError } = await supabase
      .from('articles')
      .update({
        scheduled_for: scheduled,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (updateError) {
      console.error('Article schedule tweets error:', updateError);
      return NextResponse.json({ error: 'Failed to schedule tweets' }, { status: 500 });
    }

    return NextResponse.json({ success: true, action: 'schedule_tweets', scheduled_for: scheduled });
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
