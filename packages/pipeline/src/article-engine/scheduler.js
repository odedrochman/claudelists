import { config } from 'dotenv';
config({ override: true });

import { createClient } from '@supabase/supabase-js';
import { publishArticle } from './publisher.js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * Check for published articles with scheduled tweets that are due and post them.
 * Two-phase flow: articles are already published on site, this posts tweets.
 * Meant to be called on a cron schedule (every 15 minutes).
 */
export async function checkAndPublish() {
  const now = new Date().toISOString();

  // Find published articles with scheduled_for in the past and no tweets yet
  const { data: dueArticles, error } = await supabase
    .from('articles')
    .select('id, title, slug, scheduled_for')
    .eq('status', 'published')
    .not('scheduled_for', 'is', null)
    .is('thread_url', null)
    .lte('scheduled_for', now)
    .order('scheduled_for', { ascending: true });

  if (error) {
    console.error('Failed to check scheduled articles:', error.message);
    return { published: 0, errors: [error.message] };
  }

  if (!dueArticles || dueArticles.length === 0) {
    console.log('No articles due for tweet posting.');
    return { published: 0, errors: [] };
  }

  console.log(`Found ${dueArticles.length} article(s) due for tweet posting.`);

  let published = 0;
  const errors = [];

  for (const article of dueArticles) {
    try {
      console.log(`\nPosting tweets for: "${article.title}" (scheduled for ${article.scheduled_for})`);
      await publishArticle(article.id);
      published++;
    } catch (e) {
      console.error(`Failed to post tweets for "${article.title}":`, e.message);
      errors.push(`${article.title}: ${e.message}`);

      // Clear scheduled_for and add notes so admin can re-try
      await supabase
        .from('articles')
        .update({
          scheduled_for: null,
          reviewer_notes: `Tweet posting failed: ${e.message}`,
        })
        .eq('id', article.id);
    }
  }

  console.log(`\nScheduler done: ${published} tweeted, ${errors.length} errors.`);
  return { published, errors };
}
