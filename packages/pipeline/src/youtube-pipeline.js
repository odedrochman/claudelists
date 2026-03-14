import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ override: true });
config({ path: resolve(__dirname, '../../../apps/web/.env.local'), override: true });

import { Command } from 'commander';
import { createClient } from '@supabase/supabase-js';
import { unlink } from 'fs/promises';
import Anthropic from '@anthropic-ai/sdk';
import { extractFromUrl, analyzeContent } from './extract-url.js';
import { postTweetWithMedia, postThread, uploadMedia, getClients } from './twitter-client.js';
import { downloadOgImage } from './promo-tweet.js';

const anthropic = new Anthropic();
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ── Search queries (rotate per run) ────────────────────────────────

const SEARCH_QUERIES = [
  'Claude AI tutorial',
  'Claude Code',
  'MCP server Claude',
  'Anthropic Claude',
  'Claude AI agent',
  'Claude Code CLI',
  'Claude AI coding workflow',
  'Claude desktop app',
];

const MIN_QUALITY_SCORE = 5;

// ── YouTube search ─────────────────────────────────────────────────

async function searchYouTube(query, maxResults = 10) {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) throw new Error('YOUTUBE_API_KEY not set');

  const publishedAfter = new Date(Date.now() - 7 * 86400000).toISOString();
  const params = new URLSearchParams({
    part: 'snippet',
    q: query,
    type: 'video',
    order: 'date',
    maxResults: String(maxResults),
    publishedAfter,
    relevanceLanguage: 'en',
    key: apiKey,
  });

  const resp = await fetch(`https://www.googleapis.com/youtube/v3/search?${params}`, {
    signal: AbortSignal.timeout(15000),
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`YouTube search failed (${resp.status}): ${err}`);
  }

  const data = await resp.json();
  return (data.items || []).map(item => ({
    videoId: item.id.videoId,
    title: item.snippet.title,
    channelTitle: item.snippet.channelTitle,
    publishedAt: item.snippet.publishedAt,
    url: `https://www.youtube.com/watch?v=${item.id.videoId}`,
  }));
}

// ── Deduplication ──────────────────────────────────────────────────

async function filterNewVideos(videos) {
  if (videos.length === 0) return [];

  const tweetIds = videos.map(v => `youtube-${v.videoId}`);
  const { data: existing } = await supabase
    .from('resources')
    .select('tweet_id')
    .in('tweet_id', tweetIds);

  const existingSet = new Set((existing || []).map(r => r.tweet_id));
  return videos.filter(v => !existingSet.has(`youtube-${v.videoId}`));
}

// ── Category + tag resolution ──────────────────────────────────────

let categoryCache = null;

async function getCategories() {
  if (categoryCache) return categoryCache;
  const { data, error } = await supabase.from('categories').select('id, name');
  if (error) throw new Error(`Failed to fetch categories: ${error.message}`);
  categoryCache = new Map(data.map(c => [c.name, c.id]));
  return categoryCache;
}

const tagCache = new Map();

async function resolveTag(tagName) {
  if (tagCache.has(tagName)) return tagCache.get(tagName);

  const { data: existing } = await supabase
    .from('tags')
    .select('id')
    .eq('name', tagName)
    .single();

  if (existing) {
    tagCache.set(tagName, existing.id);
    return existing.id;
  }

  const { data: created, error } = await supabase
    .from('tags')
    .insert({ name: tagName, usage_count: 1 })
    .select('id')
    .single();

  if (error) {
    const { data: retry } = await supabase
      .from('tags')
      .select('id')
      .eq('name', tagName)
      .single();
    if (retry) {
      tagCache.set(tagName, retry.id);
      return retry.id;
    }
    throw new Error(`Failed to create tag "${tagName}": ${error.message}`);
  }

  tagCache.set(tagName, created.id);
  return created.id;
}

// ── Article generation ─────────────────────────────────────────────

function generateSlug(title) {
  const dateStr = new Date().toISOString().split('T')[0];
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 60)
    .replace(/-$/, '');
  return `${slug}-${dateStr}`;
}

async function generateArticle(extracted, analysis, videoId) {
  const ytUrl = `https://www.youtube.com/watch?v=${videoId}`;
  const embedHtml = `<div style="position:relative;padding-bottom:56.25%;height:0;overflow:hidden;margin:1.5rem 0"><iframe src="https://www.youtube.com/embed/${videoId}" style="position:absolute;top:0;left:0;width:100%;height:100%;border:0" allowfullscreen></iframe></div>`;

  const prompt = `You are a tech blogger writing for claudelists.com/digest. This is a curated Claude ecosystem resource site focused on Claude AI, MCP servers, Claude Code, CLAUDE.md configs, prompts, and related tools.

Write a markdown article about this YouTube video. Always write the article, even if the resource doesn't directly relate to Claude. The site occasionally covers adjacent AI and developer tools too.

Requirements:
- Start with a brief intro paragraph about what this video covers and why it matters
- Embed the video after the intro using this exact HTML block on its own line:

${embedHtml}

- Include relevant sections covering key features, how to use it, and why it matters
- Be 500-650 words (this is strict, aim for 550)
- Use H2 (##) for section headings
- Include the source URL as a link: ${ytUrl}
- If there is a creator/channel, mention them
- End with a brief takeaway or call to action
- Where there's a natural connection to the Claude ecosystem, mention it. But do NOT force a connection if there isn't one.

Writing style (CRITICAL, follow these strictly to avoid sounding AI-generated):
- Never use em dashes (--) or the word "delve"
- Never use "game-changer", "exciting", "revolutionize", "landscape", "leverage", "streamline", "robust", "comprehensive", "cutting-edge", "seamless"
- Never start paragraphs with "In today's..." or "In the world of..."
- Never use "Whether you're a ... or a ..." constructions
- Do not use filler transitions like "Moreover", "Furthermore", "Additionally", "It's worth noting that"
- Vary sentence length. Mix short punchy sentences with longer ones.
- Be specific and concrete, not vague and hyperbolic
- Write like a developer explaining something to another developer over coffee
- Use contractions naturally (it's, don't, you'll, there's)

Also return a JSON object (not just the article). Return ONLY valid JSON with these fields:
1. "title" (string, max 80 chars): A compelling article title (can differ from the video title). Sell the value.
2. "content" (string): The full markdown article.
3. "meta_description" (string, max 160 chars): SEO meta description.
4. "og_quote" (string, max 80 chars): A punchy, value-driven one-liner for the OG social card. ALWAYS second person ("you", "your"). Specific outcome, not vague hype. No em dashes, no quotation marks.

Video details:
- Title: ${extracted.title}
- Channel: ${extracted.author || 'unknown'}
- URL: ${ytUrl}
- Description: ${(extracted.content || '').substring(0, 3000)}
- Duration: ${extracted.metadata?.durationSeconds ? `${Math.floor(extracted.metadata.durationSeconds / 60)}m ${extracted.metadata.durationSeconds % 60}s` : 'unknown'}
- Views: ${extracted.metadata?.viewCount?.toLocaleString() || 'unknown'}

Return ONLY valid JSON. No markdown fences, no explanation.`;

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2048,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = response.content[0].text.trim();
  const json = text.replace(/^```json?\n?/, '').replace(/\n?```$/, '');
  return JSON.parse(json);
}

// ── Tweet generation ───────────────────────────────────────────────

async function generateTweet(analysis, articleSlug, extracted, useThread) {
  const articleUrl = `https://claudelists.com/digest/${articleSlug}`;
  const channelName = extracted.author || 'a creator';

  const format = useThread
    ? `Return a JSON array of 3-5 tweet strings (a thread). Follow this THREAD STRUCTURE:

Tweet 1 (THE HOOK):
- Open with a pattern interrupt: a specific number, bold claim, provocative question, or surprising stat
- Create a curiosity gap. The reader must feel they NEED to keep reading
- End with a cliffhanger that pulls into tweet 2 (e.g. "Here's what they did differently:" or "The setup takes 3 steps.")
- Include the article link: ${articleUrl}
- Under 280 chars

Tweet 2 (THE VALUE):
- Deliver on the hook's promise with a specific insight, technique, or result from the video
- One clear point per tweet. Don't cram multiple ideas.
- End with a teaser for the next tweet ("But that's not even the best part." or "The real trick is in step 3.")
- Under 280 chars

Tweet 3 (THE DETAIL):
- A second key takeaway, surprising detail, or practical tip from the video
- Concrete and actionable. Give the reader something they can use immediately.
- Under 280 chars

Tweet 4 (optional, THE CLOSER):
- Mention the creator by name
- CTA: "Tag @claudelists to get featured"
- Put ALL hashtags here (not in earlier tweets): #Claude #AI #ClaudeCode
- Under 280 chars

THREAD BEST PRACTICES:
- Each tweet should stand alone as valuable, but together they tell a story
- Use line breaks within tweets for readability, not walls of text
- Vary sentence length: mix short punchy lines with slightly longer ones
- The hook tweet gets 90% of the impressions. Spend most effort there.
- DO NOT number tweets (1/4, 2/4). Numbering reduces engagement on X.

Return ONLY a JSON array of strings. No markdown fences.`
    : `Return a single JSON string (one tweet, 400-800 chars for a long tweet). Rules:
- Open with a pattern interrupt hook: specific number, bold claim, or provocative question
- Include a specific insight or result from the video (not just "check out this video")
- Include the article link: ${articleUrl}
- Mention the creator
- Use line breaks for readability
- End with CTA and hashtags (#Claude #AI #ClaudeCode) at the very end
- Tag @claudelists
Return ONLY a JSON string. No markdown fences.`;

  const prompt = `You write tweets for @claudelists. Generate a tweet about this new article.

TONE (Persona G: Loss Aversion + Social Proof):
- Imply the reader is missing out on what others already know
- Frame inaction as a cost. Use "you" directly
- Short, punchy, slightly spicy. Not mean, but makes you feel behind
- Examples: "The difference between 'Claude is okay' and 'Claude is incredible' is usually 5 lines in your CLAUDE.md." / "84K devs already know about X. You probably don't. Fix that."

HOOK PATTERNS (use one):
- Specific number: "34 minutes. That's how long it took to build a complete business site with Claude Code."
- Bold claim: "You don't need to code to build a $5K/month AI business. Seriously."
- Provocative question: "What if your entire dev workflow is 10x slower than it needs to be?"
- Social proof: "The devs shipping fastest right now all have one thing in common."
- Before/after: "Last week: 4 hours to build a landing page. This week: 12 minutes with Claude Code."

Resource info:
- Title: ${analysis.title}
- Summary: ${analysis.summary}
- Creator: ${channelName}
- Category: ${analysis.category}
- Quality score: ${analysis.ai_quality_score}/10

RULES:
- NEVER use em dashes
- Every tweet must deliver a micro-insight even if they never click
- Do NOT use markdown formatting (no **, no ##, no []()). Plain text only.
- Use line breaks for readability. No walls of text.
- Hashtags go in the LAST tweet only (threads) or at the end (single tweets)

${format}`;

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = response.content[0].text.trim();
  const json = text.replace(/^```json?\n?/, '').replace(/\n?```$/, '');
  return JSON.parse(json);
}

// ── Main pipeline ──────────────────────────────────────────────────

async function run(options) {
  console.log('\n═══ YouTube Auto-Pipeline ═══\n');

  // Step 1: Pick search query (rotate by current 3-hour slot)
  let videos;
  let videoUrl = options.url;

  if (videoUrl) {
    // Direct URL mode
    console.log(`Using provided URL: ${videoUrl}`);
    const match = videoUrl.match(/(?:v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
    if (!match) throw new Error('Invalid YouTube URL');
    videos = [{ videoId: match[1], url: videoUrl, title: 'Direct URL' }];
  } else {
    // Search mode
    const slot = Math.floor(Date.now() / (3 * 3600000)) % SEARCH_QUERIES.length;
    const query = SEARCH_QUERIES[slot];
    console.log(`Search query (slot ${slot}): "${query}"`);

    videos = await searchYouTube(query);
    console.log(`Found ${videos.length} videos`);

    if (videos.length === 0) {
      console.log('No videos found. Done.');
      return;
    }
  }

  // Step 2: Filter out already-processed
  const newVideos = await filterNewVideos(videos);
  console.log(`${newVideos.length} new videos after dedup (${videos.length - newVideos.length} already processed)`);

  if (newVideos.length === 0) {
    console.log('All videos already processed. Done.');
    return;
  }

  // Step 3: Extract + analyze candidates (up to 5)
  const candidates = [];
  for (const video of newVideos.slice(0, 5)) {
    try {
      console.log(`\nAnalyzing: ${video.title}`);
      const extracted = await extractFromUrl(video.url);
      const analysis = await analyzeContent(extracted);
      console.log(`  Score: ${analysis.ai_quality_score}/10 | Category: ${analysis.category}`);
      candidates.push({ video, extracted, analysis });
    } catch (e) {
      console.warn(`  Failed to analyze ${video.videoId}: ${e.message}`);
    }
  }

  if (candidates.length === 0) {
    console.log('No candidates could be analyzed. Done.');
    return;
  }

  // Pick best candidate
  candidates.sort((a, b) => b.analysis.ai_quality_score - a.analysis.ai_quality_score);
  const best = candidates[0];
  const { video, extracted, analysis } = best;

  console.log(`\nBest candidate: "${analysis.title}" (score: ${analysis.ai_quality_score})`);

  // Quality gate
  if (analysis.ai_quality_score < MIN_QUALITY_SCORE) {
    console.log(`Score ${analysis.ai_quality_score} below threshold ${MIN_QUALITY_SCORE}. Skipping.`);
    return;
  }

  if (options.dryRun) {
    console.log('\n[DRY RUN] Would process this video:');
    console.log(`  Title: ${analysis.title}`);
    console.log(`  Summary: ${analysis.summary}`);
    console.log(`  Category: ${analysis.category}`);
    console.log(`  Tags: ${(analysis.tags || []).join(', ')}`);
    console.log(`  Score: ${analysis.ai_quality_score}`);
    return;
  }

  // Step 4: Insert resource
  console.log('\nInserting resource...');
  const categories = await getCategories();
  const categoryId = categories.get(analysis.category) || categories.get('Community Showcase');

  const ytUrl = `https://www.youtube.com/watch?v=${video.videoId}`;
  const resourceRow = {
    tweet_id: `youtube-${video.videoId}`,
    title: analysis.title,
    summary: analysis.summary,
    tweet_text: '',
    tweet_url: ytUrl,
    author_handle: extracted.author || null,
    author_name: extracted.author || null,
    content_type: 'video',
    category_id: categoryId,
    primary_url: ytUrl,
    expanded_links: [ytUrl],
    extracted_content: extracted.metadata,
    media: [],
    engagement: {
      views: extracted.metadata?.viewCount || 0,
      likes: extracted.metadata?.likeCount || 0,
      comments: extracted.metadata?.commentCount || 0,
    },
    is_thread: false,
    is_duplicate: false,
    ai_quality_score: analysis.ai_quality_score,
    claude_tool: analysis.claude_tool,
    skill_level: analysis.skill_level,
    content_format: 'video',
    posted_to_twitter: false,
    status: 'published',
  };

  const { data: resource, error: resError } = await supabase
    .from('resources')
    .insert(resourceRow)
    .select('id')
    .single();

  if (resError) {
    if (resError.code === '23505') {
      console.log('Resource already exists (duplicate). Skipping.');
      return;
    }
    throw new Error(`Failed to insert resource: ${resError.message}`);
  }

  console.log(`  Resource created: id=${resource.id}`);

  // Link tags
  for (const tagName of (analysis.tags || [])) {
    try {
      const tagId = await resolveTag(tagName);
      await supabase.from('resource_tags').insert({ resource_id: resource.id, tag_id: tagId });
    } catch (e) {
      console.warn(`  Failed to link tag "${tagName}": ${e.message}`);
    }
  }

  // Step 5: Generate article
  console.log('\nGenerating article...');
  const articleData = await generateArticle(extracted, analysis, video.videoId);
  console.log(`  Article title: ${articleData.title}`);
  console.log(`  OG quote: ${articleData.og_quote || '(none)'}`);

  // Step 6: Insert + publish article
  const slug = generateSlug(articleData.title);
  const articleRow = {
    slug,
    title: articleData.title,
    article_type: 'quick',
    content: articleData.content,
    meta_description: articleData.meta_description || '',
    og_title: articleData.title.length > 60 ? articleData.title.substring(0, 57) + '...' : articleData.title,
    og_quote: articleData.og_quote || null,
    status: 'published',
    published_at: new Date().toISOString(),
  };

  let article;
  const { data: artData, error: artError } = await supabase
    .from('articles')
    .insert(articleRow)
    .select('id, slug, title, status')
    .single();

  if (artError) {
    // Handle slug collision
    if (artError.code === '23505' && artError.message?.includes('slug')) {
      articleRow.slug = `${slug}-2`;
      const { data: retry, error: retryErr } = await supabase
        .from('articles')
        .insert(articleRow)
        .select('id, slug, title, status')
        .single();
      if (retryErr) throw new Error(`Failed to insert article (retry): ${retryErr.message}`);
      article = retry;
    } else {
      throw new Error(`Failed to insert article: ${artError.message}`);
    }
  } else {
    article = artData;
  }

  console.log(`  Article published: /digest/${article.slug}`);

  // Link resource to article
  await supabase.from('article_resources').insert({
    article_id: article.id,
    resource_id: resource.id,
    position: 0,
  });

  if (options.skipTweet) {
    console.log('\n[SKIP TWEET] Resource and article created. Skipping tweet.');
    return;
  }

  // Step 7: Tweet about it
  console.log('\nGenerating tweet...');
  const useThread = analysis.ai_quality_score >= 8;
  const tweetContent = await generateTweet(analysis, article.slug, extracted, useThread);

  // Download OG image
  let mediaId = null;
  try {
    // Use the production URL for OG image since local dev may not be running
    const ogUrl = `https://claudelists.com/digest/${article.slug}/opengraph-image`;
    console.log(`Downloading OG image from ${ogUrl}...`);
    const ogImagePath = await downloadOgImage(article.slug);
    mediaId = await uploadMedia(ogImagePath);
    await unlink(ogImagePath).catch(() => {});
  } catch (e) {
    console.warn(`Warning: Could not attach OG image: ${e.message}`);
    console.warn('Posting without image...');
  }

  let tweetUrl;
  if (useThread && Array.isArray(tweetContent)) {
    // Thread: first tweet gets OG image
    console.log(`Posting thread (${tweetContent.length} tweets)...`);
    const { userClient } = getClients();

    const firstPayload = { text: tweetContent[0] };
    if (mediaId) firstPayload.media = { media_ids: [mediaId] };
    const firstResult = await userClient.v2.tweet(firstPayload);
    let lastTweetId = firstResult.data.id;

    for (let i = 1; i < tweetContent.length; i++) {
      const reply = await userClient.v2.tweet({
        text: tweetContent[i],
        reply: { in_reply_to_tweet_id: lastTweetId },
      });
      lastTweetId = reply.data.id;
    }

    const me = await userClient.v2.me();
    tweetUrl = `https://x.com/${me.data.username}/status/${firstResult.data.id}`;
    console.log(`Thread posted: ${tweetUrl}`);
  } else {
    // Single tweet
    const text = Array.isArray(tweetContent) ? tweetContent[0] : tweetContent;
    console.log(`Posting single tweet (${text.length} chars)...`);
    const result = await postTweetWithMedia(text, mediaId ? [mediaId] : []);
    tweetUrl = result.url;
    console.log(`Tweet posted: ${tweetUrl}`);
  }

  // Update resource with tweet info
  await supabase
    .from('resources')
    .update({
      posted_to_twitter: true,
      posted_at: new Date().toISOString(),
      tweet_url: tweetUrl,
    })
    .eq('id', resource.id);

  // Update article with tweet URL
  await supabase
    .from('articles')
    .update({
      thread_url: tweetUrl,
      updated_at: new Date().toISOString(),
    })
    .eq('id', article.id);

  // Record in auto_posts
  await supabase.from('auto_posts').insert({
    tweet_id: tweetUrl.split('/status/')[1] || null,
    tweet_url: tweetUrl,
    resource_ids: [resource.id],
    content: Array.isArray(tweetContent) ? tweetContent.join('\n---\n') : tweetContent,
    status: 'posted',
    posted_at: new Date().toISOString(),
  });

  console.log('\n═══ YouTube Pipeline Complete ═══');
  console.log(`  Resource: id=${resource.id} "${analysis.title}"`);
  console.log(`  Article: /digest/${article.slug}`);
  console.log(`  Tweet: ${tweetUrl}`);
}

// ── CLI ─────────────────────────────────────────────────────────────

const program = new Command();

program
  .name('youtube-pipeline')
  .description('ClaudeLists YouTube auto-pipeline: discover → resource → article → tweet')
  .option('--dry-run', 'Preview without writing to DB or posting', false)
  .option('--skip-tweet', 'Create resource + article but skip tweeting', false)
  .option('--url <url>', 'Process a specific YouTube video URL');

program.parse();
const opts = program.opts();

try {
  await run({
    dryRun: opts.dryRun,
    skipTweet: opts.skipTweet,
    url: opts.url,
  });
} catch (e) {
  console.error('\nYouTube pipeline failed:', e.message);
  if (process.env.DEBUG) console.error(e);
  process.exit(1);
}
