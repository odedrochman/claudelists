import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const execFileAsync = promisify(execFile);

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = resolve(__dirname, '..', 'data');
const localBird = resolve(__dirname, '..', 'node_modules', '.bin', 'bird');
const BIRD_BIN = existsSync(localBird) ? localBird : 'bird';

// ── Bird CLI wrapper ──────────────────────────────────────────────

async function birdCommand(args, envOverrides = {}) {
  const env = { ...process.env, ...envOverrides };
  if (env.TWITTER_AUTH_TOKEN) env.AUTH_TOKEN = env.TWITTER_AUTH_TOKEN;
  if (env.TWITTER_CT0) env.CT0 = env.TWITTER_CT0;

  const { stdout } = await execFileAsync(BIRD_BIN, args, {
    maxBuffer: 100 * 1024 * 1024,
    timeout: 600_000,
    env,
  });
  return stdout;
}

export async function checkAuth() {
  try {
    const out = await birdCommand(['whoami']);
    const match = out.match(/@(\w+)/);
    console.log(`Authenticated as ${match ? '@' + match[1] : 'unknown'}`);
    return true;
  } catch (e) {
    console.error('Auth check failed. Make sure bird CLI is installed and Twitter cookies are set.');
    return false;
  }
}

// ── Fetch bookmarks via bird CLI ──────────────────────────────────

async function fetchRawBookmarks(limit) {
  console.log(limit ? `Fetching up to ${limit} bookmarks...` : 'Fetching all bookmarks...');
  const args = ['bookmarks', '--json', '--thread-meta'];
  if (limit) {
    args.push('-n', String(limit));
  } else {
    args.push('--all');
  }

  const stdout = await birdCommand(args);
  const parsed = JSON.parse(stdout);
  const tweets = Array.isArray(parsed) ? parsed : (parsed.tweets || parsed.data || []);
  console.log(`Fetched ${tweets.length} bookmarks`);
  return tweets;
}

// ── Link expansion ────────────────────────────────────────────────

async function expandUrl(shortUrl) {
  if (!shortUrl || !shortUrl.includes('t.co')) return shortUrl;
  try {
    const resp = await fetch(shortUrl, {
      method: 'HEAD',
      redirect: 'follow',
      signal: AbortSignal.timeout(10_000),
    });
    return resp.url;
  } catch {
    return shortUrl;
  }
}

async function expandAllLinks(tweets) {
  console.log('Expanding shortened links...');
  let count = 0;
  for (const tweet of tweets) {
    const urls = extractUrls(tweet.text || '');
    const tcoUrls = tweet.entities?.urls?.map(u => u.expanded_url || u.url) || [];
    const allShortUrls = [...new Set([...urls.filter(u => u.includes('t.co')), ...tcoUrls])];

    tweet._expandedLinks = [];
    for (const url of allShortUrls) {
      const expanded = await expandUrl(url);
      tweet._expandedLinks.push({ original: url, expanded });
    }

    const nonTcoUrls = urls.filter(u => !u.includes('t.co'));
    for (const url of nonTcoUrls) {
      tweet._expandedLinks.push({ original: url, expanded: url });
    }

    count++;
    if (count % 50 === 0) console.log(`  Expanded links for ${count}/${tweets.length} tweets`);
  }
  console.log(`  Done expanding links for ${tweets.length} tweets`);
  return tweets;
}

function extractUrls(text) {
  const urlRegex = /https?:\/\/[^\s)]+/g;
  return (text.match(urlRegex) || []);
}

// ── Content extraction ────────────────────────────────────────────

async function extractContent(tweets) {
  console.log('Extracting content from links...');
  let count = 0;

  for (const tweet of tweets) {
    tweet._contentType = detectContentType(tweet);
    tweet._extractedContent = null;
    tweet._markdownContent = null;

    const links = (tweet._expandedLinks || []).map(l => l.expanded);

    for (const link of links) {
      // Check for downloadable .md files on GitHub
      if (!tweet._markdownContent) {
        tweet._markdownContent = await extractMarkdownFromGitHub(link);
      }

      if (link.includes('github.com') && !tweet._extractedContent) {
        tweet._extractedContent = await extractGitHubInfo(link);
      } else if (isArticleDomain(link) && !tweet._extractedContent) {
        tweet._extractedContent = await extractArticleMeta(link);
      }
    }

    count++;
    if (count % 50 === 0) console.log(`  Extracted content for ${count}/${tweets.length} tweets`);
  }
  console.log(`  Done extracting content for ${tweets.length} tweets`);
  return tweets;
}

function detectContentType(tweet) {
  const links = (tweet._expandedLinks || []).map(l => l.expanded);

  if (tweet.isThread) return 'thread';
  if (links.some(u => u.includes('github.com') && /\/[^/]+\/[^/]+/.test(u))) return 'github_repo';
  if (links.some(u => isArticleDomain(u))) return 'article';
  if (tweet.media?.length > 0) {
    if (tweet.media.some(m => m.type === 'video' || m.type === 'animated_gif')) return 'video';
    return 'media';
  }
  return 'tweet';
}

function isArticleDomain(url) {
  const domains = [
    'medium.com', 'substack.com', 'dev.to', 'hashnode.dev',
    'blog', 'article', 'post', 'news', 'techcrunch.com',
    'theverge.com', 'arstechnica.com', 'wired.com',
    'nytimes.com', 'wsj.com', 'bbc.com', 'reuters.com',
  ];
  return domains.some(d => url.includes(d));
}

async function extractGitHubInfo(url) {
  try {
    const match = url.match(/github\.com\/([^/]+)\/([^/\s?#]+)/);
    if (!match) return null;
    const [, owner, repo] = match;
    const resp = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
      signal: AbortSignal.timeout(10_000),
      headers: { 'User-Agent': 'claudelists/1.0' },
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    return {
      title: data.full_name,
      description: data.description,
      stars: data.stargazers_count,
      language: data.language,
      topics: data.topics || [],
    };
  } catch {
    return null;
  }
}

// ── Markdown file extraction from GitHub ──────────────────────────

const MD_FILENAMES = ['CLAUDE.md', 'SKILL.md', 'RULES.md', 'SYSTEM.md', 'PROMPT.md', 'AGENT.md'];

async function extractMarkdownFromGitHub(url) {
  try {
    // Direct .md file link (e.g., github.com/user/repo/blob/main/CLAUDE.md)
    if (url.includes('github.com') && /\.md(\?|#|$)/.test(url)) {
      const rawUrl = url
        .replace('github.com', 'raw.githubusercontent.com')
        .replace('/blob/', '/');
      return await fetchRawContent(rawUrl);
    }

    // Repository root - check for known .md files
    const repoMatch = url.match(/github\.com\/([^/]+)\/([^/\s?#]+)\/?$/);
    if (repoMatch) {
      const [, owner, repo] = repoMatch;
      for (const filename of MD_FILENAMES) {
        const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/main/${filename}`;
        const content = await fetchRawContent(rawUrl);
        if (content) return content;
        // Try master branch too
        const masterUrl = `https://raw.githubusercontent.com/${owner}/${repo}/master/${filename}`;
        const masterContent = await fetchRawContent(masterUrl);
        if (masterContent) return masterContent;
      }
    }

    return null;
  } catch {
    return null;
  }
}

async function fetchRawContent(url) {
  try {
    const resp = await fetch(url, {
      signal: AbortSignal.timeout(10_000),
      headers: { 'User-Agent': 'claudelists/1.0' },
    });
    if (!resp.ok) return null;
    const text = await resp.text();
    // Only return if it looks like actual markdown content (not HTML error pages)
    if (text.length > 10 && text.length < 500_000 && !text.startsWith('<!DOCTYPE')) {
      return text;
    }
    return null;
  } catch {
    return null;
  }
}

async function extractArticleMeta(url) {
  try {
    const resp = await fetch(url, {
      signal: AbortSignal.timeout(10_000),
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; claudelists/1.0)' },
    });
    if (!resp.ok) return null;
    const html = await resp.text();
    const title = html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim();
    const description = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)/i)?.[1]?.trim()
      || html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*name=["']description["']/i)?.[1]?.trim();
    return { title: title || null, description: description || null };
  } catch {
    return null;
  }
}

// ── Normalize bird output ─────────────────────────────────────────

function normalizeTweet(raw) {
  const username = raw.author?.username || raw.author || '';
  const displayName = raw.author?.name || raw.authorName || '';

  return {
    id: raw.id || raw.id_str,
    text: raw.text || raw.full_text || '',
    author: username,
    authorName: displayName,
    tweetUrl: `https://x.com/${username}/status/${raw.id}`,
    createdAt: raw.createdAt || raw.created_at || '',
    media: (raw.media || []).map(m => ({
      type: m.type || 'photo',
      url: m.url || m.media_url_https || '',
      width: m.width,
      height: m.height,
    })),
    entities: raw.entities || {},
    isReply: !!(raw.inReplyToTweetId || raw.in_reply_to_status_id),
    isQuote: !!(raw.quotedTweet || raw.is_quote_status),
    isThread: raw.isThread || false,
    threadPosition: raw.threadPosition || 'standalone',
    replyCount: raw.replyCount || 0,
    retweetCount: raw.retweetCount || 0,
    likeCount: raw.likeCount || 0,
    conversationId: raw.conversationId || raw.id,
    replyContext: raw.replyContext || null,
    quoteContext: raw.quoteContext || raw.quotedTweet || null,
  };
}

// ── Cross-reference detection ─────────────────────────────────────

export function detectCrossReferences(bookmarks) {
  const linkToBookmarks = new Map();

  for (const bm of bookmarks) {
    const links = (bm._expandedLinks || []).map(l => l.expanded).filter(Boolean);
    for (const link of links) {
      const normalized = normalizeUrl(link);
      if (!linkToBookmarks.has(normalized)) {
        linkToBookmarks.set(normalized, []);
      }
      linkToBookmarks.get(normalized).push(bm);
    }
  }

  for (const bm of bookmarks) {
    const links = (bm._expandedLinks || []).map(l => l.expanded).filter(Boolean);
    const relatedTweets = new Set();

    for (const link of links) {
      const normalized = normalizeUrl(link);
      const group = linkToBookmarks.get(normalized) || [];
      for (const related of group) {
        if (related.id !== bm.id) {
          relatedTweets.add(`@${related.author} (${related.tweetUrl})`);
        }
      }
    }

    bm._relatedTweets = [...relatedTweets];
    bm._isDuplicate = relatedTweets.size > 0;
  }

  const dupes = bookmarks.filter(b => b._isDuplicate);
  if (dupes.length > 0) {
    console.log(`Found ${dupes.length} bookmarks with shared content (cross-referenced)`);
  }

  return bookmarks;
}

function normalizeUrl(url) {
  try {
    const u = new URL(url);
    u.searchParams.delete('utm_source');
    u.searchParams.delete('utm_medium');
    u.searchParams.delete('utm_campaign');
    u.searchParams.delete('ref');
    u.searchParams.delete('s');
    let path = u.pathname.replace(/\/$/, '');
    return `${u.hostname}${path}${u.search}`;
  } catch {
    return url;
  }
}

// ── Main fetch pipeline ───────────────────────────────────────────

export async function fetchAndEnrich(options = {}) {
  const dataPath = resolve(DATA_DIR, 'enriched-bookmarks.json');

  if (!options.force && existsSync(dataPath)) {
    console.log('Using cached enriched bookmarks. Use --force to re-fetch.');
    return JSON.parse(readFileSync(dataPath, 'utf-8'));
  }

  const authOk = await checkAuth();
  if (!authOk) throw new Error('Authentication failed');

  const raw = await fetchRawBookmarks(options.limit);
  writeFileSync(resolve(DATA_DIR, 'raw-bookmarks.json'), JSON.stringify(raw, null, 2));

  const tweets = raw.map(normalizeTweet);
  console.log(`Normalized ${tweets.length} tweets`);

  await expandAllLinks(tweets);
  await extractContent(tweets);

  writeFileSync(dataPath, JSON.stringify(tweets, null, 2));
  console.log(`Saved ${tweets.length} enriched bookmarks to ${dataPath}`);

  return tweets;
}

// Export bird command for use by auto-poster
export { birdCommand };
