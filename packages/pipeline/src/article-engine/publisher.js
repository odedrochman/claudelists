import { config } from 'dotenv';
config({ override: true });

import { createClient } from '@supabase/supabase-js';
import { postTweet, postThread } from '../twitter-client.js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const SITE_URL = 'https://claudelists.com';

/**
 * Replace {{ARTICLE_URL}} placeholder in text with the actual article URL.
 */
function replaceArticleUrl(text, slug) {
  const articleUrl = `${SITE_URL}/digest/${slug}`;
  return text.replace(/\{\{ARTICLE_URL\}\}/g, articleUrl);
}

/**
 * Post tweets for a published article: thread + promo tweet, update DB.
 * Two-phase flow:
 *   1. Article is already published on the site (status=published, published_at set)
 *   2. This function posts the tweets and stores tweet IDs/URLs
 */
export async function publishArticle(articleId) {
  // Fetch the article
  const { data: article, error } = await supabase
    .from('articles')
    .select('*')
    .eq('id', articleId)
    .single();

  if (error || !article) {
    throw new Error(`Article not found: ${articleId}`);
  }

  if (article.status !== 'published') {
    throw new Error(`Article ${articleId} must be published on site first (status: ${article.status})`);
  }

  if (article.thread_url) {
    throw new Error(`Article ${articleId} already has tweets posted`);
  }

  console.log(`Posting tweets for: "${article.title}" (${article.slug})`);

  // Check Twitter credentials
  if (!process.env.TWITTER_API_KEY || !process.env.TWITTER_ACCESS_TOKEN) {
    throw new Error('Missing Twitter API credentials. Cannot post tweets.');
  }

  // 1. Post the tweet thread
  let threadResult = null;
  const tweetThread = article.tweet_thread || [];

  if (tweetThread.length > 0) {
    const processedThread = tweetThread.map(t => replaceArticleUrl(t, article.slug));
    console.log(`Posting thread (${processedThread.length} tweets)...`);
    threadResult = await postThread(processedThread);
    console.log(`Thread posted: ${threadResult.url}`);

    // Store thread data
    await supabase
      .from('articles')
      .update({
        thread_tweet_ids: threadResult.tweets.map(t => t.id),
        thread_url: threadResult.url,
        updated_at: new Date().toISOString(),
      })
      .eq('id', articleId);
  }

  // 2. Wait 30 seconds to avoid rate limits
  if (article.promo_tweet) {
    console.log('Waiting 30 seconds before posting promo tweet...');
    await new Promise(r => setTimeout(r, 30000));

    // 3. Post the promo tweet
    const promoText = replaceArticleUrl(article.promo_tweet, article.slug);
    console.log('Posting promo tweet...');
    const promoResult = await postTweet(promoText);
    console.log(`Promo tweet posted: ${promoResult.url}`);

    await supabase
      .from('articles')
      .update({
        promo_tweet_id: promoResult.id,
        promo_tweet_url: promoResult.url,
      })
      .eq('id', articleId);
  }

  // Clear scheduled_for now that tweets are posted
  await supabase
    .from('articles')
    .update({ scheduled_for: null })
    .eq('id', articleId);

  console.log(`Tweets posted for: ${SITE_URL}/digest/${article.slug}`);

  return {
    success: true,
    articleUrl: `${SITE_URL}/digest/${article.slug}`,
    threadUrl: threadResult?.url || null,
  };
}
