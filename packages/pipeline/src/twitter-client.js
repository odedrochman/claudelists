import { config } from 'dotenv';
config({ override: true });

import { TwitterApi } from 'twitter-api-v2';

// ── Create authenticated Twitter API clients ─────────────────────

function createClients() {
  const userClient = new TwitterApi({
    appKey: process.env.TWITTER_API_KEY,
    appSecret: process.env.TWITTER_API_SECRET,
    accessToken: process.env.TWITTER_ACCESS_TOKEN,
    accessSecret: process.env.TWITTER_ACCESS_SECRET,
  });

  const appClient = new TwitterApi(process.env.TWITTER_BEARER_TOKEN);

  return { userClient, appClient };
}

let _clients = null;

export function getClients() {
  if (!_clients) _clients = createClients();
  return _clients;
}

// ── Verify authentication ────────────────────────────────────────

export async function verifyAuth() {
  const { userClient } = getClients();
  try {
    const me = await userClient.v2.me();
    console.log(`Twitter API authenticated as @${me.data.username}`);
    return me.data;
  } catch (e) {
    console.error('Twitter API auth failed:', e.message);
    return null;
  }
}

// ── Fetch tweet by ID with full expansions ───────────────────────

export async function fetchTweet(tweetId) {
  const { appClient } = getClients();
  try {
    const tweet = await appClient.v2.singleTweet(tweetId, {
      expansions: [
        'author_id',
        'attachments.media_keys',
        'referenced_tweets.id',
        'entities.mentions.username',
      ],
      'tweet.fields': [
        'created_at', 'public_metrics', 'entities', 'context_annotations',
        'note_tweet', 'text', 'author_id', 'conversation_id',
      ],
      'user.fields': ['username', 'name', 'description'],
      'media.fields': ['url', 'preview_image_url', 'type', 'alt_text'],
    });
    return tweet;
  } catch (e) {
    console.warn(`Failed to fetch tweet ${tweetId}:`, e.message);
    return null;
  }
}

// ── Fetch bookmarks via API ──────────────────────────────────────

export async function fetchBookmarksApi(limit) {
  const { userClient } = getClients();
  const bookmarks = [];

  try {
    const paginator = await userClient.v2.bookmarks({
      expansions: [
        'author_id',
        'attachments.media_keys',
        'referenced_tweets.id',
      ],
      'tweet.fields': [
        'created_at', 'public_metrics', 'entities', 'context_annotations',
        'note_tweet', 'text', 'author_id', 'conversation_id',
      ],
      'user.fields': ['username', 'name', 'description'],
      'media.fields': ['url', 'preview_image_url', 'type', 'alt_text'],
      max_results: Math.min(limit || 100, 100),
    });

    for await (const tweet of paginator) {
      bookmarks.push(tweet);
      if (limit && bookmarks.length >= limit) break;
    }

    // Build lookup maps from includes
    const users = new Map();
    const media = new Map();
    if (paginator.includes?.users) {
      for (const u of paginator.includes.users) {
        users.set(u.id, u);
      }
    }
    if (paginator.includes?.media) {
      for (const m of paginator.includes.media) {
        media.set(m.media_key, m);
      }
    }

    return { bookmarks, users, media };
  } catch (e) {
    console.error('Failed to fetch bookmarks via API:', e.message);
    throw e;
  }
}

// ── Post a tweet via API ─────────────────────────────────────────

export async function postTweet(text) {
  const { userClient } = getClients();
  try {
    const result = await userClient.v2.tweet(text);
    const tweetId = result.data.id;
    // Get username for URL
    const me = await userClient.v2.me();
    const url = `https://x.com/${me.data.username}/status/${tweetId}`;
    console.log(`Posted tweet: ${url}`);
    return { id: tweetId, url, text };
  } catch (e) {
    console.error('Failed to post tweet:', e.message);
    throw e;
  }
}

// ── Post a thread (array of tweet texts) ─────────────────────────

export async function postThread(tweets) {
  const { userClient } = getClients();
  const posted = [];

  try {
    let lastTweetId = null;
    for (const text of tweets) {
      const payload = lastTweetId
        ? { text, reply: { in_reply_to_tweet_id: lastTweetId } }
        : { text };
      const result = await userClient.v2.tweet(payload);
      lastTweetId = result.data.id;
      posted.push({ id: lastTweetId, text });
    }

    const me = await userClient.v2.me();
    const firstUrl = `https://x.com/${me.data.username}/status/${posted[0].id}`;
    console.log(`Posted thread (${posted.length} tweets): ${firstUrl}`);
    return { tweets: posted, url: firstUrl };
  } catch (e) {
    console.error('Failed to post thread:', e.message);
    throw e;
  }
}
