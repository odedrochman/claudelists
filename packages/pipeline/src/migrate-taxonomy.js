import { config } from 'dotenv';
config({ override: true });

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  const dryRun = process.argv.includes('--dry-run');

  // 1. Insert new categories
  const { data: existing } = await supabase.from('categories').select('slug');
  const existingSlugs = new Set((existing || []).map(c => c.slug));

  const newCats = [
    {
      name: 'Claude Code', slug: 'claude-code',
      description: 'Claude Code desktop app setup, features, integrations, and development workflows',
      icon: '💻', color: '#0EA5E9', sort_order: 11,
    },
    {
      name: 'Claude Cowork', slug: 'claude-cowork',
      description: 'Claude Cowork desktop app tutorials, business automation, and real-world applications',
      icon: '🤝', color: '#F97316', sort_order: 12,
    },
  ];

  for (const cat of newCats) {
    if (existingSlugs.has(cat.slug)) {
      console.log(`Category "${cat.name}" already exists, skipping.`);
      continue;
    }
    if (dryRun) {
      console.log(`[DRY RUN] Would insert category: ${cat.name} (${cat.slug})`);
      continue;
    }
    const { error } = await supabase.from('categories').insert(cat);
    console.log(`Insert "${cat.name}":`, error ? error.message : 'OK');
  }

  // 2. Rename existing categories
  const renames = [
    {
      currentSlug: 'prompts',
      updates: { name: 'Specialized Prompts', description: 'Domain-specific prompt collections for finance, business, content creation, and analysis' },
    },
    {
      currentSlug: 'claude-config',
      updates: { name: 'Configuration & Setup', slug: 'config-setup', description: 'CLAUDE.md files, Skills folders, memory configuration, and system optimization' },
    },
    {
      currentSlug: 'news',
      updates: { name: 'Official Updates', description: 'Announcements from Anthropic, new features, courses, and platform changes' },
    },
    {
      currentSlug: 'discussion',
      updates: { name: 'Community Content', description: 'Discussions, opinions, market analysis, and community-generated insights' },
    },
  ];

  for (const r of renames) {
    if (dryRun) {
      console.log(`[DRY RUN] Would rename "${r.currentSlug}" to "${r.updates.name}"`);
      continue;
    }
    const { error } = await supabase.from('categories').update(r.updates).eq('slug', r.currentSlug);
    console.log(`Rename "${r.currentSlug}" -> "${r.updates.name}":`, error ? error.message : 'OK');
  }

  // 3. Verify final state
  const { data: cats } = await supabase.from('categories').select('name, slug, sort_order').order('sort_order');
  console.log('\nFinal categories:');
  for (const c of cats) {
    console.log(`  ${c.sort_order}. ${c.name} (${c.slug})`);
  }
}

main().catch(e => {
  console.error('Migration failed:', e);
  process.exit(1);
});
