import { config } from 'dotenv';
config({ override: true });

import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';
import { writeFileSync, existsSync, readFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { fetchTweet } from './twitter-client.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = resolve(__dirname, '..', 'data');

const anthropic = new Anthropic();
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// ── Step 1: Pull all resources from Supabase ─────────────────────

async function fetchResources() {
  console.log('Fetching resources from Supabase...');

  const { data, error } = await supabase
    .from('resources')
    .select(`
      id, tweet_id, title, summary, tweet_text, content_type, primary_url,
      author_handle, author_name, engagement, is_thread, ai_quality_score,
      extracted_content, tweet_created_at, discovered_at,
      categories ( name, slug ),
      resource_tags ( tags ( name ) )
    `)
    .eq('status', 'published')
    .order('discovered_at', { ascending: false });

  if (error) throw new Error(`Failed to fetch resources: ${error.message}`);

  // Flatten tags from nested join
  const resources = (data || []).map(r => ({
    ...r,
    category_name: r.categories?.name || 'Uncategorized',
    category_slug: r.categories?.slug || 'uncategorized',
    tags: (r.resource_tags || [])
      .map(rt => rt.tags?.name)
      .filter(Boolean),
  }));

  console.log(`  Found ${resources.length} published resources`);
  return resources;
}

// ── Step 2: Twitter enrichment (optional) ────────────────────────

async function enrichWithTwitter(resources) {
  console.log('Enriching with Twitter data...');
  let enriched = 0;
  let failed = 0;

  for (let i = 0; i < resources.length; i++) {
    const r = resources[i];

    // Skip non-tweet resources (manual submissions)
    if (!r.tweet_id || r.tweet_id.startsWith('submission-')) {
      continue;
    }

    try {
      const result = await fetchTweet(r.tweet_id);
      if (result?.data) {
        const metrics = result.data.public_metrics || {};
        r._twitter_enriched = {
          impressions: metrics.impression_count,
          bookmarks: metrics.bookmark_count,
          likes: metrics.like_count,
          retweets: metrics.retweet_count,
          replies: metrics.reply_count,
        };

        // Get author info from includes
        const author = result.includes?.users?.[0];
        if (author) {
          r._author_bio = author.description;
          r._author_followers = author.public_metrics?.followers_count;
        }

        enriched++;
      }
    } catch (e) {
      failed++;
      console.warn(`  Failed to enrich tweet ${r.tweet_id}: ${e.message}`);
    }

    // Rate limiting
    if (i < resources.length - 1) {
      await sleep(1000);
    }

    if ((i + 1) % 10 === 0) {
      console.log(`  Progress: ${i + 1}/${resources.length} (${enriched} enriched, ${failed} failed)`);
    }
  }

  console.log(`  Twitter enrichment complete: ${enriched} enriched, ${failed} failed`);
  return resources;
}

// ── Step 3: Build compact corpus for Claude ──────────────────────

function buildCorpus(resources) {
  return resources.map(r => {
    const item = {
      id: r.id,
      title: r.title,
      summary: r.summary,
      tweet_text: (r.tweet_text || '').substring(0, 500),
      content_type: r.content_type,
      category: r.category_name,
      tags: r.tags,
      author: r.author_handle,
      quality_score: r.ai_quality_score,
      likes: r.engagement?.likes || 0,
      retweets: r.engagement?.retweets || 0,
    };

    // Add enriched Twitter data if available
    if (r._twitter_enriched) {
      item.impressions = r._twitter_enriched.impressions;
      item.bookmarks = r._twitter_enriched.bookmarks;
    }
    if (r._author_followers) {
      item.author_followers = r._author_followers;
    }
    if (r._author_bio) {
      item.author_bio = r._author_bio.substring(0, 200);
    }

    // Add extracted content title if available
    if (r.extracted_content?.title) {
      item.extracted_title = r.extracted_content.title;
    }
    if (r.extracted_content?.description) {
      item.extracted_description = r.extracted_content.description?.substring(0, 200);
    }
    if (r.extracted_content?.stars) {
      item.github_stars = r.extracted_content.stars;
    }

    return item;
  });
}

// ── Step 4: Claude taxonomy analysis ─────────────────────────────

async function runTaxonomyAnalysis(corpus, categories) {
  console.log('Running Claude Sonnet taxonomy analysis...');

  const systemPrompt = `You are a content strategist analyzing the full resource library of claudelists.com, a curated directory of Claude/Anthropic ecosystem resources (MCP servers, prompts, configs, tools, tutorials, etc.).

Your job: examine the entire corpus and produce a taxonomy redesign recommendation. Be specific and data-driven. Reference actual resource titles and counts. Do not be generic.

Return a valid JSON object only. No markdown fences, no explanation outside the JSON.`;

  const userPrompt = `Here is the complete resource corpus (${corpus.length} resources):

<RESOURCES>
${JSON.stringify(corpus, null, 1)}
</RESOURCES>

Current taxonomy has ${categories.length} fixed categories:
${categories.map(c => `- ${c}`).join('\n')}

Analyze the full corpus and return a JSON object with these exact keys:

{
  "executive_summary": "2-3 sentence overview of findings",

  "current_taxonomy_issues": [
    {
      "issue": "what the problem is",
      "evidence": "which resources/counts illustrate it",
      "severity": "high|medium|low"
    }
  ],

  "content_clusters": [
    {
      "cluster_name": "natural grouping name",
      "description": "what this cluster represents",
      "resource_count": 0,
      "sample_titles": ["title1", "title2", "title3"],
      "currently_spread_across": ["category1", "category2"]
    }
  ],

  "proposed_categories": [
    {
      "name": "category name",
      "slug": "url-slug",
      "description": "what belongs here",
      "replaces_or_merges": ["existing category names"],
      "rationale": "why this is better",
      "estimated_resource_count": 0
    }
  ],

  "proposed_filter_dimensions": [
    {
      "dimension": "e.g. Skill Level, Use Case, Tool Type",
      "values": ["value1", "value2"],
      "rationale": "why this helps users find content"
    }
  ],

  "tag_audit": {
    "high_value_tags": ["tags that are actually useful for filtering"],
    "noise_tags": ["tags that appear once or add no value"],
    "missing_tags": ["suggested new tags that should exist"],
    "consolidation_suggestions": [
      {"merge_these": ["tag-a", "tag-b"], "into": "tag-c", "reason": "why"}
    ]
  },

  "search_and_discovery": {
    "what_users_likely_search_for": ["term1", "term2"],
    "gaps_in_current_labels": "what terms or concepts are missing from categories/tags that users would expect",
    "recommended_search_improvements": ["improvement1", "improvement2"]
  },

  "author_vocabulary_vs_labels": {
    "observation": "what terms authors actually use in tweets vs what labels we assigned",
    "examples": ["example1", "example2"],
    "suggested_label_changes": ["change1", "change2"]
  },

  "implementation_priority": [
    "Action 1 (highest impact, explain why)",
    "Action 2",
    "Action 3"
  ]
}`;

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 8000,
    messages: [
      { role: 'user', content: userPrompt },
    ],
    system: systemPrompt,
  });

  const usage = response.usage;
  console.log(`  Tokens used: ${usage.input_tokens} input, ${usage.output_tokens} output`);

  const text = response.content[0].text.trim();
  const json = text.replace(/^```json?\n?/, '').replace(/\n?```$/, '');
  const analysis = JSON.parse(json);

  return { analysis, usage };
}

// ── Step 5: Generate markdown report ─────────────────────────────

function analysisToMarkdown(analysis, metadata) {
  const lines = [];
  lines.push('# ClaudeLists Taxonomy Analysis Report');
  lines.push('');
  lines.push(`Generated: ${metadata.generated_at}`);
  lines.push(`Resources analyzed: ${metadata.resource_count}`);
  lines.push(`Cost: ~$${metadata.estimated_cost_usd.toFixed(3)}`);
  lines.push('');

  // Executive Summary
  lines.push('## Executive Summary');
  lines.push('');
  lines.push(analysis.executive_summary || 'N/A');
  lines.push('');

  // Current Issues
  lines.push('## Current Taxonomy Issues');
  lines.push('');
  for (const issue of (analysis.current_taxonomy_issues || [])) {
    lines.push(`### [${issue.severity?.toUpperCase()}] ${issue.issue}`);
    lines.push(`Evidence: ${issue.evidence}`);
    lines.push('');
  }

  // Content Clusters
  lines.push('## Natural Content Clusters');
  lines.push('');
  for (const cluster of (analysis.content_clusters || [])) {
    lines.push(`### ${cluster.cluster_name} (${cluster.resource_count} resources)`);
    lines.push(cluster.description);
    if (cluster.sample_titles?.length) {
      lines.push(`Samples: ${cluster.sample_titles.join(', ')}`);
    }
    if (cluster.currently_spread_across?.length) {
      lines.push(`Currently spread across: ${cluster.currently_spread_across.join(', ')}`);
    }
    lines.push('');
  }

  // Proposed Categories
  lines.push('## Proposed Categories');
  lines.push('');
  for (const cat of (analysis.proposed_categories || [])) {
    lines.push(`### ${cat.name} (\`${cat.slug}\`) - ~${cat.estimated_resource_count} resources`);
    lines.push(cat.description);
    lines.push(`Rationale: ${cat.rationale}`);
    if (cat.replaces_or_merges?.length) {
      lines.push(`Replaces/merges: ${cat.replaces_or_merges.join(', ')}`);
    }
    lines.push('');
  }

  // Filter Dimensions
  lines.push('## Proposed Filter Dimensions');
  lines.push('');
  for (const dim of (analysis.proposed_filter_dimensions || [])) {
    lines.push(`### ${dim.dimension}`);
    lines.push(`Values: ${dim.values?.join(', ')}`);
    lines.push(`Rationale: ${dim.rationale}`);
    lines.push('');
  }

  // Tag Audit
  lines.push('## Tag Audit');
  lines.push('');
  const ta = analysis.tag_audit || {};
  if (ta.high_value_tags?.length) {
    lines.push(`**High value tags:** ${ta.high_value_tags.join(', ')}`);
  }
  if (ta.noise_tags?.length) {
    lines.push(`**Noise tags:** ${ta.noise_tags.join(', ')}`);
  }
  if (ta.missing_tags?.length) {
    lines.push(`**Missing tags:** ${ta.missing_tags.join(', ')}`);
  }
  lines.push('');
  if (ta.consolidation_suggestions?.length) {
    lines.push('### Tag Consolidation Suggestions');
    for (const s of ta.consolidation_suggestions) {
      lines.push(`- Merge [${s.merge_these?.join(', ')}] into **${s.into}**: ${s.reason}`);
    }
    lines.push('');
  }

  // Search & Discovery
  lines.push('## Search & Discovery');
  lines.push('');
  const sd = analysis.search_and_discovery || {};
  if (sd.what_users_likely_search_for?.length) {
    lines.push(`**Users likely search for:** ${sd.what_users_likely_search_for.join(', ')}`);
  }
  if (sd.gaps_in_current_labels) {
    lines.push(`**Gaps:** ${sd.gaps_in_current_labels}`);
  }
  if (sd.recommended_search_improvements?.length) {
    lines.push('**Recommended improvements:**');
    for (const imp of sd.recommended_search_improvements) {
      lines.push(`- ${imp}`);
    }
  }
  lines.push('');

  // Author Vocabulary
  lines.push('## Author Vocabulary vs Labels');
  lines.push('');
  const av = analysis.author_vocabulary_vs_labels || {};
  if (av.observation) lines.push(av.observation);
  if (av.examples?.length) {
    lines.push('Examples:');
    for (const ex of av.examples) {
      lines.push(`- ${ex}`);
    }
  }
  if (av.suggested_label_changes?.length) {
    lines.push('Suggested changes:');
    for (const ch of av.suggested_label_changes) {
      lines.push(`- ${ch}`);
    }
  }
  lines.push('');

  // Priority
  lines.push('## Implementation Priority');
  lines.push('');
  for (let i = 0; i < (analysis.implementation_priority || []).length; i++) {
    lines.push(`${i + 1}. ${analysis.implementation_priority[i]}`);
  }
  lines.push('');

  return lines.join('\n');
}

// ── Step 6: Write reports ────────────────────────────────────────

function writeReports(analysis, usage, resourceCount) {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });

  const inputCost = (usage.input_tokens / 1_000_000) * 3;
  const outputCost = (usage.output_tokens / 1_000_000) * 15;
  const totalCost = inputCost + outputCost;

  const metadata = {
    generated_at: new Date().toISOString(),
    resource_count: resourceCount,
    api_usage: {
      input_tokens: usage.input_tokens,
      output_tokens: usage.output_tokens,
      estimated_cost_usd: totalCost,
    },
    estimated_cost_usd: totalCost,
  };

  // JSON report
  const jsonReport = { ...metadata, analysis };
  const jsonPath = resolve(DATA_DIR, 'taxonomy-report.json');
  writeFileSync(jsonPath, JSON.stringify(jsonReport, null, 2));
  console.log(`  JSON report: ${jsonPath}`);

  // Markdown report
  const mdContent = analysisToMarkdown(analysis, { ...metadata, estimated_cost_usd: totalCost });
  const mdPath = resolve(DATA_DIR, 'taxonomy-report.md');
  writeFileSync(mdPath, mdContent);
  console.log(`  Markdown report: ${mdPath}`);

  return { jsonPath, mdPath, metadata };
}

// ── Main ─────────────────────────────────────────────────────────

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const enrichTwitter = process.argv.includes('--enrich-twitter');
  const force = process.argv.includes('--force');

  // Check for existing report
  const jsonPath = resolve(DATA_DIR, 'taxonomy-report.json');
  if (!force && existsSync(jsonPath)) {
    const existing = JSON.parse(readFileSync(jsonPath, 'utf-8'));
    const reportDate = existing.generated_at?.substring(0, 10);
    const today = new Date().toISOString().substring(0, 10);
    if (reportDate === today) {
      console.log(`Report already generated today (${reportDate}). Use --force to regenerate.`);
      return;
    }
  }

  // Step 1: Pull resources
  let resources = await fetchResources();

  // Step 2: Optional Twitter enrichment
  if (enrichTwitter) {
    resources = await enrichWithTwitter(resources);
  }

  // Build corpus
  const corpus = buildCorpus(resources);

  // Get unique categories
  const categories = [...new Set(resources.map(r => r.category_name))].sort();

  // Stats
  const typeDistribution = {};
  const categoryDistribution = {};
  const allTags = {};
  for (const r of resources) {
    typeDistribution[r.content_type] = (typeDistribution[r.content_type] || 0) + 1;
    categoryDistribution[r.category_name] = (categoryDistribution[r.category_name] || 0) + 1;
    for (const t of r.tags) {
      allTags[t] = (allTags[t] || 0) + 1;
    }
  }

  console.log('\n--- Corpus Stats ---');
  console.log(`Resources: ${resources.length}`);
  console.log(`Categories: ${Object.keys(categoryDistribution).length}`);
  console.log(`Unique tags: ${Object.keys(allTags).length}`);
  console.log(`Content types: ${JSON.stringify(typeDistribution)}`);
  console.log(`Category distribution: ${JSON.stringify(categoryDistribution)}`);
  console.log(`Top 10 tags: ${Object.entries(allTags).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([t, c]) => `${t}(${c})`).join(', ')}`);
  console.log('');

  if (dryRun) {
    console.log('[DRY RUN] Would send corpus to Claude Sonnet for analysis.');
    console.log(`Estimated input tokens: ~${Math.round(JSON.stringify(corpus).length / 3.5)}`);
    console.log('\nSample corpus entry:');
    console.log(JSON.stringify(corpus[0], null, 2));
    return;
  }

  // Step 4: Run analysis
  const { analysis, usage } = await runTaxonomyAnalysis(corpus, categories);

  // Step 5: Write reports
  const { mdPath, metadata } = writeReports(analysis, usage, resources.length);

  console.log(`\nDone. Cost: ~$${metadata.estimated_cost_usd.toFixed(3)}`);
  console.log(`Read the report: ${mdPath}`);
}

main().catch(e => {
  console.error('Taxonomy analysis failed:', e);
  process.exit(1);
});
