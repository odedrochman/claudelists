import { NextResponse } from 'next/server';
import { createServiceClient } from '../../../../../lib/supabase';
import { postTweet } from '../../../../../lib/twitter';

function checkAdminKey(request) {
  const { searchParams } = new URL(request.url);
  const key = searchParams.get('key');
  return key && key === process.env.ADMIN_SECRET_KEY;
}

// ── Resolve category ID ───────────────────────────────────────────

async function resolveCategoryId(supabase, categoryName) {
  const { data } = await supabase
    .from('categories')
    .select('id')
    .eq('name', categoryName)
    .single();

  if (data) return data.id;

  // Fallback to Discussion & Opinion
  const { data: fallback } = await supabase
    .from('categories')
    .select('id')
    .eq('name', 'Discussion & Opinion')
    .single();

  return fallback?.id;
}

// ── Resolve tag (find or create) ──────────────────────────────────

async function resolveTag(supabase, tagName) {
  const { data: existing } = await supabase
    .from('tags')
    .select('id')
    .eq('name', tagName)
    .single();

  if (existing) return existing.id;

  const { data: created, error } = await supabase
    .from('tags')
    .insert({ name: tagName, usage_count: 1 })
    .select('id')
    .single();

  if (error) {
    // Race condition fallback
    const { data: retry } = await supabase
      .from('tags')
      .select('id')
      .eq('name', tagName)
      .single();
    return retry?.id;
  }

  return created.id;
}

// ── POST: Approve content, post tweet, save resource ──────────────

export async function POST(request) {
  if (!checkAdminKey(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { title, summary, category, tags, ai_quality_score, tweet_text, source_url, url_type, author } = body;

  if (!title || !tweet_text || !source_url) {
    return NextResponse.json({ error: 'title, tweet_text, and source_url are required' }, { status: 400 });
  }

  const supabase = createServiceClient();

  // Step 1: Post the tweet
  let tweetData;
  try {
    tweetData = await postTweet(tweet_text);
  } catch (e) {
    console.error('Failed to post tweet:', e);
    return NextResponse.json({ error: 'Failed to post tweet', details: e.message }, { status: 500 });
  }

  // Step 2: Resolve category
  const categoryId = await resolveCategoryId(supabase, category || 'Discussion & Opinion');

  // Step 3: Insert resource
  const resourceRow = {
    tweet_id: tweetData.id,
    title,
    summary: summary || '',
    tweet_text,
    tweet_url: tweetData.url,
    author_handle: tweetData.username,
    author_name: tweetData.username,
    content_type: url_type === 'github' ? 'github_repo' : (url_type || 'article'),
    category_id: categoryId,
    primary_url: source_url,
    expanded_links: [source_url],
    extracted_content: { source: 'add-content', original_author: author },
    engagement: { replies: 0, retweets: 0, likes: 0 },
    is_thread: false,
    is_duplicate: false,
    ai_quality_score: ai_quality_score || 5,
    posted_to_twitter: true,
    posted_at: new Date().toISOString(),
    tweet_created_at: new Date().toISOString(),
    status: 'published',
  };

  const { data: resource, error: insertError } = await supabase
    .from('resources')
    .insert(resourceRow)
    .select('id')
    .single();

  if (insertError) {
    console.error('Failed to insert resource:', insertError);
    return NextResponse.json({
      error: 'Tweet was posted but resource insert failed',
      tweet: tweetData,
      details: insertError.message,
    }, { status: 500 });
  }

  // Step 4: Resolve and link tags
  const linkedTags = [];
  for (const tagName of (tags || [])) {
    try {
      const tagId = await resolveTag(supabase, tagName);
      if (tagId) {
        await supabase.from('resource_tags').insert({ resource_id: resource.id, tag_id: tagId });
        linkedTags.push(tagName);
      }
    } catch (e) {
      console.warn(`Failed to link tag "${tagName}":`, e.message);
    }
  }

  return NextResponse.json({
    success: true,
    resource: { id: resource.id, title },
    tweet: tweetData,
    tags: linkedTags,
  });
}
