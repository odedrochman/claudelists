import { config } from 'dotenv';
config({ override: true });

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * Select resources not yet featured in any daily article.
 * Prioritizes highest quality scores, then newest.
 */
export async function selectDailyResources(count = 5) {
  const { data, error } = await supabase
    .from('resources')
    .select(`
      id, title, summary, tweet_text, tweet_url, author_handle, author_name,
      content_type, primary_url, expanded_links, has_downloadable,
      ai_quality_score, engagement, tweet_created_at, discovered_at,
      categories ( name, slug ),
      resource_tags ( tags ( name ) )
    `)
    .eq('featured_in_daily', false)
    .eq('status', 'published')
    .order('ai_quality_score', { ascending: false, nullsFirst: false })
    .order('discovered_at', { ascending: false })
    .limit(count);

  if (error) throw new Error(`Failed to fetch unfeatured resources: ${error.message}`);

  const resources = data || [];
  if (resources.length < 2) {
    console.log(`Only ${resources.length} unfeatured resources available (minimum 2 needed).`);
    return null;
  }

  return resources;
}

/**
 * Select daily articles and their resources for a given week range.
 * Used for weekly summary generation.
 */
export async function selectWeeklyResources(weekStart, weekEnd) {
  const { data: articles, error: artErr } = await supabase
    .from('articles')
    .select(`
      id, slug, title, content, article_type, published_at,
      article_resources ( resource_id, position )
    `)
    .eq('article_type', 'daily')
    .eq('status', 'published')
    .gte('published_at', weekStart)
    .lte('published_at', weekEnd)
    .order('published_at', { ascending: true });

  if (artErr) throw new Error(`Failed to fetch weekly articles: ${artErr.message}`);
  if (!articles || articles.length === 0) return null;

  // Collect all resource IDs from the daily articles
  const resourceIds = [];
  for (const article of articles) {
    for (const ar of (article.article_resources || [])) {
      if (!resourceIds.includes(ar.resource_id)) {
        resourceIds.push(ar.resource_id);
      }
    }
  }

  // Fetch full resource data
  const { data: resources, error: resErr } = await supabase
    .from('resources')
    .select(`
      id, title, summary, author_handle, author_name, content_type,
      primary_url, ai_quality_score, categories ( name, slug ),
      resource_tags ( tags ( name ) )
    `)
    .in('id', resourceIds);

  if (resErr) throw new Error(`Failed to fetch weekly resources: ${resErr.message}`);

  return { articles, resources: resources || [] };
}

/**
 * Select all articles and resources for a given month.
 * Used for monthly summary generation.
 */
export async function selectMonthlyResources(monthStart, monthEnd) {
  const { data: articles, error: artErr } = await supabase
    .from('articles')
    .select(`
      id, slug, title, content, article_type, published_at,
      article_resources ( resource_id, position )
    `)
    .eq('status', 'published')
    .gte('published_at', monthStart)
    .lte('published_at', monthEnd)
    .order('published_at', { ascending: true });

  if (artErr) throw new Error(`Failed to fetch monthly articles: ${artErr.message}`);
  if (!articles || articles.length === 0) return null;

  const dailyArticles = articles.filter(a => a.article_type === 'daily');
  const weeklyArticles = articles.filter(a => a.article_type === 'weekly');

  // Collect all resource IDs
  const resourceIds = [];
  for (const article of articles) {
    for (const ar of (article.article_resources || [])) {
      if (!resourceIds.includes(ar.resource_id)) {
        resourceIds.push(ar.resource_id);
      }
    }
  }

  const { data: resources, error: resErr } = await supabase
    .from('resources')
    .select(`
      id, title, summary, author_handle, author_name, content_type,
      primary_url, ai_quality_score, categories ( name, slug ),
      resource_tags ( tags ( name ) )
    `)
    .in('id', resourceIds);

  if (resErr) throw new Error(`Failed to fetch monthly resources: ${resErr.message}`);

  return { dailyArticles, weeklyArticles, resources: resources || [] };
}

/**
 * Mark resources as featured in a daily article.
 * Prevents them from being selected again for daily articles.
 * Weekly/monthly can still reference them.
 */
export async function markResourcesFeatured(resourceIds) {
  const { error } = await supabase
    .from('resources')
    .update({
      featured_in_daily: true,
      featured_daily_at: new Date().toISOString(),
    })
    .in('id', resourceIds);

  if (error) {
    console.warn('Failed to mark resources as featured:', error.message);
  }
}

/**
 * Save an article draft to the database.
 */
export async function saveArticleDraft(article, resourceIds) {
  const { data, error } = await supabase
    .from('articles')
    .insert({
      slug: article.slug,
      title: article.title,
      article_type: article.articleType,
      content: article.content,
      tweet_thread: article.tweetThread,
      promo_tweet: article.promoTweet,
      meta_description: article.metaDescription,
      og_title: article.ogTitle,
      period_start: article.periodStart || null,
      period_end: article.periodEnd || null,
      status: 'draft',
    })
    .select('id')
    .single();

  if (error) throw new Error(`Failed to save article draft: ${error.message}`);

  // Insert article_resources junction rows
  if (resourceIds && resourceIds.length > 0) {
    const junctionRows = resourceIds.map((rid, i) => ({
      article_id: data.id,
      resource_id: rid,
      position: i,
    }));

    const { error: jErr } = await supabase
      .from('article_resources')
      .insert(junctionRows);

    if (jErr) console.warn('Failed to link resources to article:', jErr.message);
  }

  return data.id;
}
