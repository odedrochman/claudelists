import { NextResponse } from 'next/server';
import { createServiceClient } from '../../../../lib/supabase';
import { postTweet } from '../../../../lib/twitter';
import Anthropic from '@anthropic-ai/sdk';

function checkAdminKey(request) {
  const { searchParams } = new URL(request.url);
  const key = searchParams.get('key');
  return key && key === process.env.ADMIN_SECRET_KEY;
}

// GET: List firehose resources (not yet tweeted)
export async function GET(request) {
  if (!checkAdminKey(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const filter = searchParams.get('filter') || 'pending'; // pending | tweeted | all

  const supabase = createServiceClient();

  let query = supabase
    .from('resources')
    .select(`
      id, title, summary, primary_url, ai_quality_score, content_type,
      author_handle, posted_to_twitter, tweet_url, tweet_id, created_at,
      categories ( name ),
      resource_tags ( tags ( name ) )
    `)
    .like('tweet_id', 'firehose-%')
    .order('created_at', { ascending: false })
    .limit(50);

  if (filter === 'pending') {
    query = query.eq('posted_to_twitter', false);
  } else if (filter === 'tweeted') {
    query = query.eq('posted_to_twitter', true).neq('tweet_url', 'skipped');
  } else if (filter === 'skipped') {
    query = query.eq('posted_to_twitter', true).eq('tweet_url', 'skipped');
  }

  const { data: resources, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ resources: resources || [] });
}

// POST: Generate tweet draft or post tweet for a firehose resource
export async function POST(request) {
  if (!checkAdminKey(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { action, resourceId, tweetText } = body;

  const supabase = createServiceClient();

  if (action === 'generate-tweet') {
    // Generate a tweet draft for a resource
    const { data: resource, error } = await supabase
      .from('resources')
      .select('id, title, summary, primary_url, ai_quality_score, categories ( name )')
      .eq('id', resourceId)
      .single();

    if (error || !resource) {
      return NextResponse.json({ error: 'Resource not found' }, { status: 404 });
    }

    const anthropic = new Anthropic();
    const score = resource.ai_quality_score || 5;
    const useThread = score >= 8;

    const prompt = `You write tweets for @claudelists, a curated directory of Claude ecosystem resources.

Generate a tweet about this resource. The resource URL is: ${resource.primary_url}

Resource:
- Title: ${resource.title}
- Summary: ${resource.summary}
- Category: ${resource.categories?.name || 'Community Showcase'}
- Quality score: ${score}/10

TONE (Persona G: Loss Aversion + Social Proof):
- Imply the reader is missing out on what others already know
- Frame inaction as a cost. Use "you" directly
- Short, punchy, slightly spicy. Not mean, but makes you feel behind

HOOK PATTERNS (use one):
- Specific number: "34 minutes. That's how long it took to build a complete business site with Claude Code."
- Bold claim: "You don't need to code to build a $5K/month AI business. Seriously."
- Provocative question: "What if your entire dev workflow is 10x slower than it needs to be?"
- Social proof: "The devs shipping fastest right now all have one thing in common."

RULES:
- NEVER use em dashes
- Every tweet must deliver a micro-insight even if they never click
- Do NOT use markdown formatting. Plain text only.
- Use line breaks for readability
- Include the resource URL: ${resource.primary_url}

${useThread ? `Return a JSON object: { "type": "thread", "tweets": ["tweet1", "tweet2", "tweet3"] }
Write 3-4 tweets as a thread:
- Tweet 1 (HOOK): Pattern interrupt + curiosity gap + resource URL. Under 280 chars.
- Tweet 2 (VALUE): Specific insight from the resource. Under 280 chars.
- Tweet 3 (DETAIL): Second takeaway or practical tip. Under 280 chars.
- Tweet 4 (optional, CLOSER): CTA + hashtags #Claude #AI #ClaudeCode. Under 280 chars.
DO NOT number tweets. Hashtags only in last tweet.` : `Return a JSON object: { "type": "single", "tweets": ["the full tweet text"] }
Write one tweet, 200-800 chars (long tweet format).
- Open with a hook
- Include specific insight
- Include the resource URL
- End with CTA and hashtags #Claude #AI #ClaudeCode`}

Return ONLY valid JSON. No markdown fences.`;

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = response.content[0].text.trim();
    const json = text.replace(/^```json?\n?/, '').replace(/\n?```$/, '');
    const result = JSON.parse(json);

    return NextResponse.json({
      type: result.type || 'single',
      tweets: result.tweets || [text],
    });
  }

  if (action === 'post-tweet') {
    // Post a tweet (single or thread) for a resource
    if (!tweetText || !resourceId) {
      return NextResponse.json({ error: 'tweetText and resourceId required' }, { status: 400 });
    }

    const tweets = Array.isArray(tweetText) ? tweetText : [tweetText];

    // Validate lengths
    for (let i = 0; i < tweets.length; i++) {
      if (tweets.length === 1 && tweets[i].length > 4000) {
        return NextResponse.json({ error: `Tweet exceeds 4000 chars (long tweet limit)` }, { status: 400 });
      }
      if (tweets.length > 1 && tweets[i].length > 280) {
        return NextResponse.json({ error: `Thread tweet ${i + 1} exceeds 280 chars` }, { status: 400 });
      }
    }

    const { TwitterApi } = await import('twitter-api-v2');
    const userClient = new TwitterApi({
      appKey: process.env.TWITTER_API_KEY,
      appSecret: process.env.TWITTER_API_SECRET,
      accessToken: process.env.TWITTER_ACCESS_TOKEN,
      accessSecret: process.env.TWITTER_ACCESS_SECRET,
    });

    let tweetUrl;

    if (tweets.length === 1) {
      // Single tweet (or long tweet)
      const result = await userClient.v2.tweet(tweets[0]);
      const me = await userClient.v2.me();
      tweetUrl = `https://x.com/${me.data.username}/status/${result.data.id}`;
    } else {
      // Thread
      const firstResult = await userClient.v2.tweet({ text: tweets[0] });
      let lastTweetId = firstResult.data.id;

      for (let i = 1; i < tweets.length; i++) {
        const reply = await userClient.v2.tweet({
          text: tweets[i],
          reply: { in_reply_to_tweet_id: lastTweetId },
        });
        lastTweetId = reply.data.id;
      }

      const me = await userClient.v2.me();
      tweetUrl = `https://x.com/${me.data.username}/status/${firstResult.data.id}`;
    }

    // Update resource as tweeted
    await supabase
      .from('resources')
      .update({
        posted_to_twitter: true,
        posted_at: new Date().toISOString(),
        tweet_url: tweetUrl,
      })
      .eq('id', resourceId);

    return NextResponse.json({ success: true, tweetUrl });
  }

  if (action === 'skip-tweet') {
    if (!resourceId) {
      return NextResponse.json({ error: 'resourceId required' }, { status: 400 });
    }

    const { error } = await supabase
      .from('resources')
      .update({
        posted_to_twitter: true,
        posted_at: new Date().toISOString(),
        tweet_url: 'skipped',
      })
      .eq('id', resourceId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
