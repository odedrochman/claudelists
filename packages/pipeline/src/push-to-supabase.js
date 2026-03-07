import { config } from 'dotenv';
config({ override: true });

import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { detectCrossReferences } from './fetch-bookmarks.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = resolve(__dirname, '..', 'data');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ── Category resolution ──────────────────────────────────────────

let categoryCache = null;

async function getCategories() {
  if (categoryCache) return categoryCache;
  const { data, error } = await supabase.from('categories').select('id, name');
  if (error) throw new Error(`Failed to fetch categories: ${error.message}`);
  categoryCache = new Map(data.map(c => [c.name, c.id]));
  return categoryCache;
}

// ── Tag resolution ───────────────────────────────────────────────

const tagCache = new Map();

async function resolveTag(tagName) {
  if (tagCache.has(tagName)) return tagCache.get(tagName);

  // Try to find existing tag
  const { data: existing } = await supabase
    .from('tags')
    .select('id')
    .eq('name', tagName)
    .single();

  if (existing) {
    tagCache.set(tagName, existing.id);
    return existing.id;
  }

  // Create new tag
  const { data: created, error } = await supabase
    .from('tags')
    .insert({ name: tagName, usage_count: 1 })
    .select('id')
    .single();

  if (error) {
    // Race condition - another insert may have happened
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

async function incrementTagUsage(tagId) {
  await supabase.rpc('increment_tag_usage', { tag_id: tagId }).catch(() => {
    // Fallback: manual increment if RPC doesn't exist yet
    supabase
      .from('tags')
      .update({ usage_count: supabase.raw('usage_count + 1') })
      .eq('id', tagId)
      .then(() => {});
  });
}

// ── Build resource row ───────────────────────────────────────────

function buildResourceRow(bookmark, categoryId) {
  const primaryUrl = (bookmark._expandedLinks || [])
    .map(l => l.expanded)
    .find(u => u && !u.includes('t.co') && !u.includes('twitter.com') && !u.includes('x.com'));

  return {
    tweet_id: bookmark.id,
    title: bookmark.title || (bookmark.text || '').substring(0, 80),
    summary: bookmark.summary || '',
    tweet_text: bookmark.text || '',
    tweet_url: bookmark.tweetUrl,
    author_handle: bookmark.author || '',
    author_name: bookmark.authorName || '',
    content_type: bookmark._contentType || 'tweet',
    category_id: categoryId,
    primary_url: primaryUrl || null,
    expanded_links: (bookmark._expandedLinks || []).map(l => l.expanded),
    extracted_content: bookmark._extractedContent || null,
    media: (bookmark.media || []),
    engagement: {
      replies: bookmark.replyCount || 0,
      retweets: bookmark.retweetCount || 0,
      likes: bookmark.likeCount || 0,
    },
    is_thread: bookmark.isThread || false,
    is_duplicate: bookmark._isDuplicate || false,
    related_tweet_ids: (bookmark._relatedTweets || []).map(r => {
      const match = r.match(/status\/(\d+)/);
      return match ? match[1] : null;
    }).filter(Boolean),
    has_downloadable: !!bookmark._markdownContent,
    markdown_content: bookmark._markdownContent || null,
    tweet_created_at: bookmark.createdAt || null,
    status: 'published',
  };
}

// ── Main push function ───────────────────────────────────────────

export async function pushToSupabase(analyzedBookmarks, options = {}) {
  const categories = await getCategories();

  // Run cross-reference detection
  detectCrossReferences(analyzedBookmarks);

  // Check which tweet_ids already exist
  const tweetIds = analyzedBookmarks.map(b => b.id);
  const { data: existing } = await supabase
    .from('resources')
    .select('tweet_id')
    .in('tweet_id', tweetIds);

  const existingIds = new Set((existing || []).map(r => r.tweet_id));
  const newBookmarks = analyzedBookmarks.filter(b => !existingIds.has(b.id));

  if (newBookmarks.length === 0) {
    console.log('All bookmarks already in Supabase. Use --force to re-push.');
    return { inserted: 0, skipped: analyzedBookmarks.length };
  }

  console.log(`Pushing ${newBookmarks.length} new resources to Supabase (${existingIds.size} already exist)...`);

  let inserted = 0;
  let errors = 0;

  for (const bookmark of newBookmarks) {
    try {
      // Resolve category
      const categoryId = categories.get(bookmark.category);
      if (!categoryId) {
        console.warn(`  Unknown category "${bookmark.category}" for tweet ${bookmark.id}, using Discussion & Opinion`);
      }
      const resolvedCategoryId = categoryId || categories.get('Discussion & Opinion');

      // Build and insert resource
      const row = buildResourceRow(bookmark, resolvedCategoryId);

      if (options.dryRun) {
        console.log(`  [DRY RUN] Would insert: ${row.title}`);
        inserted++;
        continue;
      }

      const { data: resource, error } = await supabase
        .from('resources')
        .insert(row)
        .select('id')
        .single();

      if (error) {
        if (error.code === '23505') {
          // Duplicate tweet_id - skip
          continue;
        }
        throw error;
      }

      // Resolve and link tags
      const tags = bookmark.tags || [];
      for (const tagName of tags) {
        try {
          const tagId = await resolveTag(tagName);
          await supabase.from('resource_tags').insert({
            resource_id: resource.id,
            tag_id: tagId,
          });
        } catch (tagErr) {
          console.warn(`  Failed to link tag "${tagName}": ${tagErr.message}`);
        }
      }

      inserted++;
      if (inserted % 25 === 0) {
        console.log(`  Inserted ${inserted}/${newBookmarks.length}...`);
      }
    } catch (e) {
      console.error(`  Failed to insert tweet ${bookmark.id}: ${e.message}`);
      errors++;
    }
  }

  console.log(`Push complete: ${inserted} inserted, ${errors} errors, ${existingIds.size} skipped (existing)`);
  return { inserted, errors, skipped: existingIds.size };
}

// ── Pipeline run tracking ────────────────────────────────────────

export async function createPipelineRun() {
  const { data, error } = await supabase
    .from('pipeline_runs')
    .insert({ status: 'running' })
    .select('id')
    .single();

  if (error) {
    console.warn('Failed to create pipeline run:', error.message);
    return null;
  }
  return data.id;
}

export async function updatePipelineRun(runId, updates) {
  if (!runId) return;
  const { error } = await supabase
    .from('pipeline_runs')
    .update({ ...updates, completed_at: new Date().toISOString() })
    .eq('id', runId);

  if (error) {
    console.warn('Failed to update pipeline run:', error.message);
  }
}
