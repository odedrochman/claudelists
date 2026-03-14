import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ override: true });
config({ path: resolve(__dirname, '../../../apps/web/.env.local'), override: true });

import { Command } from 'commander';
import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';
import { analyzeContent } from './extract-url.js';

const anthropic = new Anthropic();
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const FIREHOSE_TAP_TOKEN = process.env.FIREHOSE_TAP_TOKEN;
const MIN_QUALITY_SCORE = 5;
const MAX_RESOURCES_PER_RUN = 5;

// Domains to skip (our own site, social media that we handle separately)
const BLOCKED_DOMAINS = [
  'claudelists.com',
  'x.com',
  'twitter.com',
  'youtube.com',
  'youtu.be',
  'reddit.com',
  'news.ycombinator.com',
];

// ── Firehose SSE stream ─────────────────────────────────────────

async function streamFirehose({ since = '3h', limit = 100 } = {}) {
  if (!FIREHOSE_TAP_TOKEN) throw new Error('FIREHOSE_TAP_TOKEN not set');

  const url = `https://api.firehose.com/v1/stream?timeout=60&since=${since}&limit=${limit}`;
  console.log(`Connecting to Firehose (since=${since}, limit=${limit})...`);

  const resp = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${FIREHOSE_TAP_TOKEN}`,
      'Accept': 'text/event-stream',
    },
    signal: AbortSignal.timeout(90_000),
  });

  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`Firehose stream failed (${resp.status}): ${body}`);
  }

  // Read the SSE stream line by line from the body reader
  const events = [];
  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let currentEvent = {};
  let dataLines = [];

  function dispatchEvent() {
    if (currentEvent.type === 'update' && dataLines.length > 0) {
      const data = dataLines.join('\n');
      try {
        events.push(JSON.parse(data));
      } catch { /* skip malformed */ }
    }
    currentEvent = {};
    dataLines = [];
  }

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop(); // keep incomplete line in buffer

    for (const line of lines) {
      const trimmed = line.replace(/\r$/, '');
      if (trimmed.startsWith('event: ')) {
        currentEvent.type = trimmed.slice(7).trim();
      } else if (trimmed.startsWith('data: ')) {
        dataLines.push(trimmed.slice(6));
      } else if (trimmed.startsWith('id: ')) {
        currentEvent.id = trimmed.slice(4).trim();
      } else if (trimmed === '') {
        dispatchEvent();
      }
    }
  }
  // Handle any remaining event
  if (currentEvent.type) dispatchEvent();

  console.log(`Received ${events.length} events from Firehose`);
  return events;
}

// ── Filter and deduplicate ──────────────────────────────────────

function urlToId(url) {
  return 'firehose-' + createHash('md5').update(url).digest('hex').slice(0, 16);
}

function isBlockedDomain(url) {
  try {
    const host = new URL(url).hostname.replace('www.', '');
    return BLOCKED_DOMAINS.some(d => host === d || host.endsWith('.' + d));
  } catch {
    return true;
  }
}

async function filterNewEvents(events) {
  // Remove blocked domains
  const filtered = events.filter(e => {
    const url = e.document?.url;
    if (!url) return false;
    if (isBlockedDomain(url)) return false;
    return true;
  });

  if (filtered.length === 0) return [];

  // Deduplicate against DB by tweet_id (firehose-{hash})
  const tweetIds = filtered.map(e => urlToId(e.document.url));
  const { data: existing } = await supabase
    .from('resources')
    .select('tweet_id')
    .in('tweet_id', tweetIds);

  const existingSet = new Set((existing || []).map(r => r.tweet_id));

  // Also deduplicate by primary_url
  const urls = filtered.map(e => e.document.url);
  const { data: existingByUrl } = await supabase
    .from('resources')
    .select('primary_url')
    .in('primary_url', urls);

  const existingUrlSet = new Set((existingByUrl || []).map(r => r.primary_url));

  return filtered.filter(e => {
    const url = e.document.url;
    return !existingSet.has(urlToId(url)) && !existingUrlSet.has(url);
  });
}

// ── Build extracted content from Firehose document ──────────────

function firehoseDocToExtracted(event) {
  const doc = event.document;
  const url = doc.url;

  // Build content from markdown (Firehose gives us the full page as markdown)
  let content = doc.markdown || '';
  if (content.length > 3000) content = content.substring(0, 3000);

  // Try to extract author from URL domain
  let author = null;
  try {
    author = new URL(url).hostname.replace('www.', '');
  } catch { /* skip */ }

  // Determine URL type
  let urlType = 'article';
  try {
    const host = new URL(url).hostname.replace('www.', '');
    if (host === 'github.com') urlType = 'github';
    else if (host.includes('medium.com')) urlType = 'article';
    else if (host.includes('dev.to')) urlType = 'article';
    else if (host === 'docs.anthropic.com') urlType = 'documentation';
  } catch { /* default article */ }

  return {
    title: doc.title || url,
    content,
    author,
    sourceUrl: url,
    urlType,
    metadata: {
      url,
      firehoseRuleId: event.query_id,
      firehoseTag: event.tag,
      matchedAt: event.matched_at,
      publishTime: doc.publish_time || null,
      pageTypes: doc.page_types || [],
      pageCategories: doc.page_category || [],
      language: doc.language || null,
    },
  };
}

// ── Category + tag resolution (reused from youtube-pipeline) ────

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

// ── Detect content format from Firehose page_types ──────────────

function detectContentFormat(pageTypes) {
  const types = (pageTypes || []).join(' ').toLowerCase();
  if (types.includes('tutorial') || types.includes('how_to') || types.includes('guide')) return 'written-guide';
  if (types.includes('video')) return 'video';
  if (types.includes('news')) return 'news';
  if (types.includes('forum') || types.includes('discussion') || types.includes('q&a')) return 'discussion';
  if (types.includes('study') || types.includes('research')) return 'case-study';
  return null; // let Claude decide
}

// ── Main pipeline ───────────────────────────────────────────────

async function run(options) {
  console.log('\n=== Firehose Auto-Pipeline ===\n');

  // Step 1: Stream events
  const events = await streamFirehose({
    since: options.since || '3h',
    limit: options.limit || 100,
  });

  if (events.length === 0) {
    console.log('No events from Firehose. Done.');
    return;
  }

  // Step 2: Filter and deduplicate
  const newEvents = await filterNewEvents(events);
  console.log(`${newEvents.length} new events after dedup (${events.length - newEvents.length} filtered/existing)`);

  if (newEvents.length === 0) {
    console.log('All events already processed or filtered. Done.');
    return;
  }

  // Step 3: Analyze candidates with Claude
  const candidates = [];
  for (const event of newEvents.slice(0, 10)) {
    try {
      const extracted = firehoseDocToExtracted(event);
      console.log(`\nAnalyzing: ${extracted.title.substring(0, 80)}`);
      console.log(`  URL: ${extracted.sourceUrl}`);

      const analysis = await analyzeContent(extracted);
      console.log(`  Score: ${analysis.ai_quality_score}/10 | Category: ${analysis.category}`);
      candidates.push({ event, extracted, analysis });
    } catch (e) {
      console.warn(`  Failed to analyze: ${e.message}`);
    }
  }

  if (candidates.length === 0) {
    console.log('\nNo candidates could be analyzed. Done.');
    return;
  }

  // Step 4: Sort by score, take top N above threshold
  candidates.sort((a, b) => b.analysis.ai_quality_score - a.analysis.ai_quality_score);
  const qualified = candidates.filter(c => c.analysis.ai_quality_score >= MIN_QUALITY_SCORE);

  console.log(`\n${qualified.length} candidates above quality threshold (>= ${MIN_QUALITY_SCORE})`);

  if (qualified.length === 0) {
    console.log('No candidates meet quality threshold. Done.');
    return;
  }

  const toProcess = qualified.slice(0, MAX_RESOURCES_PER_RUN);

  if (options.dryRun) {
    console.log('\n[DRY RUN] Would create these resources:\n');
    for (const { extracted, analysis } of toProcess) {
      console.log(`  "${analysis.title}" (score: ${analysis.ai_quality_score})`);
      console.log(`    URL: ${extracted.sourceUrl}`);
      console.log(`    Category: ${analysis.category}`);
      console.log(`    Tags: ${(analysis.tags || []).join(', ')}`);
      console.log(`    Format: ${analysis.content_format}`);
      console.log('');
    }
    return;
  }

  // Step 5: Insert resources
  const categories = await getCategories();
  const created = [];

  for (const { extracted, analysis } of toProcess) {
    try {
      const categoryId = categories.get(analysis.category) || categories.get('Community Showcase');
      const tweetId = urlToId(extracted.sourceUrl);

      const resourceRow = {
        tweet_id: tweetId,
        title: analysis.title,
        summary: analysis.summary,
        tweet_text: '',
        tweet_url: extracted.sourceUrl,
        author_handle: extracted.author || new URL(extracted.sourceUrl).hostname.replace('www.', ''),
        author_name: extracted.author || new URL(extracted.sourceUrl).hostname.replace('www.', ''),
        content_type: analysis.content_format || 'article',
        category_id: categoryId,
        primary_url: extracted.sourceUrl,
        expanded_links: [extracted.sourceUrl],
        extracted_content: extracted.metadata,
        media: [],
        engagement: {},
        is_thread: false,
        is_duplicate: false,
        ai_quality_score: analysis.ai_quality_score,
        claude_tool: analysis.claude_tool,
        skill_level: analysis.skill_level,
        content_format: analysis.content_format || 'written-guide',
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
          console.log(`  Duplicate: ${analysis.title}`);
          continue;
        }
        throw new Error(`Insert failed: ${resError.message}`);
      }

      console.log(`  Created resource id=${resource.id}: "${analysis.title}"`);

      // Link tags
      for (const tagName of (analysis.tags || [])) {
        try {
          const tagId = await resolveTag(tagName);
          await supabase.from('resource_tags').insert({ resource_id: resource.id, tag_id: tagId });
        } catch (e) {
          console.warn(`    Failed to link tag "${tagName}": ${e.message}`);
        }
      }

      created.push({ resourceId: resource.id, title: analysis.title, url: extracted.sourceUrl, score: analysis.ai_quality_score });
    } catch (e) {
      console.warn(`  Failed to create resource for ${extracted.sourceUrl}: ${e.message}`);
    }
  }

  // Summary
  console.log(`\n=== Firehose Pipeline Complete ===`);
  console.log(`  Events received: ${events.length}`);
  console.log(`  New after dedup: ${newEvents.length}`);
  console.log(`  Above threshold: ${qualified.length}`);
  console.log(`  Resources created: ${created.length}`);
  for (const r of created) {
    console.log(`    [${r.score}/10] "${r.title}" - ${r.url}`);
  }
}

// ── CLI ─────────────────────────────────────────────────────────

const program = new Command();

program
  .name('firehose-pipeline')
  .description('ClaudeLists Firehose pipeline: discover web content -> analyze -> create resources')
  .option('--dry-run', 'Preview without writing to DB', false)
  .option('--since <duration>', 'How far back to look (e.g. 1h, 3h, 24h)', '3h')
  .option('--limit <number>', 'Max events to fetch from stream', '100');

program.parse();
const opts = program.opts();

try {
  await run({
    dryRun: opts.dryRun,
    since: opts.since,
    limit: parseInt(opts.limit, 10),
  });
} catch (e) {
  console.error('\nFirehose pipeline failed:', e.message);
  if (process.env.DEBUG) console.error(e);
  process.exit(1);
}
