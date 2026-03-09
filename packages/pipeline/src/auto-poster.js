import { config } from 'dotenv';
config({ override: true });

import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';
import { postTweet } from './twitter-client.js';

const anthropic = new Anthropic();
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ── Fetch un-posted resources ────────────────────────────────────

async function getUnpostedResources(limit = 20) {
  const { data, error } = await supabase
    .from('resources')
    .select(`
      id, title, summary, tweet_url, author_handle,
      content_type, primary_url, has_downloadable,
      engagement,
      categories ( name, slug )
    `)
    .eq('posted_to_twitter', false)
    .eq('status', 'published')
    .order('discovered_at', { ascending: true })
    .limit(limit);

  if (error) throw new Error(`Failed to fetch un-posted resources: ${error.message}`);
  return data || [];
}

// ── Generate long-form post via Claude ───────────────────────────

async function generateLongPost(resources) {
  const resourceList = resources.map(r => ({
    title: r.title,
    summary: r.summary,
    category: r.categories?.name || 'Unknown',
    author: r.author_handle ? `@${r.author_handle}` : null,
    url: r.primary_url || r.tweet_url,
    hasDownload: r.has_downloadable,
    contentType: r.content_type,
    engagement: r.engagement,
  }));

  // Group by category for better structure
  const byCategory = {};
  for (const r of resourceList) {
    if (!byCategory[r.category]) byCategory[r.category] = [];
    byCategory[r.category].push(r);
  }

  const prompt = `You write long-form Twitter posts for @claudelists, a curated directory of Claude & AI ecosystem resources at claudelists.com.

Generate a SINGLE long-form Twitter post (Twitter Premium allows up to 4000 characters) that announces these newly discovered resources:

${JSON.stringify(resourceList, null, 2)}

Grouped by category:
${JSON.stringify(byCategory, null, 2)}

TONE (Persona G: Loss Aversion + Social Proof):
- Imply the reader is missing out on what others already know or use
- Frame inaction as a cost. Use "you" directly
- Short, punchy, slightly spicy. Not mean, but makes you feel behind
- Examples of the voice:
  "84K devs already know about X. You probably don't. Fix that."
  "The difference between 'Claude is okay' and 'Claude is incredible' is usually 5 lines in your CLAUDE.md."
  "The Claude power users in your timeline are all running MCP servers. The rest are wondering why their setup feels slow."

Rules:
- Open with a Persona G hook that makes the reader feel behind (NOT generic "new resources just dropped" energy)
- Organize by category with clear section headers using emoji
- For each resource: one punchy line with title + why it matters + @mention of original author. Keep the loss-aversion tone per item too.
- Tag ALL original authors with @mentions
- End with: visit claudelists.com and tag @claudelists with Claude resources
- Add 3-5 relevant hashtags at the end from: #Claude #ClaudeCode #MCP #AI #AnthropicAI #AITools #LLM #AgentSDK #Anthropic
- Keep it scannable. Use line breaks, emojis for section headers, bullet-style formatting
- If a resource has a downloadable .md file, mention it briefly
- Never use em dashes
- Stay under 4000 characters total (Twitter Premium long post limit)
- Do NOT use markdown formatting (no **, no ##, no []()). Plain text with emojis and line breaks only.

Return ONLY the post text. No JSON, no markdown fences, no explanation.`;

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2048,
    messages: [{ role: 'user', content: prompt }],
  });

  return response.content[0].text.trim();
}

// ── Post tweet via Twitter API ───────────────────────────────────

async function postLongTweet(text) {
  console.log(`Posting tweet (${text.length} chars) via Twitter API...`);
  const result = await postTweet(text);
  return result;
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
    tweet_id: tweetData.id || null,
    tweet_url: tweetData.url || null,
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
  const resources = await getUnpostedResources(options.limit || 20);

  if (resources.length === 0) {
    console.log('No new resources to post.');
    return { posted: false, reason: 'no_new_resources' };
  }

  console.log(`Found ${resources.length} un-posted resources. Generating long-form post...`);

  const postText = await generateLongPost(resources);
  console.log(`Generated post (${postText.length} chars):`);
  console.log('─'.repeat(60));
  console.log(postText);
  console.log('─'.repeat(60));

  if (options.dryRun) {
    console.log('[DRY RUN] Would post the above.');
    return { posted: false, reason: 'dry_run', text: postText };
  }

  // Verify we have Twitter API credentials
  if (!process.env.TWITTER_API_KEY || !process.env.TWITTER_ACCESS_TOKEN) {
    console.warn('Missing Twitter API credentials. Cannot post.');
    return { posted: false, reason: 'missing_credentials', text: postText };
  }

  const postedTweet = await postLongTweet(postText);

  const resourceIds = resources.map(r => r.id);
  await markAsPosted(resourceIds);
  await recordAutoPost(postedTweet, resourceIds, postText);

  console.log(`Posted! ${postedTweet.url || 'URL unknown'}`);
  return { posted: true, tweet: postedTweet, resourceCount: resources.length };
}
