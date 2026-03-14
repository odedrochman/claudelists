import { NextResponse } from 'next/server';
import { createServiceClient } from '../../../../lib/supabase';

function checkAdminKey(request) {
  const { searchParams } = new URL(request.url);
  const key = searchParams.get('key');
  return key && key === process.env.ADMIN_SECRET_KEY;
}

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

function formatResourcesForPrompt(resources) {
  return resources.map((r, i) => ({
    position: i + 1,
    id: r.id,
    original_url: r.primary_url || r.tweet_url,
    title: r.title,
    summary: r.summary,
    author_handle: r.author_handle || null,
    author_name: r.author_name || null,
    category: r.categories?.name || 'Unknown',
    content_type: r.content_type,
    tweet_url: r.tweet_url,
    score: r.ai_quality_score,
    has_downloadable: r.has_downloadable,
    tags: (r.resource_tags || []).map(rt => rt.tags?.name).filter(Boolean),
  }));
}

function parseClaudeJson(text) {
  let clean = text.trim();
  if (clean.startsWith('```')) {
    clean = clean.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
  }
  return JSON.parse(clean);
}

async function callClaude(prompt, maxTokens = 4096) {
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: maxTokens,
    messages: [{ role: 'user', content: prompt }],
  });

  return response.content[0].text.trim();
}

function buildDailyPrompt(resources) {
  const resourceData = formatResourcesForPrompt(resources);

  return `You are the editor of ClaudeLists.com (@claudelists on X), writing a daily digest.

EDITORIAL PHILOSOPHY: Every digest must deliver unique value. You are NOT writing a link dump. Before writing, ask yourself: "What specific thing does the reader gain from THIS digest that they can't get anywhere else?" The answer should be synthesis, pattern recognition, tested recommendations, or a clear action the reader can take. If a resource exists, explain what the reader GETS from it (the outcome), not just what it IS (the feature).

TODAY'S RESOURCES (${resources.length} total):

${JSON.stringify(resourceData, null, 2)}

Return a single JSON object with these fields:

1. "title" (string, max 80 chars): Specific, compelling. Sell the VALUE, not the topic. e.g. "5 MCP Servers That Actually Save You Time" not "5 New MCP Servers This Week"

2. "content" (string, Markdown): A clean, scannable digest. Follow this EXACT structure:

SHORT INTRO (2-3 sentences max). Open with the VALUE the reader gets from this digest (what they'll be able to do or know after reading). NOT "here are today's resources."

Then for EACH resource, write a section like this (use ## heading):

## [Resource Title](original_url)

Where original_url is the resource's original_url from the data. This links the heading to the ORIGINAL external source (tweet, blog post, GitHub repo, etc.), NOT to claudelists.com.

2-3 sentences: Focus on what the reader GETS from this (time saved, problem solved, capability gained), not just what it does. Be specific, give a concrete example of the outcome.

**Who it's for:** One sentence. Be specific (e.g. "Anyone building MCP integrations who's tired of boilerplate").

**Quick take:** One honest sentence. Your editorial opinion on the value it delivers.

Shared by [@author_handle](https://x.com/author_handle)

---

After all resources, a SHORT closing (2-3 sentences): Tie it together with a pattern or insight the reader wouldn't see from the individual resources alone, then CTA ("Tag @claudelists on X or submit at [claudelists.com/submit](https://claudelists.com/submit)").

FORMATTING RULES:
- Use --- (horizontal rule) between each resource section for visual separation
- Use [link text](url) for ALL URLs. Never show raw URLs.
- Author handles MUST be hyperlinked: [@handle](https://x.com/handle)
- Resource titles in ## headings MUST link to the ORIGINAL external URL (original_url from the data). NEVER link to claudelists.com resource pages.
- Keep it SHORT. Each resource section should be 4-6 lines, not paragraphs of text.
- Total article: aim for 40-50 lines. Concise and scannable, not essay-length.
- Bold labels ("**Who it's for:**", "**Quick take:**") for scannability.
- One blank line between paragraphs. Plenty of whitespace.

3. "metaDescription" (string, max 160 chars): SEO description with "ClaudeLists".

4. "ogTitle" (string, max 60 chars): Short title for social card.

5. "ogQuote" (string, max 80 chars): A punchy, value-driven one-liner for the OG social card image. This is the text that makes someone scrolling X stop and click. It must speak directly to the READER about what THEY will gain. Always use second person ("you", "your"). The reader should see themselves benefiting.

GOOD ogQuote examples:
- "You're mass-DM'ing when you could be automating your outreach"
- "Stop spending your first hour catching up"
- "Your PR reviews could take 5 minutes instead of 30"
- "You don't need 4 browser tabs for this anymore"
- "Your Claude setup is missing the one config that matters"

BAD ogQuote examples:
- "I automated my entire review pipeline" (first person, about the author not the reader)
- "5 Amazing New Tools You Need to See" (generic, no specific value)
- "The Future of AI Development" (vague, no reader benefit)

ogQuote rules:
- ALWAYS second person ("you", "your"). Never first person. The reader is the hero, not us.
- Specific and concrete (mention a real outcome, number, or time saved)
- No em dashes, no quotation marks (added visually)
- Must relate to the BEST or most impactful resource in today's digest
- Under 80 characters (shorter is better, aim for 40-60)

CRITICAL RULES:
- NEVER use em dashes. Use periods, commas, or parentheses.
- NEVER use: "leveraging", "harnessing", "AI-powered", "game-changer", "revolutionary", "cutting-edge", "unlock", "empower", "delve", "tapestry", "robust", "seamless", "streamline", "landscape", "paradigm"
- NEVER link to claudelists.com anywhere in the content. No claudelists.com/resource/ links, no claudelists.com/digest/ links. The ONLY exception is the submit CTA at the very end (claudelists.com/submit).
- ALL ## heading links MUST use the original_url (external source), NEVER claudelists.com.
- Do NOT mention "ClaudeLists.com" in the intro or body. The digest stands on its own.
- ONLY use URLs that appear in the resource data above. NEVER invent, guess, or hallucinate any URL. Do not link to claude.ai, anthropic.com, or any other URL not provided in the data.
- Write like a knowledgeable friend, not a press release.
- ALL @handles MUST be markdown hyperlinks to their X profile.
- ALL resource URLs MUST be markdown hyperlinks, never raw.
- Hashtag options: #Claude #ClaudeCode #MCP #AI #Anthropic #AITools #LLM #AgentSDK

Return ONLY valid JSON. No markdown fences, no extra text.`;
}

function buildWeeklyPrompt(resources, weekStart, weekEnd) {
  const resourceData = formatResourcesForPrompt(resources);

  return `You are the editor of ClaudeLists.com (@claudelists on X), writing the WEEKLY DIGEST for ${weekStart} to ${weekEnd}.

EDITORIAL PHILOSOPHY: A weekly digest is NOT a recap. It's a synthesis. The reader should walk away understanding what shifted this week and what they should do differently starting Monday. Your unique value is pattern recognition across ${resources.length} resources that no individual tweet or article provides. Ask yourself: "What would the reader do differently after reading this?" If the answer is nothing, rewrite it.

This week: ${resources.length} resources discovered.

All resources this week:
${JSON.stringify(resourceData, null, 2)}

Return a JSON object:

1. "title" (max 80 chars): Sell the insight, not the format. e.g. "Claude Code Went Multi-Agent This Week. Here's What That Means for You." NOT "This Week in Claude: 15 Resources (March 3-9)"

2. "content" (Markdown): Clean, scannable weekly roundup.

Structure:

SHORT INTRO (2-3 sentences). Lead with what changed this week and why it matters to the reader personally. Not just stats.

## Top Picks

For the 3-5 best resources this week, write a section each:

### [Resource Title](original_url)

Use the resource's original_url (external source). NEVER use claudelists.com links.

2-3 sentences on the specific value it delivers and why it stood out. Focus on outcomes (time saved, problems solved, new capability), not features. Tag [@handle](https://x.com/handle).

---

## Also Worth a Look

For remaining resources, write 1-2 lines each with a hyperlinked title (using original_url) and [@handle](https://x.com/handle). Use a bullet list.

## Trends This Week

2-3 sentences on patterns the reader wouldn't see from individual resources. What's the bigger picture? What should they prepare for or act on?

SHORT CLOSING with CTA: tag @claudelists or submit at [claudelists.com/submit](https://claudelists.com/submit).

FORMATTING: Same rules as daily (hyperlinks everywhere, no raw URLs, --- between sections, bold labels, concise).

3. "metaDescription" (max 160 chars)
4. "ogTitle" (max 60 chars)

5. "ogQuote" (string, max 80 chars): A punchy, value-driven one-liner for the OG social card image. Same rules as daily: ALWAYS second person ("you", "your"), specific outcome, no em dashes, no quotation marks. For weekly, capture the single most valuable insight the reader gets from this week's roundup.

CRITICAL RULES:
- NEVER use em dashes. Use periods, commas, or parentheses.
- NEVER use: "leveraging", "harnessing", "AI-powered", "game-changer", "revolutionary", "cutting-edge", "unlock", "empower", "delve", "tapestry", "robust", "seamless", "streamline", "landscape", "paradigm"
- NEVER link to claudelists.com anywhere in the content. No claudelists.com/resource/ links, no claudelists.com/digest/ links. The ONLY exception is the submit CTA at the very end (claudelists.com/submit).
- ALL resource links MUST use original_url (external source), NEVER claudelists.com.
- Do NOT mention "ClaudeLists.com" in the intro or body.
- ONLY use URLs that appear in the resource data above. NEVER invent, guess, or hallucinate any URL. Do not link to claude.ai, anthropic.com, or any other URL not provided in the data.
- ALL @handles and URLs MUST be markdown hyperlinks.

Return ONLY valid JSON.`;
}

// ── Daily generation ─────────────────────────────────────────

async function generateDaily(supabase, count) {
  // 1. Select unfeatured resources
  const { data: resources, error: fetchErr } = await supabase
    .from('resources')
    .select(`
      id, title, summary, tweet_text, tweet_url, author_handle, author_name,
      content_type, primary_url, expanded_links, has_downloadable,
      ai_quality_score, engagement, tweet_created_at, discovered_at,
      categories ( name, slug ),
      resource_tags ( tags ( name ) )
    `)
    .eq('featured_in_daily', false)
    .eq('status', 'published')
    .neq('author_handle', 'claudelists')
    .order('ai_quality_score', { ascending: false, nullsFirst: false })
    .order('discovered_at', { ascending: false })
    .limit(count + 5); // fetch extra to filter out self-referencing URLs

  if (fetchErr) throw new Error(`Failed to fetch resources: ${fetchErr.message}`);

  // Filter out resources that link back to claudelists.com
  const filtered = (resources || []).filter(r => {
    const url = r.primary_url || '';
    return !url.includes('claudelists.com');
  }).slice(0, count);

  if (filtered.length < 2) {
    return { error: `Not enough external resources (found ${filtered.length}, need at least 2)` };
  }

  // 2. Generate with Claude
  const prompt = buildDailyPrompt(filtered);
  const raw = await callClaude(prompt, 4096);
  const result = parseClaudeJson(raw);

  // 3. Save article as draft
  const slug = generateSlug(result.title);
  const { data: article, error: insertErr } = await supabase
    .from('articles')
    .insert({
      slug,
      title: result.title,
      article_type: 'daily',
      content: result.content,
      meta_description: result.metaDescription || '',
      og_title: result.ogTitle || result.title,
      og_quote: result.ogQuote || null,
      status: 'draft',
    })
    .select('id, slug, title, status')
    .single();

  if (insertErr) throw new Error(`Failed to save article: ${insertErr.message}`);

  // 4. Link resources
  const resourceIds = filtered.map(r => r.id);
  const junctionRows = resourceIds.map((rid, i) => ({
    article_id: article.id,
    resource_id: rid,
    position: i,
  }));

  const { error: linkErr } = await supabase
    .from('article_resources')
    .insert(junctionRows);

  if (linkErr) console.warn('Failed to link resources:', linkErr.message);

  // 5. Mark resources as featured
  const { error: markErr } = await supabase
    .from('resources')
    .update({
      featured_in_daily: true,
      featured_daily_at: new Date().toISOString(),
    })
    .in('id', resourceIds);

  if (markErr) console.warn('Failed to mark resources as featured:', markErr.message);

  // 5b. Fire non-blocking OG background generation for the article
  try {
    const { generateArticleBackground } = await import('../../../../lib/og-background');
    generateArticleBackground('daily', result.title, article.id).catch(e =>
      console.warn('Daily digest OG background failed:', e.message)
    );
  } catch (e) {
    console.warn('Daily digest OG background skipped:', e.message);
  }

  // 6. Count remaining unfeatured
  const { count: remaining } = await supabase
    .from('resources')
    .select('id', { count: 'exact', head: true })
    .eq('featured_in_daily', false)
    .eq('status', 'published');

  return {
    article: { id: article.id, slug: article.slug, title: article.title },
    resourceCount: filtered.length,
    unfeaturedRemaining: remaining || 0,
  };
}

// ── Weekly generation ────────────────────────────────────────

async function generateWeekly(supabase) {
  // 1. Calculate week range (last 7 days)
  const end = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - 7);
  const weekStart = start.toISOString().split('T')[0];
  const weekEnd = end.toISOString().split('T')[0];

  // 2. Fetch resources featured in daily digests during this week
  const { data: resources, error: resErr } = await supabase
    .from('resources')
    .select(`
      id, title, summary, author_handle, author_name, content_type,
      primary_url, tweet_url, ai_quality_score, has_downloadable,
      categories ( name, slug ),
      resource_tags ( tags ( name ) )
    `)
    .eq('status', 'published')
    .eq('featured_in_daily', true)
    .gte('featured_daily_at', weekStart)
    .lte('featured_daily_at', weekEnd + 'T23:59:59')
    .order('ai_quality_score', { ascending: false, nullsFirst: false });

  if (resErr) throw new Error(`Failed to fetch resources: ${resErr.message}`);
  if (!resources || resources.length === 0) {
    return { error: 'No featured resources found for the past week' };
  }

  const resourceIds = resources.map(r => r.id);

  // 3. Generate with Claude (using only external resources, no self-references)
  const prompt = buildWeeklyPrompt(resources, weekStart, weekEnd);
  const raw = await callClaude(prompt, 6144);
  const result = parseClaudeJson(raw);

  // 6. Save article as draft
  const slug = generateSlug(result.title);
  const { data: article, error: insertErr } = await supabase
    .from('articles')
    .insert({
      slug,
      title: result.title,
      article_type: 'weekly',
      content: result.content,
      meta_description: result.metaDescription || '',
      og_title: result.ogTitle || result.title,
      og_quote: result.ogQuote || null,
      period_start: weekStart,
      period_end: weekEnd,
      status: 'draft',
    })
    .select('id, slug, title, status')
    .single();

  if (insertErr) throw new Error(`Failed to save article: ${insertErr.message}`);

  // 7. Link resources
  if (resourceIds.length > 0) {
    const junctionRows = resourceIds.map((rid, i) => ({
      article_id: article.id,
      resource_id: rid,
      position: i,
    }));

    const { error: linkErr } = await supabase
      .from('article_resources')
      .insert(junctionRows);

    if (linkErr) console.warn('Failed to link resources to weekly:', linkErr.message);
  }

  // 8. Fire non-blocking OG background generation
  try {
    const { generateArticleBackground } = await import('../../../../lib/og-background');
    generateArticleBackground('weekly', result.title, article.id).catch(e =>
      console.warn('Weekly digest OG background failed:', e.message)
    );
  } catch (e) {
    console.warn('Weekly digest OG background skipped:', e.message);
  }

  return {
    article: { id: article.id, slug: article.slug, title: article.title },
    resourceCount: (resources || []).length,
    weekRange: `${weekStart} to ${weekEnd}`,
  };
}

// ── Route handler ────────────────────────────────────────────

export async function POST(request) {
  if (!checkAdminKey(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { type, count } = body;

  if (!['daily', 'weekly'].includes(type)) {
    return NextResponse.json({ error: 'type must be "daily" or "weekly"' }, { status: 400 });
  }

  const supabase = createServiceClient();

  try {
    let result;
    if (type === 'daily') {
      const dailyCount = Math.floor(Math.random() * 4) + 2; // 2-5 resources
      result = await generateDaily(supabase, dailyCount);
    } else {
      result = await generateWeekly(supabase);
    }

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true, ...result });
  } catch (e) {
    console.error(`Generate ${type} digest failed:`, e);
    return NextResponse.json({ error: `Generation failed: ${e.message}` }, { status: 500 });
  }
}
