import { config } from 'dotenv';
config({ override: true });

import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';

const anthropic = new Anthropic();
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const BATCH_SIZE = 15;

const CATEGORIES = [
  'Claude Code',
  'Claude Cowork',
  'MCP Servers',
  'Specialized Prompts',
  'Configuration & Setup',
  'Workflows & Automation',
  'Skills & Agents',
  'Tools & Libraries',
  'Tutorials & Guides',
  'Projects & Showcases',
  'Official Updates',
  'Community Content',
];

const SKILL_LEVELS = ['beginner', 'intermediate', 'advanced'];
const CONTENT_FORMATS = ['video', 'written-guide', 'prompt-collection', 'code-example', 'case-study', 'news', 'discussion'];

// Tags to remove (noise)
const NOISE_TAGS = new Set([
  'casual-reference', 'article', 'discussion', 'community',
  'likes', 'retweets',
]);

// Tags to merge: old -> new
const TAG_MERGES = {
  'claude-strategies': 'prompts',
  'claude-prompts': 'prompts',
  'workflow-optimization': 'productivity',
  'anthropic-update': 'official-update',
  'feature-release': 'official-update',
};

// Tags to add if missing
const SUGGESTED_TAGS = [
  'beginner-friendly', 'advanced', 'official', 'video',
  'step-by-step', 'enterprise', 'free', 'paid',
];

async function fetchAllResources() {
  const { data, error } = await supabase
    .from('resources')
    .select('id, title, summary, tweet_text, content_type, primary_url, author_handle, ai_quality_score, category_id, categories(name, slug), resource_tags(tags(id, name))')
    .eq('status', 'published')
    .order('discovered_at', { ascending: false });

  if (error) throw new Error(`Failed to fetch resources: ${error.message}`);
  return data || [];
}

async function fetchCategories() {
  const { data, error } = await supabase.from('categories').select('id, name, slug');
  if (error) throw new Error(`Failed to fetch categories: ${error.message}`);
  return data || [];
}

async function reclassifyBatch(resources) {
  const items = resources.map(r => ({
    id: r.id,
    title: r.title,
    summary: r.summary,
    tweet_text: (r.tweet_text || '').substring(0, 400),
    content_type: r.content_type,
    current_category: r.categories?.name || 'Unknown',
    current_tags: (r.resource_tags || []).map(rt => rt.tags?.name).filter(Boolean),
    has_external_link: !!r.primary_url,
    author: r.author_handle,
    quality_score: r.ai_quality_score,
  }));

  const prompt = `You are reclassifying resources for claudelists.com using our updated taxonomy.

For each resource, return a JSON array of objects with:
- "id": pass through exactly
- "category": exactly one of: ${CATEGORIES.map(c => `"${c}"`).join(', ')}
- "skill_level": one of "beginner", "intermediate", "advanced" based on content complexity
- "content_format": one of "video", "written-guide", "prompt-collection", "code-example", "case-study", "news", "discussion"
- "tags": array of 2-5 lowercase hyphenated tags. Keep useful existing tags, remove noise, add relevant new ones.
  - KEEP "engagement-required" tag if the resource gates content behind likes/retweets/follows
  - GOOD tags: claude-code, claude-cowork, automation, setup-guide, tutorial, prompts, mcp-server, business-automation, beginner-friendly, advanced, official, video, step-by-step
  - REMOVE noise tags: casual-reference, article, discussion, community, likes, retweets
  - MERGE: claude-strategies/claude-prompts -> prompts, workflow-optimization/productivity -> productivity, anthropic-update/feature-release -> official-update

Category guidelines:
- "Claude Code": Claude Code desktop app, setup, features, integrations, voice mode, hooks, scheduled tasks, dev workflows
- "Claude Cowork": Claude Cowork desktop app, business automation, collaboration, real-world applications
- "MCP Servers": Model Context Protocol servers, MCP integrations, MCP tools
- "Specialized Prompts": Domain-specific prompt collections (finance, business, content creation, trading)
- "Configuration & Setup": CLAUDE.md files, Skills folders, memory config, project setup, rules files
- "Workflows & Automation": Pipelines, automation using Claude, CI/CD with AI
- "Skills & Agents": Claude skills, agent architectures, agent SDK, multi-agent systems
- "Tools & Libraries": SDKs, CLI tools, VS Code extensions, developer tooling
- "Tutorials & Guides": General how-to content, walkthroughs (not specific to Code or Cowork)
- "Projects & Showcases": Things people built with Claude, demos, case studies
- "Official Updates": Official Anthropic announcements, releases, courses, platform changes
- "Community Content": Community discussions, opinions, comparisons, reviews

Return ONLY a valid JSON array. No markdown fences, no explanation.

Resources:
${JSON.stringify(items, null, 2)}`;

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = response.content[0].text.trim();
  const json = text.replace(/^```json?\n?/, '').replace(/\n?```$/, '');
  return JSON.parse(json);
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');

  console.log('Fetching resources and categories...');
  const [resources, categories] = await Promise.all([fetchAllResources(), fetchCategories()]);

  const categoryMap = new Map(categories.map(c => [c.name, c.id]));
  console.log(`Found ${resources.length} resources, ${categories.length} categories`);
  console.log('Categories:', categories.map(c => c.name).join(', '));

  // Verify all new categories exist
  for (const cat of CATEGORIES) {
    if (!categoryMap.has(cat)) {
      console.error(`Category "${cat}" not found in database. Run migrate-taxonomy.js first.`);
      process.exit(1);
    }
  }

  console.log(`\nReclassifying ${resources.length} resources in batches of ${BATCH_SIZE}...`);

  let totalUpdated = 0;
  let totalTagsUpdated = 0;

  for (let i = 0; i < resources.length; i += BATCH_SIZE) {
    const batch = resources.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(resources.length / BATCH_SIZE);

    console.log(`\n  Batch ${batchNum}/${totalBatches} (${batch.length} resources)...`);

    const results = await reclassifyBatch(batch);

    for (const result of results) {
      const resource = batch.find(r => r.id === result.id);
      if (!resource) continue;

      const newCategoryId = categoryMap.get(result.category);
      if (!newCategoryId) {
        console.warn(`    Unknown category "${result.category}" for "${resource.title}"`);
        continue;
      }

      const oldCat = resource.categories?.name || 'Unknown';
      const changed = oldCat !== result.category;
      const label = changed ? `${oldCat} -> ${result.category}` : result.category;

      if (dryRun) {
        console.log(`    [DRY RUN] "${resource.title}": ${label} | ${result.skill_level} | ${result.content_format}`);
        console.log(`      Tags: ${(result.tags || []).join(', ')}`);
        continue;
      }

      // Update resource
      const { error } = await supabase
        .from('resources')
        .update({
          category_id: newCategoryId,
          skill_level: result.skill_level,
          content_format: result.content_format,
        })
        .eq('id', result.id);

      if (error) {
        console.error(`    Failed to update "${resource.title}": ${error.message}`);
        continue;
      }

      // Update tags: remove old, add new
      const newTags = result.tags || [];
      if (newTags.length > 0) {
        // Delete existing tag associations
        await supabase.from('resource_tags').delete().eq('resource_id', result.id);

        // Ensure tags exist and create associations
        for (const tagName of newTags) {
          // Upsert tag
          const { data: tagData } = await supabase
            .from('tags')
            .upsert({ name: tagName }, { onConflict: 'name' })
            .select('id')
            .single();

          if (tagData) {
            await supabase.from('resource_tags').insert({
              resource_id: result.id,
              tag_id: tagData.id,
            });
          }
        }
        totalTagsUpdated++;
      }

      totalUpdated++;
      const marker = changed ? '  *' : '';
      console.log(`    "${resource.title}": ${label}${marker} | ${result.skill_level} | ${result.content_format}`);
    }

    // Rate limit between batches
    if (i + BATCH_SIZE < resources.length) {
      await new Promise(r => setTimeout(r, 1500));
    }
  }

  console.log(`\nReclassification complete: ${totalUpdated} resources updated, ${totalTagsUpdated} tag sets refreshed.`);

  // Clean up orphaned tags
  if (!dryRun) {
    console.log('\nCleaning up noise tags...');
    for (const noiseTag of NOISE_TAGS) {
      const { data: tag } = await supabase.from('tags').select('id').eq('name', noiseTag).single();
      if (tag) {
        // Check if any resources still use this tag
        const { count } = await supabase.from('resource_tags').select('id', { count: 'exact' }).eq('tag_id', tag.id);
        if (count === 0) {
          await supabase.from('tags').delete().eq('id', tag.id);
          console.log(`  Deleted orphaned noise tag: ${noiseTag}`);
        } else {
          console.log(`  Tag "${noiseTag}" still has ${count} associations, keeping.`);
        }
      }
    }
  }

  // Print category distribution
  console.log('\nNew category distribution:');
  const { data: dist } = await supabase
    .from('resources')
    .select('category_id, categories(name)')
    .eq('status', 'published');

  const catCounts = {};
  for (const r of (dist || [])) {
    const name = r.categories?.name || 'Unknown';
    catCounts[name] = (catCounts[name] || 0) + 1;
  }
  const sorted = Object.entries(catCounts).sort((a, b) => b[1] - a[1]);
  for (const [name, count] of sorted) {
    const bar = '█'.repeat(count);
    console.log(`  ${name.padEnd(25)} ${String(count).padStart(3)} ${bar}`);
  }
}

main().catch(e => {
  console.error('Reclassification failed:', e);
  process.exit(1);
});
