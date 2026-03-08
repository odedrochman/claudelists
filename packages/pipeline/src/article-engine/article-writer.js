import { config } from 'dotenv';
config({ override: true });

import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic();
const MODEL = 'claude-sonnet-4-20250514';

/**
 * Generate a URL-safe slug from a title and date.
 */
export function generateSlug(title, date = new Date()) {
  const dateStr = date.toISOString().split('T')[0];
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 60)
    .replace(/-$/, '');
  return `${slug}-${dateStr}`;
}

/**
 * Format resources into a structured prompt input.
 */
function formatResourcesForPrompt(resources) {
  return resources.map((r, i) => ({
    position: i + 1,
    title: r.title,
    summary: r.summary,
    author_handle: r.author_handle || null,
    author_name: r.author_name || null,
    category: r.categories?.name || 'Unknown',
    content_type: r.content_type,
    primary_url: r.primary_url || r.tweet_url,
    tweet_url: r.tweet_url,
    score: r.ai_quality_score,
    has_downloadable: r.has_downloadable,
    tags: (r.resource_tags || []).map(rt => rt.tags?.name).filter(Boolean),
  }));
}

/**
 * Call Claude with retry logic.
 */
async function callClaude(prompt, maxTokens = 8192, maxRetries = 2) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await anthropic.messages.create({
        model: MODEL,
        max_tokens: maxTokens,
        messages: [{ role: 'user', content: prompt }],
      });
      return response.content[0].text.trim();
    } catch (e) {
      if (attempt === maxRetries) throw e;
      const delay = 2000 * Math.pow(2, attempt);
      console.warn(`Claude API error (attempt ${attempt + 1}), retrying in ${delay}ms:`, e.message);
      await new Promise(r => setTimeout(r, delay));
    }
  }
}

/**
 * Parse JSON from Claude's response, stripping markdown fences if present.
 */
function parseClaudeJson(text) {
  let clean = text.trim();
  if (clean.startsWith('```')) {
    clean = clean.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
  }
  return JSON.parse(clean);
}

/**
 * Generate a daily article from a set of resources.
 */
export async function generateDailyArticle(resources) {
  const resourceData = formatResourcesForPrompt(resources);

  const prompt = `You are the editor of ClaudeLists.com (@claudelists on X), writing a daily digest.

TODAY'S RESOURCES (${resources.length} total):

${JSON.stringify(resourceData, null, 2)}

Return a single JSON object with these fields:

1. "title" (string, max 80 chars): Specific, compelling. e.g. "5 MCP Servers That Actually Save You Time"

2. "content" (string, Markdown): A clean, scannable digest. Follow this EXACT structure:

SHORT INTRO (2-3 sentences max). One line about the theme, one about what readers get. Mention ClaudeLists.com.

Then for EACH resource, write a section like this (use ## heading):

## Resource Title

2-3 sentences: what it does and why it matters. Be specific, give a concrete example.

**Who it's for:** One sentence. Be specific (e.g. "Anyone building MCP integrations who's tired of boilerplate").

**Quick take:** One honest sentence. Your editorial opinion.

Shared by [@author_handle](https://x.com/author_handle)

---

After all resources, a SHORT closing (2-3 sentences): pattern/trend + CTA ("Tag @claudelists on X or submit at [claudelists.com/submit](https://claudelists.com/submit)").

FORMATTING RULES:
- Use --- (horizontal rule) between each resource section for visual separation
- Use [link text](url) for ALL URLs. Never show raw URLs.
- Author handles MUST be hyperlinked: [@handle](https://x.com/handle)
- Resource titles in ## headings should be PLAIN TEXT (no hyperlinks). The tweet embed provides the link.
- Keep it SHORT. Each resource section should be 4-6 lines, not paragraphs of text.
- Total article: aim for 40-50 lines. Concise and scannable, not essay-length.
- Bold labels ("**Who it's for:**", "**Quick take:**") for scannability.
- One blank line between paragraphs. Plenty of whitespace.

3. "tweetThread" (array of strings, each max 280 chars):
   - Tweet 1: Hook + {{ARTICLE_URL}} + @claudelists
   - Tweets 2-N (one per resource): What it does in one punchy line. Tag @author_handle.
   - Final tweet: "Follow @claudelists for daily Claude updates. Found something good? Tag us. claudelists.com" + 2-3 hashtags.

4. "promoTweet" (string, max 280 chars): Standalone tweet. Hook + {{ARTICLE_URL}} + @claudelists + 2 hashtags.

5. "metaDescription" (string, max 160 chars): SEO description with "ClaudeLists".

6. "ogTitle" (string, max 60 chars): Short title for social card.

CRITICAL RULES:
- NEVER use em dashes. Use periods, commas, or parentheses.
- NEVER use: "leveraging", "harnessing", "AI-powered", "game-changer", "revolutionary", "cutting-edge", "unlock", "empower", "delve", "tapestry", "robust", "seamless", "streamline", "landscape", "paradigm"
- Write like a knowledgeable friend, not a press release.
- ALL @handles MUST be markdown hyperlinks to their X profile.
- ALL resource URLs MUST be markdown hyperlinks, never raw.
- Use {{ARTICLE_URL}} placeholder for the article URL.
- Hashtag options: #Claude #ClaudeCode #MCP #AI #Anthropic #AITools #LLM #AgentSDK

Return ONLY valid JSON. No markdown fences, no extra text.`;

  const raw = await callClaude(prompt, 4096);
  const result = parseClaudeJson(raw);

  return {
    title: result.title,
    slug: generateSlug(result.title),
    content: result.content,
    tweetThread: result.tweetThread,
    promoTweet: result.promoTweet,
    metaDescription: result.metaDescription,
    ogTitle: result.ogTitle,
    articleType: 'daily',
  };
}

/**
 * Generate a weekly summary from that week's daily articles.
 */
export async function generateWeeklySummary(dailyArticles, resources, weekStart, weekEnd) {
  const articleSummaries = dailyArticles.map(a => ({
    title: a.title,
    resourceCount: (a.article_resources || []).length,
    publishedAt: a.published_at,
  }));

  const resourceData = formatResourcesForPrompt(resources);

  const prompt = `You are the editor of ClaudeLists.com (@claudelists on X), writing the WEEKLY DIGEST for ${weekStart} to ${weekEnd}.

This week: ${dailyArticles.length} daily digests, ${resources.length} resources.

Daily digests published:
${JSON.stringify(articleSummaries, null, 2)}

All resources this week:
${JSON.stringify(resourceData, null, 2)}

Return a JSON object:

1. "title" (max 80 chars): e.g. "This Week in Claude: The 15 Tools That Stood Out (March 3-9)"

2. "content" (Markdown): Clean, scannable weekly roundup.

Structure:

SHORT INTRO (2-3 sentences). Stats, theme, who should read this.

## Top Picks

For the 3-5 best resources this week, write a section each:

### [Resource Title](url)

2-3 sentences on what it does and why it stood out. Tag [@handle](https://x.com/handle).

---

## Also Worth a Look

For remaining resources, write 1-2 lines each with a hyperlinked title and [@handle](https://x.com/handle). Use a bullet list.

## Trends This Week

2-3 sentences on patterns and where things are heading.

SHORT CLOSING with CTA: tag @claudelists or submit at [claudelists.com/submit](https://claudelists.com/submit).

FORMATTING: Same rules as daily (hyperlinks everywhere, no raw URLs, --- between sections, bold labels, concise).

3. "tweetThread" (array, max 280 chars each)
4. "promoTweet" (max 280 chars) with {{ARTICLE_URL}} + @claudelists + 2 hashtags
5. "metaDescription" (max 160 chars)
6. "ogTitle" (max 60 chars)

CRITICAL RULES:
- NEVER use em dashes. Use periods, commas, or parentheses.
- NEVER use: "leveraging", "harnessing", "AI-powered", "game-changer", "revolutionary", "cutting-edge", "unlock", "empower", "delve", "tapestry", "robust", "seamless", "streamline", "landscape", "paradigm"
- ALL @handles and URLs MUST be markdown hyperlinks.
- Use {{ARTICLE_URL}} placeholder.

Return ONLY valid JSON.`;

  const raw = await callClaude(prompt, 6144);
  const result = parseClaudeJson(raw);

  return {
    title: result.title,
    slug: generateSlug(result.title),
    content: result.content,
    tweetThread: result.tweetThread,
    promoTweet: result.promoTweet,
    metaDescription: result.metaDescription,
    ogTitle: result.ogTitle,
    articleType: 'weekly',
    periodStart: weekStart,
    periodEnd: weekEnd,
  };
}

/**
 * Generate a monthly summary.
 */
export async function generateMonthlySummary(dailyArticles, weeklyArticles, resources, monthStart, monthEnd) {
  const resourceData = formatResourcesForPrompt(resources);

  const categoryStats = {};
  for (const r of resourceData) {
    categoryStats[r.category] = (categoryStats[r.category] || 0) + 1;
  }

  const authorCounts = {};
  for (const r of resourceData) {
    if (r.author_handle) {
      authorCounts[r.author_handle] = (authorCounts[r.author_handle] || 0) + 1;
    }
  }

  const prompt = `You are the editor of ClaudeLists.com (@claudelists on X), writing the MONTHLY ROUNDUP for ${monthStart} to ${monthEnd}.

Stats: ${dailyArticles.length} dailies, ${weeklyArticles.length} weeklies, ${resources.length} resources.
Categories: ${JSON.stringify(categoryStats)}
Top contributors: ${JSON.stringify(authorCounts)}

All resources (by score):
${JSON.stringify(resourceData.sort((a, b) => (b.score || 0) - (a.score || 0)), null, 2)}

Return a JSON object:

1. "title" (max 80 chars): e.g. "March 2026: The 30 Best Claude Resources You Might Have Missed"

2. "content" (Markdown): Clean monthly roundup.

Structure:

SHORT INTRO (2-3 sentences). Big picture, stats, who should read.

## Top 5 of the Month

For each of the 5 best resources:

### [Title](url)

2-3 sentences: what it is, why it's top of the month. Tag [@handle](https://x.com/handle).

---

## By Category

Group remaining resources by category. For each category, use an H3 heading, then a bullet list with 1-line descriptions per resource. Hyperlink titles and @handles.

## Trends and Patterns

3-4 sentences on what emerged this month.

## Community Spotlight

Shout out top contributors by [@handle](https://x.com/handle). Keep it brief and genuine.

SHORT CLOSING with CTA.

FORMATTING: Hyperlinks everywhere, no raw URLs, --- between major sections, concise.

3. "tweetThread" (array, max 280 chars each)
4. "promoTweet" (max 280 chars) with {{ARTICLE_URL}} + @claudelists + 2 hashtags
5. "metaDescription" (max 160 chars)
6. "ogTitle" (max 60 chars)

CRITICAL RULES:
- NEVER use em dashes. Use periods, commas, or parentheses.
- NEVER use: "leveraging", "harnessing", "AI-powered", "game-changer", "revolutionary", "cutting-edge", "unlock", "empower", "delve", "tapestry", "robust", "seamless", "streamline", "landscape", "paradigm"
- ALL @handles and URLs MUST be markdown hyperlinks.
- Use {{ARTICLE_URL}} placeholder.

Return ONLY valid JSON.`;

  const raw = await callClaude(prompt, 8192);
  const result = parseClaudeJson(raw);

  return {
    title: result.title,
    slug: generateSlug(result.title),
    content: result.content,
    tweetThread: result.tweetThread,
    promoTweet: result.promoTweet,
    metaDescription: result.metaDescription,
    ogTitle: result.ogTitle,
    articleType: 'monthly',
    periodStart: monthStart,
    periodEnd: monthEnd,
  };
}
