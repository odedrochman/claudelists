import { NextResponse } from 'next/server';
import { createServiceClient } from '../../../../lib/supabase';

/**
 * Vercel Cron endpoint to check and publish scheduled articles.
 * Protected by CRON_SECRET.
 * Schedule: every 15 minutes.
 */
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get('secret') || request.headers.get('authorization')?.replace('Bearer ', '');

  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServiceClient();
  const now = new Date().toISOString();

  const { data: dueArticles, error } = await supabase
    .from('articles')
    .select('id, title, slug, scheduled_for')
    .eq('status', 'scheduled')
    .lte('scheduled_for', now)
    .order('scheduled_for', { ascending: true });

  if (error) {
    console.error('Schedule check error:', error.message);
    return NextResponse.json({ error: 'Failed to check schedule' }, { status: 500 });
  }

  if (!dueArticles || dueArticles.length === 0) {
    return NextResponse.json({ message: 'No articles due', published: 0 });
  }

  // For each due article, mark as published.
  // Note: Actual Twitter posting is done via the pipeline CLI (scheduler.js).
  // This endpoint just marks articles as published for the site.
  let published = 0;
  const errors = [];

  for (const article of dueArticles) {
    const { error: updateErr } = await supabase
      .from('articles')
      .update({
        status: 'published',
        published_at: new Date().toISOString(),
      })
      .eq('id', article.id);

    if (updateErr) {
      errors.push(`${article.title}: ${updateErr.message}`);
    } else {
      published++;
    }
  }

  return NextResponse.json({ published, errors, total: dueArticles.length });
}
