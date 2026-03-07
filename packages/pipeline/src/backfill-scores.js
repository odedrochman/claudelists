import { config } from 'dotenv';
config({ override: true });

import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';

const anthropic = new Anthropic();
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const BATCH_SIZE = 10;

async function fetchUnscored() {
  const { data, error } = await supabase
    .from('resources')
    .select('id, title, summary, tweet_text, content_type, primary_url, has_downloadable, author_handle')
    .eq('status', 'published')
    .is('ai_quality_score', null)
    .order('discovered_at', { ascending: false });

  if (error) throw new Error(`Failed to fetch resources: ${error.message}`);
  return data || [];
}

async function scoreBatch(resources) {
  const items = resources.map(r => ({
    id: r.id,
    title: r.title,
    summary: r.summary,
    tweet_text: (r.tweet_text || '').substring(0, 500),
    content_type: r.content_type,
    has_external_link: !!r.primary_url,
    has_downloadable: r.has_downloadable,
    author: r.author_handle,
  }));

  const prompt = `You are scoring resources for claudelists.com — a curated directory of Claude/Anthropic ecosystem resources.

For each resource below, return a JSON array of objects with:
- "id": pass through exactly
- "ai_quality_score": integer 1-10 rating quality and usefulness to Claude/Anthropic developers:
  1-3: Low value — vague, promotional, no actionable content, just a link with no context
  4-5: Below average — common knowledge, thin content, or low-effort share
  6: Decent — useful but nothing special, standard tip or announcement
  7: Good — specific, actionable, teaches something concrete
  8: Very good — detailed, well-explained, covers a non-obvious topic
  9: Excellent — comprehensive guide, unique insight, or significant tool/project
  10: Exceptional — reference-quality resource that developers will bookmark and share

Return ONLY a valid JSON array. No markdown fences, no explanation.

Resources:
${JSON.stringify(items, null, 2)}`;

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2048,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = response.content[0].text.trim();
  const json = text.replace(/^```json?\n?/, '').replace(/\n?```$/, '');
  return JSON.parse(json);
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');

  const unscored = await fetchUnscored();
  if (unscored.length === 0) {
    console.log('All resources already have scores.');
    return;
  }

  console.log(`Scoring ${unscored.length} resources...`);

  for (let i = 0; i < unscored.length; i += BATCH_SIZE) {
    const batch = unscored.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(unscored.length / BATCH_SIZE);

    console.log(`  Batch ${batchNum}/${totalBatches} (${batch.length} resources)...`);

    const scores = await scoreBatch(batch);

    for (const result of scores) {
      const score = Math.min(10, Math.max(1, result.ai_quality_score || 5));
      const resource = batch.find(r => r.id === result.id);
      const title = resource?.title || result.id;

      if (dryRun) {
        console.log(`    [DRY RUN] ${title}: ${score}/10`);
        continue;
      }

      const { error } = await supabase
        .from('resources')
        .update({ ai_quality_score: score })
        .eq('id', result.id);

      if (error) {
        console.error(`    Failed to update ${result.id}: ${error.message}`);
      } else {
        console.log(`    ${title}: ${score}/10`);
      }
    }

    // Rate limit between batches
    if (i + BATCH_SIZE < unscored.length) {
      await new Promise(r => setTimeout(r, 1500));
    }
  }

  console.log('Backfill complete.');
}

main().catch(e => {
  console.error('Backfill failed:', e);
  process.exit(1);
});
