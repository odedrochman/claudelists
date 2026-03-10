import { config } from 'dotenv';
config({ override: true });

import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic();

// ── URL type detection ────────────────────────────────────────────

function detectUrlType(url) {
  try {
    const u = new URL(url);
    const host = u.hostname.replace('www.', '');
    const path = u.pathname;

    if (host === 'github.com' && /^\/[^/]+\/[^/]+/.test(path)) return 'github';
    if (host === 'youtube.com' || host === 'youtu.be') return 'youtube';
    if (host.includes('reddit.com')) return 'reddit';
    if (host === 'news.ycombinator.com') return 'hackernews';
    if (host === 'producthunt.com') return 'producthunt';
    if (host === 'x.com' || host === 'twitter.com') return 'tweet';
    return 'article';
  } catch {
    return 'unknown';
  }
}

// ── GitHub extraction ─────────────────────────────────────────────

async function extractGitHub(url) {
  const match = url.match(/github\.com\/([^/]+)\/([^/\s?#]+)/);
  if (!match) return { title: url, content: '', author: null, metadata: {} };

  const [, owner, repo] = match;
  const cleanRepo = repo.replace(/\.git$/, '');

  const resp = await fetch(`https://api.github.com/repos/${owner}/${cleanRepo}`, {
    signal: AbortSignal.timeout(10_000),
    headers: { 'User-Agent': 'claudelists/1.0' },
  });

  if (!resp.ok) return { title: `${owner}/${cleanRepo}`, content: '', author: owner, metadata: {} };

  const data = await resp.json();

  // Try to get README
  let readme = '';
  try {
    const readmeResp = await fetch(`https://raw.githubusercontent.com/${owner}/${cleanRepo}/${data.default_branch || 'main'}/README.md`, {
      signal: AbortSignal.timeout(10_000),
      headers: { 'User-Agent': 'claudelists/1.0' },
    });
    if (readmeResp.ok) {
      readme = await readmeResp.text();
      if (readme.length > 3000) readme = readme.substring(0, 3000) + '...';
    }
  } catch { /* skip */ }

  return {
    title: data.full_name,
    content: [data.description, readme].filter(Boolean).join('\n\n'),
    author: owner,
    metadata: {
      stars: data.stargazers_count,
      forks: data.forks_count,
      language: data.language,
      topics: data.topics || [],
      url: data.html_url,
    },
  };
}

// ── YouTube extraction ────────────────────────────────────────────

async function extractYouTube(url) {
  let videoId;
  try {
    const u = new URL(url);
    videoId = u.hostname === 'youtu.be' ? u.pathname.slice(1) : u.searchParams.get('v');
  } catch {
    return { title: url, content: '', author: null, metadata: {} };
  }
  if (!videoId) return { title: url, content: '', author: null, metadata: {} };

  const ytUrl = `https://www.youtube.com/watch?v=${videoId}`;

  // Try YouTube Data API v3 first (best data)
  if (process.env.YOUTUBE_API_KEY) {
    try {
      const apiUrl = `https://www.googleapis.com/youtube/v3/videos?id=${videoId}&part=snippet,statistics,contentDetails&key=${process.env.YOUTUBE_API_KEY}`;
      const resp = await fetch(apiUrl, { signal: AbortSignal.timeout(10_000) });
      if (resp.ok) {
        const data = await resp.json();
        const video = data.items?.[0];
        if (video) {
          const s = video.snippet;
          const stats = video.statistics;
          const dur = video.contentDetails?.duration || '';
          const durationSec = dur.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
          const seconds = durationSec
            ? (parseInt(durationSec[1] || 0) * 3600) + (parseInt(durationSec[2] || 0) * 60) + parseInt(durationSec[3] || 0)
            : 0;

          const viewCount = parseInt(stats.viewCount || 0);
          const likeCount = parseInt(stats.likeCount || 0);
          const commentCount = parseInt(stats.commentCount || 0);

          // Fetch channel stats for subscriber count
          let subscriberCount = 0;
          let channelVideoCount = 0;
          if (s.channelId) {
            try {
              const chResp = await fetch(
                `https://www.googleapis.com/youtube/v3/channels?id=${s.channelId}&part=statistics&key=${process.env.YOUTUBE_API_KEY}`,
                { signal: AbortSignal.timeout(10_000) }
              );
              if (chResp.ok) {
                const chData = await chResp.json();
                const chStats = chData.items?.[0]?.statistics;
                if (chStats) {
                  subscriberCount = parseInt(chStats.subscriberCount || 0);
                  channelVideoCount = parseInt(chStats.videoCount || 0);
                }
              }
            } catch { /* skip channel fetch */ }
          }

          // Calculate velocity metrics
          const publishedAt = s.publishedAt;
          const daysSincePublish = publishedAt
            ? Math.max(1, Math.floor((Date.now() - new Date(publishedAt).getTime()) / 86400000))
            : null;
          const viewsPerDay = daysSincePublish ? Math.round(viewCount / daysSincePublish) : null;
          const likeRatio = viewCount > 0 ? (likeCount / viewCount * 100).toFixed(2) : null;
          const commentRatio = viewCount > 0 ? (commentCount / viewCount * 100).toFixed(3) : null;
          const viewsPerSubscriber = subscriberCount > 0 ? (viewCount / subscriberCount).toFixed(2) : null;

          return {
            title: s.title,
            content: (s.description || '').substring(0, 3000),
            author: s.channelTitle || null,
            metadata: {
              videoId,
              url: ytUrl,
              viewCount,
              likeCount,
              commentCount,
              publishedAt,
              durationSeconds: seconds,
              channelId: s.channelId,
              subscriberCount,
              channelVideoCount,
              daysSincePublish,
              viewsPerDay,
              likeRatio: likeRatio ? parseFloat(likeRatio) : null,
              commentRatio: commentRatio ? parseFloat(commentRatio) : null,
              viewsPerSubscriber: viewsPerSubscriber ? parseFloat(viewsPerSubscriber) : null,
            },
          };
        }
      }
    } catch { /* fall through to HTML scraping */ }
  }

  // Fallback: scrape ytInitialPlayerResponse from page HTML
  try {
    const resp = await fetch(ytUrl, {
      signal: AbortSignal.timeout(10_000),
      headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36' },
    });
    if (!resp.ok) return { title: url, content: '', author: null, metadata: {} };
    const html = await resp.text();

    // Try to get rich data from ytInitialPlayerResponse JSON
    const playerMatch = html.match(/var ytInitialPlayerResponse\s*=\s*(\{.+?\});/s);
    if (playerMatch) {
      try {
        const playerData = JSON.parse(playerMatch[1]);
        const vd = playerData.videoDetails || {};
        return {
          title: vd.title || 'YouTube Video',
          content: (vd.shortDescription || '').substring(0, 3000),
          author: vd.author || null,
          metadata: {
            videoId,
            url: ytUrl,
            viewCount: parseInt(vd.viewCount || 0),
            durationSeconds: parseInt(vd.lengthSeconds || 0),
            channelId: vd.channelId || null,
          },
        };
      } catch { /* fall through to meta tags */ }
    }

    // Last resort: meta tags
    const title = html.match(/<meta name="title" content="([^"]+)"/)?.[1]
      || html.match(/<title>([^<]+)<\/title>/)?.[1]?.replace(' - YouTube', '')
      || 'YouTube Video';
    const description = html.match(/<meta name="description" content="([^"]+)"/)?.[1] || '';
    const author = html.match(/"ownerChannelName":"([^"]+)"/)?.[1] || null;
    return { title, content: description, author, metadata: { videoId, url: ytUrl } };
  } catch {
    return { title: url, content: '', author: null, metadata: {} };
  }
}

// ── Reddit extraction ─────────────────────────────────────────────

async function extractReddit(url) {
  // Convert to JSON endpoint
  let jsonUrl = url.replace(/\/?$/, '.json');
  if (!jsonUrl.includes('.json')) jsonUrl += '.json';

  try {
    const resp = await fetch(jsonUrl, {
      signal: AbortSignal.timeout(10_000),
      headers: { 'User-Agent': 'claudelists/1.0' },
    });
    if (!resp.ok) return fallbackExtract(url);

    const data = await resp.json();
    const post = Array.isArray(data) ? data[0]?.data?.children?.[0]?.data : data?.data?.children?.[0]?.data;
    if (!post) return fallbackExtract(url);

    return {
      title: post.title || 'Reddit Post',
      content: (post.selftext || '').substring(0, 3000),
      author: post.author || null,
      metadata: {
        subreddit: post.subreddit_name_prefixed || null,
        score: post.score || 0,
        numComments: post.num_comments || 0,
        url: `https://reddit.com${post.permalink || ''}`,
      },
    };
  } catch {
    return fallbackExtract(url);
  }
}

// ── Hacker News extraction ────────────────────────────────────────

async function extractHackerNews(url) {
  const match = url.match(/id=(\d+)/);
  if (!match) return fallbackExtract(url);

  try {
    const resp = await fetch(`https://hacker-news.firebaseio.com/v0/item/${match[1]}.json`, {
      signal: AbortSignal.timeout(10_000),
    });
    if (!resp.ok) return fallbackExtract(url);

    const item = await resp.json();
    return {
      title: item.title || 'Hacker News Post',
      content: item.text || item.url || '',
      author: item.by || null,
      metadata: {
        score: item.score || 0,
        hnUrl: `https://news.ycombinator.com/item?id=${item.id}`,
        externalUrl: item.url || null,
      },
    };
  } catch {
    return fallbackExtract(url);
  }
}

// ── Generic article extraction ────────────────────────────────────

async function extractArticle(url) {
  try {
    const resp = await fetch(url, {
      signal: AbortSignal.timeout(15_000),
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; claudelists/1.0)' },
    });
    if (!resp.ok) return { title: url, content: '', author: null, metadata: {} };

    const html = await resp.text();

    const title = html.match(/<meta property="og:title" content="([^"]+)"/)?.[1]
      || html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim()
      || url;

    const description = html.match(/<meta property="og:description" content="([^"]+)"/)?.[1]
      || html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)/i)?.[1]
      || '';

    const author = html.match(/<meta[^>]*name=["']author["'][^>]*content=["']([^"']+)/i)?.[1]
      || html.match(/<meta property="article:author" content="([^"]+)"/)?.[1]
      || null;

    // Extract main text content (rough, strips tags)
    let bodyText = '';
    const articleMatch = html.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
    if (articleMatch) {
      bodyText = articleMatch[1]
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .substring(0, 3000);
    }

    return {
      title,
      content: [description, bodyText].filter(Boolean).join('\n\n'),
      author,
      metadata: { url },
    };
  } catch {
    return { title: url, content: '', author: null, metadata: {} };
  }
}

// ── Fallback extraction ───────────────────────────────────────────

async function fallbackExtract(url) {
  try {
    const resp = await fetch(url, {
      signal: AbortSignal.timeout(10_000),
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; claudelists/1.0)' },
    });
    if (!resp.ok) return { title: url, content: '', author: null, metadata: {} };

    const html = await resp.text();
    const title = html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim() || url;
    const description = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)/i)?.[1] || '';

    return { title, content: description, author: null, metadata: { url } };
  } catch {
    return { title: url, content: '', author: null, metadata: {} };
  }
}

// ── Main extract function ─────────────────────────────────────────

export async function extractFromUrl(url) {
  const urlType = detectUrlType(url);
  console.log(`Extracting content from ${urlType}: ${url}`);

  let extracted;
  switch (urlType) {
    case 'github':
      extracted = await extractGitHub(url);
      break;
    case 'youtube':
      extracted = await extractYouTube(url);
      break;
    case 'reddit':
      extracted = await extractReddit(url);
      break;
    case 'hackernews':
      extracted = await extractHackerNews(url);
      break;
    case 'tweet':
      // For tweets, we just store the URL. Tweet content will come from posting.
      extracted = await fallbackExtract(url);
      break;
    default:
      extracted = await extractArticle(url);
  }

  return {
    ...extracted,
    sourceUrl: url,
    urlType,
  };
}

// ── Analyze extracted content with Claude ─────────────────────────

const CATEGORIES = [
  'Claude Code',
  'Claude Cowork',
  'Specialized Prompts',
  'Workflows & Automation',
  'Tools & Integrations',
  'Tutorials & Guides',
  'Official Updates',
  'Community Showcase',
];

const CLAUDE_TOOLS = ['claude-chat', 'claude-code', 'claude-cowork', 'mcp', 'api', 'multiple'];
const SKILL_LEVELS = ['beginner', 'intermediate', 'advanced'];
const CONTENT_FORMATS = ['video', 'written-guide', 'prompt-collection', 'code-example', 'case-study', 'news', 'discussion'];

export async function analyzeContent(extracted) {
  // Build YouTube engagement summary if available
  const ytMeta = extracted.metadata || {};
  const hasYtEngagement = extracted.urlType === 'youtube' && ytMeta.viewCount;
  let ytEngagementBlock = '';
  if (hasYtEngagement) {
    const lines = [
      `- Views: ${ytMeta.viewCount.toLocaleString()}`,
      ytMeta.likeCount ? `- Likes: ${ytMeta.likeCount.toLocaleString()}` : '',
      ytMeta.commentCount ? `- Comments: ${ytMeta.commentCount.toLocaleString()}` : '',
      ytMeta.durationSeconds ? `- Duration: ${Math.floor(ytMeta.durationSeconds / 60)}m ${ytMeta.durationSeconds % 60}s` : '',
      ytMeta.publishedAt ? `- Published: ${ytMeta.publishedAt}` : '',
      ytMeta.daysSincePublish ? `- Days since publish: ${ytMeta.daysSincePublish}` : '',
      ytMeta.viewsPerDay ? `- Views/day: ${ytMeta.viewsPerDay.toLocaleString()}` : '',
      ytMeta.subscriberCount ? `- Channel subscribers: ${ytMeta.subscriberCount.toLocaleString()}` : '',
      ytMeta.viewsPerSubscriber ? `- Views/subscriber ratio: ${ytMeta.viewsPerSubscriber}x` : '',
      ytMeta.likeRatio ? `- Like rate: ${ytMeta.likeRatio}%` : '',
      ytMeta.commentRatio ? `- Comment rate: ${ytMeta.commentRatio}%` : '',
      ytMeta.channelVideoCount ? `- Channel total videos: ${ytMeta.channelVideoCount.toLocaleString()}` : '',
    ].filter(Boolean).join('\n');
    ytEngagementBlock = `\n\nYouTube Engagement Data:\n${lines}`;
  }

  const prompt = `You are analyzing a resource for claudelists.com, a curated directory of Claude ecosystem resources.

Given this content, return a JSON object with:
- "title": short descriptive title (max 80 chars)
- "summary": 1-2 sentence summary for discovering Claude resources (max 200 chars). Never use em dashes.
- "category": exactly one of: ${CATEGORIES.map(c => `"${c}"`).join(', ')}
- "tags": array of 2-5 lowercase hyphenated tags (e.g. ["claude-code", "mcp-server"])
- "claude_tool": which Claude product/tool is most relevant. One of: ${CLAUDE_TOOLS.map(t => `"${t}"`).join(', ')}
- "skill_level": target audience skill level. One of: ${SKILL_LEVELS.map(s => `"${s}"`).join(', ')}
- "content_format": format of the content. One of: ${CONTENT_FORMATS.map(f => `"${f}"`).join(', ')}
- "ai_quality_score": integer 1-10 (see scoring guide below)
- "tweet_draft": a tweet (max 280 chars) from @claudelists. Include the resource URL. Never use em dashes.
  TONE: Loss aversion + social proof. Imply the reader is missing out on what others already know or use. Frame inaction as a cost. Use "you" directly. Short, punchy, slightly spicy. Not mean, but makes you feel behind. Examples of the voice:
  - "84K devs already know about X. You probably don't. Fix that."
  - "The difference between 'Claude is okay' and 'Claude is incredible' is usually 5 lines in your CLAUDE.md. Most people never configure it."
  - "The Claude power users in your timeline are all running MCP servers. The rest are wondering why their setup feels slow."

CATEGORY GUIDELINES:
- "Claude Code": Claude Code CLI/desktop app, setup guides, features, integrations, voice mode, hooks, scheduled tasks, development workflows
- "Claude Cowork": Claude Cowork desktop app tutorials, business automation, real-world applications, collaboration workflows
- "Specialized Prompts": Domain-specific prompt collections (finance, business, content creation, analysis), prompt libraries
- "Workflows & Automation": Pipelines, automation using Claude, CI/CD with AI, scheduled tasks, skills, agents, agent SDK, multi-agent systems
- "Tools & Integrations": SDKs, CLI tools, VS Code extensions, MCP servers, developer tooling for Claude
- "Tutorials & Guides": How-to content, walkthroughs, educational material, setup guides, CLAUDE.md configs (not specific to Code or Cowork)
- "Official Updates": Official Anthropic announcements, releases, model updates, courses, platform changes
- "Community Showcase": Things people built with Claude, demos, case studies, community discussions, opinions, comparisons, reviews

CLAUDE TOOL GUIDELINES:
- "claude-chat": General Claude usage via chat interface, prompts, non-tool-specific content
- "claude-code": Claude Code CLI/desktop app specific content
- "claude-cowork": Claude Cowork desktop app specific content
- "mcp": MCP server/protocol specific content
- "api": Claude API, SDK, programmatic usage
- "multiple": Content covering multiple Claude tools together

SCORING GUIDE:
Base score (content quality):
  1-3: Low value, vague, promotional
  4-5: Below average, thin content
  6: Decent, useful but standard
  7: Good, specific and actionable
  8: Very good, detailed and non-obvious
  9: Excellent, comprehensive guide or significant tool
  10: Exceptional, reference-quality resource

${hasYtEngagement ? `YouTube engagement adjustment (apply ON TOP of content quality score):
For YouTube videos, factor in audience reception signals. These indicate real-world value:
- Views/day velocity: <100/day = neutral, 100-1000/day = +1, >1000/day = +1 to +2
- Views/subscriber ratio: >0.5x = good reach (+1), >2x = viral/breakout (+1 to +2)
- Like rate: >3% is strong (+1), >5% is exceptional (+1 to +2). Average is ~2-4%.
- Comment rate: >0.1% is engaged, >0.3% = highly engaged (+1)
- A video published <7 days ago with >10k views shows strong early traction (+1)
- Long-form content (>10min) with high engagement = comprehensive resource, score generously

The final score should blend content quality + engagement. A technically good tutorial (base 7) with viral engagement can reach 9-10. A thin video with high views stays lower (6-7). Never let engagement alone push a low-quality video above 7.` : ''}

Return ONLY valid JSON. No markdown fences, no explanation.

Resource:
- URL: ${extracted.sourceUrl}
- Type: ${extracted.urlType}
- Title: ${extracted.title}
- Author: ${extracted.author || 'unknown'}
- Content: ${(extracted.content || '').substring(0, 2000)}${ytEngagementBlock}
${!hasYtEngagement && extracted.metadata?.viewCount ? `- Views: ${extracted.metadata.viewCount.toLocaleString()}` : ''}
${!hasYtEngagement && extracted.metadata?.likeCount ? `- Likes: ${extracted.metadata.likeCount.toLocaleString()}` : ''}
${!hasYtEngagement && extracted.metadata?.commentCount ? `- Comments: ${extracted.metadata.commentCount.toLocaleString()}` : ''}
${!hasYtEngagement && extracted.metadata?.durationSeconds ? `- Duration: ${Math.floor(extracted.metadata.durationSeconds / 60)}m ${extracted.metadata.durationSeconds % 60}s` : ''}
${!hasYtEngagement && extracted.metadata?.publishedAt ? `- Published: ${extracted.metadata.publishedAt}` : ''}
${extracted.metadata?.stars ? `- GitHub Stars: ${extracted.metadata.stars.toLocaleString()}` : ''}`;

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = response.content[0].text.trim();
  const json = text.replace(/^```json?\n?/, '').replace(/\n?```$/, '');
  const result = JSON.parse(json);

  return {
    title: result.title,
    summary: result.summary,
    category: CATEGORIES.includes(result.category) ? result.category : 'Community Showcase',
    tags: result.tags || [],
    claude_tool: CLAUDE_TOOLS.includes(result.claude_tool) ? result.claude_tool : 'claude-chat',
    skill_level: SKILL_LEVELS.includes(result.skill_level) ? result.skill_level : 'intermediate',
    content_format: CONTENT_FORMATS.includes(result.content_format) ? result.content_format : null,
    ai_quality_score: Math.min(10, Math.max(1, result.ai_quality_score || 5)),
    tweet_draft: result.tweet_draft || '',
  };
}

// ── Full pipeline: extract + analyze ──────────────────────────────

export async function processUrl(url) {
  const extracted = await extractFromUrl(url);
  const analysis = await analyzeContent(extracted);

  return {
    ...extracted,
    ...analysis,
  };
}
