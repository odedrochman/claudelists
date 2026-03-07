import { config } from 'dotenv';
config({ override: true });

import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';
import { birdCommand } from './fetch-bookmarks.js';

const anthropic = new Anthropic();
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const MAX_TWEET_LENGTH = 280;

// ── Fetch un-posted resources ────────────────────────────────────

async function getUnpostedResources(limit = 5) {
  const { data, error } = await supabase
    .from('resources')
    .select(`
      id, title, summary, tweet_url, author_handle,
      content_type, primary_url, has_downloadable,
      categories ( name, slug )
    `)
    .eq('posted_to_twitter', false)
    .eq('status', 'published')
    .order('discovered_at', { ascending: true })
    .limit(limit);

  if (error) throw new Error(`Failed to fetch un-posted resources: ${error.message}`);
  return data || [];
}

// ── Generate tweet via Claude ────────────────────────────────────

async function generateTweet(resources) {
  const resourceList = resources.map(r => ({
    title: r.title,
    summary: r.summary,
    category: r.categories?.name || 'Unknown',
    author: r.author_handle,
    url: r.primary_url || r.tweet_url,
    hasDownload: r.has_downloadable,
  }));

  const prompt = `You write tweets for @claudelists, a curated directory of Claude ecosystem resources.

Generate a tweet thread (1-3 tweets) highlighting these newly discovered resources:

${JSON.stringify(resourceList, null, 2)}

Rules:
- Each tweet must be under ${MAX_TWEET_LENGTH} characters
- First tweet: engaging hook about what's new + 1-2 highlights
- Credit original authors with @mentions when possible
- Include 2-3 relevant hashtags from: #Claude #ClaudeCode #MCP #AI #AnthropicAI #AITools #LLM #AgentSDK
- Last tweet MUST end with: "Tag @claudelists with Claude resources you discover! 🔍"
- Use emojis sparingly (1-2 per tweet max)
- Link to claudelists.com for browsing all resources
- If a resource has a downloadable .md file, mention it's available for download
- Be concise, informative, not hype-y

Return ONLY a JSON array of tweet strings. No markdown fences, no explanation.`;

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = response.content[0].text.trim();
  const json = text.replace(/^```json?\n?/, '').replace(/\n?```$/, '');
  return JSON.parse(json);
}

// ── Post tweet thread via bird CLI ───────────────────────────────

async function postTweetThread(tweets) {
  const env = {
    TWITTER_AUTH_TOKEN: process.env.CL_TWITTER_AUTH_TOKEN,
    TWITTER_CT0: process.env.CL_TWITTER_CT0,
  };

  let lastTweetId = null;
  const postedTweets = [];

  for (const tweet of tweets) {
    const args = ['tweet', tweet];
    if (lastTweetId) {
      args.push('--reply-to', lastTweetId);
    }

    const output = await birdCommand(args, env);

    // Try to extract tweet ID from output
    const idMatch = output.match(/(\d{15,})/);
    if (idMatch) {
      lastTweetId = idMatch[1];
    }

    const urlMatch = output.match(/(https:\/\/(?:twitter\.com|x\.com)\/\S+)/);
    postedTweets.push({
      text: tweet,
      id: lastTweetId,
      url: urlMatch ? urlMatch[1] : null,
    });
  }

  return postedTweets;
}

// ── Mark resources as posted ─────────────────────────────────────

async function markAsPosted(resourceIds) {
  const { error } = await supabase
    .from('resources')
    .update({
      posted_to_twitter: true,
      posted_at: new Date().toISOString(),
    })
    .in('id', resourceIds);

  if (error) {
    console.warn('Failed to mark resources as posted:', error.message);
  }
}

async function recordAutoPost(tweetData, resourceIds, content) {
  const { error } = await supabase.from('auto_posts').insert({
    tweet_id: tweetData[0]?.id || null,
    tweet_url: tweetData[0]?.url || null,
    resource_ids: resourceIds,
    content: content,
    status: 'posted',
    posted_at: new Date().toISOString(),
  });

  if (error) {
    console.warn('Failed to record auto-post:', error.message);
  }
}

// ── Main auto-post function ──────────────────────────────────────

export async function autoPost(options = {}) {
  const resources = await getUnpostedResources(options.limit || 5);

  if (resources.length === 0) {
    console.log('No new resources to post.');
    return { posted: false, reason: 'no_new_resources' };
  }

  console.log(`Found ${resources.length} un-posted resources. Generating tweet...`);

  const tweets = await generateTweet(resources);
  console.log(`Generated ${tweets.length}-tweet thread:`);
  tweets.forEach((t, i) => console.log(`  [${i + 1}] (${t.length} chars) ${t}`));

  if (options.dryRun) {
    console.log('[DRY RUN] Would post the above thread.');
    return { posted: false, reason: 'dry_run', tweets };
  }

  // Check for @claudelists posting credentials
  if (!process.env.CL_TWITTER_AUTH_TOKEN || !process.env.CL_TWITTER_CT0) {
    console.warn('Missing CL_TWITTER_AUTH_TOKEN or CL_TWITTER_CT0. Cannot post.');
    return { posted: false, reason: 'missing_credentials', tweets };
  }

  console.log('Posting tweet thread...');
  const postedTweets = await postTweetThread(tweets);

  const resourceIds = resources.map(r => r.id);
  await markAsPosted(resourceIds);
  await recordAutoPost(postedTweets, resourceIds, tweets.join('\n---\n'));

  console.log(`Posted ${postedTweets.length}-tweet thread. First tweet: ${postedTweets[0]?.url || 'unknown'}`);
  return { posted: true, tweets: postedTweets, resourceCount: resources.length };
}
