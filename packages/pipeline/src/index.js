import { config } from 'dotenv';
config({ override: true });

import { Command } from 'commander';
import { mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import { fetchAndEnrich } from './fetch-bookmarks.js';
import { analyzeBookmarks } from './analyze.js';
import { pushToSupabase, createPipelineRun, updatePipelineRun } from './push-to-supabase.js';
import { autoPost } from './auto-poster.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = resolve(__dirname, '..', 'data');

// Ensure data directory exists
if (!existsSync(DATA_DIR)) {
  mkdirSync(DATA_DIR, { recursive: true });
}

// ── Pipeline steps ───────────────────────────────────────────────

async function runFetch(options) {
  console.log('\n═══ Step 1: Fetch & Enrich Bookmarks ═══');
  return await fetchAndEnrich(options);
}

async function runAnalyze(enriched, options) {
  console.log('\n═══ Step 2: Analyze with Claude ═══');
  return await analyzeBookmarks(enriched, options);
}

async function runPush(analyzed, options) {
  console.log('\n═══ Step 3: Push to Supabase ═══');
  return await pushToSupabase(analyzed, options);
}

async function runPost(options) {
  console.log('\n═══ Step 4: Auto-Post to Twitter ═══');
  return await autoPost(options);
}

// ── Full pipeline ────────────────────────────────────────────────

async function runAll(options) {
  const runId = await createPipelineRun();
  const stats = { bookmarks_fetched: 0, bookmarks_new: 0, bookmarks_analyzed: 0, bookmarks_pushed: 0 };

  try {
    const enriched = await runFetch(options);
    stats.bookmarks_fetched = enriched.length;

    const analyzed = await runAnalyze(enriched, options);
    stats.bookmarks_analyzed = analyzed.length;

    const pushResult = await runPush(analyzed, options);
    stats.bookmarks_pushed = pushResult.inserted;
    stats.bookmarks_new = pushResult.inserted;

    if (!options.skipPost) {
      await runPost(options);
    }

    await updatePipelineRun(runId, { status: 'completed', ...stats });
    console.log('\n═══ Pipeline Complete ═══');
    console.log(`  Fetched: ${stats.bookmarks_fetched}`);
    console.log(`  Analyzed: ${stats.bookmarks_analyzed}`);
    console.log(`  Pushed: ${stats.bookmarks_pushed}`);
  } catch (e) {
    await updatePipelineRun(runId, {
      status: 'failed',
      error_message: e.message,
      ...stats,
    });
    throw e;
  }
}

// ── CLI ──────────────────────────────────────────────────────────

const program = new Command();

program
  .name('claudelists-pipeline')
  .description('ClaudeLists.com pipeline: fetch bookmarks → analyze → push to Supabase → auto-post')
  .option('--step <step>', 'Run a specific step: fetch, analyze, push, post, all', 'all')
  .option('--force', 'Force re-process even if cached data exists', false)
  .option('--limit <n>', 'Limit number of bookmarks to fetch', parseInt)
  .option('--dry-run', 'Preview changes without writing to Supabase or posting', false)
  .option('--skip-post', 'Skip the auto-post step', false);

program.parse();
const opts = program.opts();

const options = {
  force: opts.force,
  limit: opts.limit,
  dryRun: opts.dryRun,
  skipPost: opts.skipPost,
};

console.log('ClaudeLists Pipeline');
console.log(`Step: ${opts.step} | Force: ${options.force} | Dry-run: ${options.dryRun}`);

try {
  switch (opts.step) {
    case 'fetch': {
      await runFetch(options);
      break;
    }
    case 'analyze': {
      const enriched = await runFetch({ ...options, force: false });
      await runAnalyze(enriched, options);
      break;
    }
    case 'push': {
      const enriched = await runFetch({ ...options, force: false });
      const analyzed = await runAnalyze(enriched, { ...options, force: false });
      await runPush(analyzed, options);
      break;
    }
    case 'post': {
      await runPost(options);
      break;
    }
    case 'all': {
      await runAll(options);
      break;
    }
    default:
      console.error(`Unknown step: ${opts.step}`);
      process.exit(1);
  }
} catch (e) {
  console.error('\nPipeline failed:', e.message);
  if (process.env.DEBUG) console.error(e);
  process.exit(1);
}
