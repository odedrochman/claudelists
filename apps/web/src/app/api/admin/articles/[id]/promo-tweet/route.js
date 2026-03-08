import { NextResponse } from 'next/server';
import { createServiceClient } from '../../../../../../lib/supabase';

function checkAdminKey(request) {
  const { searchParams } = new URL(request.url);
  const key = searchParams.get('key');
  if (!key || key !== process.env.ADMIN_SECRET_KEY) {
    return false;
  }
  return true;
}

// Fetch author handles from article resources
async function getArticleAuthors(supabase, articleId) {
  const { data: articleResources } = await supabase
    .from('article_resources')
    .select('resource_id')
    .eq('article_id', articleId);

  if (!articleResources || articleResources.length === 0) return [];

  const resourceIds = articleResources.map(ar => ar.resource_id);
  const { data: resources } = await supabase
    .from('resources')
    .select('author_handle')
    .in('id', resourceIds);

  if (!resources) return [];

  const handles = [...new Set(
    resources
      .map(r => r.author_handle)
      .filter(h => h && h.toLowerCase() !== 'claudelists')
  )];

  return handles;
}

// Format promo tweet following the checklist
async function formatPromoTweet(supabase, article, xArticleUrl) {
  const digestUrl = `https://claudelists.com/digest/${article.slug}`;
  const authors = await getArticleAuthors(supabase, article.id);

  const resourceMatches = [...(article.content || '').matchAll(/##\s*\[([^\]]+)\]\(([^)]+)\)/g)];
  const count = resourceMatches.length;

  const lines = [];

  // Persona G: loss aversion + social proof
  lines.push(article.title);
  lines.push('');
  if (count > 0) {
    const hooks = [
      `${count} resources your timeline already knows about. Catch up.`,
      `${count} drops the Claude power users found this week. You're behind.`,
      `The people shipping faster than you found these ${count} resources. Now you can too.`,
      `${count} picks separating "I use Claude" from "I ship with Claude."`,
      `Your competitors bookmarked these ${count} resources yesterday. Your move.`,
    ];
    lines.push(hooks[Math.floor(Math.random() * hooks.length)]);
  }

  if (authors.length > 0) {
    lines.push('');
    lines.push('Featuring ' + authors.map(h => `@${h}`).join(' '));
  }

  lines.push('');
  lines.push(digestUrl);

  if (xArticleUrl) {
    lines.push('');
    lines.push(`Full article: ${xArticleUrl}`);
  }

  lines.push('');
  lines.push('Tag @claudelists to get featured');

  lines.push('');
  lines.push('#Claude #AI #ClaudeCode');

  return { text: lines.join('\n'), authors, resourceCount: count };
}

export async function POST(request, { params }) {
  if (!checkAdminKey(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const { action, xArticleUrl } = body;

  if (!['preview', 'post'].includes(action)) {
    return NextResponse.json({ error: 'Action must be preview or post' }, { status: 400 });
  }

  const supabase = createServiceClient();

  // Fetch the article
  const { data: article, error: fetchError } = await supabase
    .from('articles')
    .select('*')
    .eq('id', id)
    .single();

  if (fetchError || !article) {
    return NextResponse.json({ error: 'Article not found' }, { status: 404 });
  }

  if (article.status !== 'published') {
    return NextResponse.json({ error: 'Article must be published on site first' }, { status: 400 });
  }

  // Preview: return formatted promo tweet text
  if (action === 'preview') {
    const { text, authors, resourceCount } = await formatPromoTweet(supabase, article, xArticleUrl);
    return NextResponse.json({
      success: true,
      text,
      charCount: text.length,
      authors,
      resourceCount,
    });
  }

  // Post: upload OG image, post tweet, save URL
  if (action === 'post') {
    if (article.thread_url) {
      return NextResponse.json({ error: `Already posted: ${article.thread_url}` }, { status: 400 });
    }

    const { text } = await formatPromoTweet(supabase, article, xArticleUrl);

    // Dynamic import twitter-api-v2 (only needed for posting)
    const { TwitterApi } = await import('twitter-api-v2');

    const client = new TwitterApi({
      appKey: process.env.TWITTER_API_KEY,
      appSecret: process.env.TWITTER_API_SECRET,
      accessToken: process.env.TWITTER_ACCESS_TOKEN,
      accessSecret: process.env.TWITTER_ACCESS_SECRET,
    });

    // Download OG image and upload as media
    let mediaId = null;
    try {
      const ogUrl = `https://claudelists.com/digest/${article.slug}/opengraph-image`;
      const ogResponse = await fetch(ogUrl);
      if (ogResponse.ok) {
        const buffer = Buffer.from(await ogResponse.arrayBuffer());
        mediaId = await client.v1.uploadMedia(buffer, { mimeType: 'image/png' });
      }
    } catch (e) {
      console.warn(`Could not attach OG image: ${e.message}`);
    }

    // Post the tweet
    const tweetPayload = { text };
    if (mediaId) {
      tweetPayload.media = { media_ids: [mediaId] };
    }

    try {
      const result = await client.v2.tweet(tweetPayload);
      const tweetId = result.data.id;

      // Get username for URL
      const me = await client.v2.me();
      const tweetUrl = `https://x.com/${me.data.username}/status/${tweetId}`;

      // Save to article
      const { error: updateError } = await supabase
        .from('articles')
        .update({
          thread_url: tweetUrl,
          updated_at: new Date().toISOString(),
        })
        .eq('id', article.id);

      if (updateError) {
        console.error('Failed to save tweet URL:', updateError.message);
      }

      return NextResponse.json({
        success: true,
        tweetUrl,
        tweetId,
      });
    } catch (e) {
      console.error('Twitter post failed:', e);
      return NextResponse.json({ error: `Twitter post failed: ${e.message}` }, { status: 500 });
    }
  }
}
