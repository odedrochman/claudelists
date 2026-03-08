import { config } from 'dotenv';
config({ override: true });

import { Command } from 'commander';
import {
  selectDailyResources,
  selectWeeklyResources,
  selectMonthlyResources,
  markResourcesFeatured,
  saveArticleDraft,
} from './content-selector.js';
import {
  generateDailyArticle,
  generateWeeklySummary,
  generateMonthlySummary,
} from './article-writer.js';
import { publishArticle } from './publisher.js';
import { checkAndPublish } from './scheduler.js';
import { validateArticle, printValidation } from './quality-checker.js';

// ── Generate a daily article ────────────────────────────────────

async function generateDaily(options) {
  console.log('\n=== Generating Daily Article ===');

  const resources = await selectDailyResources(options.count || 5);
  if (!resources) {
    console.log('Not enough unfeatured resources. Add more bookmarks first.');
    return null;
  }

  console.log(`Selected ${resources.length} resources:`);
  for (const r of resources) {
    console.log(`  - [${r.ai_quality_score || '?'}/10] ${r.title} (@${r.author_handle || 'unknown'})`);
  }

  console.log('\nGenerating article with Claude...');
  const article = await generateDailyArticle(resources);

  console.log(`\nTitle: ${article.title}`);
  console.log(`Slug: ${article.slug}`);
  console.log(`Content length: ${article.content.length} chars`);
  console.log(`Thread: ${article.tweetThread.length} tweets`);
  console.log(`Promo tweet: ${article.promoTweet.length} chars`);

  // Run quality checks
  const validation = validateArticle(article, resources);
  printValidation(validation);

  if (!validation.passed) {
    console.log('Article failed quality checks. Fix issues and regenerate.');
    if (options.dryRun) {
      console.log('\n--- ARTICLE PREVIEW (FAILED) ---');
      console.log(article.content);
    }
    return null;
  }

  if (options.dryRun) {
    console.log('\n--- ARTICLE PREVIEW ---');
    console.log(article.content);
    console.log('\n--- TWEET THREAD PREVIEW ---');
    article.tweetThread.forEach((t, i) => console.log(`Tweet ${i + 1}: ${t}`));
    console.log('\n--- PROMO TWEET PREVIEW ---');
    console.log(article.promoTweet);
    console.log('\n[DRY RUN] No changes saved.');
    return article;
  }

  // Save to DB
  const resourceIds = resources.map(r => r.id);
  const articleId = await saveArticleDraft(article, resourceIds);
  await markResourcesFeatured(resourceIds);

  console.log(`\nDraft saved (ID: ${articleId}). Review it in the admin panel.`);
  return articleId;
}

// ── Generate a weekly summary ───────────────────────────────────

async function generateWeekly(options) {
  console.log('\n=== Generating Weekly Summary ===');

  if (!options.week) {
    // Default to last 7 days
    const end = new Date();
    const start = new Date(end);
    start.setDate(start.getDate() - 7);
    options.week = start.toISOString().split('T')[0];
  }

  const weekStart = options.week;
  const weekEndDate = new Date(weekStart);
  weekEndDate.setDate(weekEndDate.getDate() + 7);
  const weekEnd = weekEndDate.toISOString().split('T')[0];

  console.log(`Week: ${weekStart} to ${weekEnd}`);

  const data = await selectWeeklyResources(weekStart, weekEnd);
  if (!data) {
    console.log('No daily articles found for this week.');
    return null;
  }

  console.log(`Found ${data.articles.length} daily articles, ${data.resources.length} resources.`);

  console.log('Generating weekly summary with Claude...');
  const article = await generateWeeklySummary(data.articles, data.resources, weekStart, weekEnd);

  // Run quality checks
  const validation = validateArticle(article, data.resources);
  printValidation(validation);

  if (!validation.passed) {
    console.log('Weekly summary failed quality checks. Fix issues and regenerate.');
    return null;
  }

  if (options.dryRun) {
    console.log('\n--- WEEKLY SUMMARY PREVIEW ---');
    console.log(article.content);
    console.log('\n[DRY RUN] No changes saved.');
    return article;
  }

  const resourceIds = data.resources.map(r => r.id);
  const articleId = await saveArticleDraft(article, resourceIds);

  console.log(`\nWeekly summary draft saved (ID: ${articleId}). Review it in the admin panel.`);
  return articleId;
}

// ── Generate a monthly summary ──────────────────────────────────

async function generateMonthly(options) {
  console.log('\n=== Generating Monthly Summary ===');

  let monthStart, monthEnd;
  if (options.month) {
    monthStart = `${options.month}-01`;
    const d = new Date(monthStart);
    d.setMonth(d.getMonth() + 1);
    monthEnd = d.toISOString().split('T')[0];
  } else {
    // Default to previous month
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const end = new Date(now.getFullYear(), now.getMonth(), 1);
    monthStart = start.toISOString().split('T')[0];
    monthEnd = end.toISOString().split('T')[0];
  }

  console.log(`Month: ${monthStart} to ${monthEnd}`);

  const data = await selectMonthlyResources(monthStart, monthEnd);
  if (!data) {
    console.log('No articles found for this month.');
    return null;
  }

  console.log(`Found ${data.dailyArticles.length} daily, ${data.weeklyArticles.length} weekly, ${data.resources.length} resources.`);

  console.log('Generating monthly summary with Claude...');
  const article = await generateMonthlySummary(
    data.dailyArticles,
    data.weeklyArticles,
    data.resources,
    monthStart,
    monthEnd,
  );

  // Run quality checks
  const validation = validateArticle(article, data.resources);
  printValidation(validation);

  if (!validation.passed) {
    console.log('Monthly summary failed quality checks. Fix issues and regenerate.');
    return null;
  }

  if (options.dryRun) {
    console.log('\n--- MONTHLY SUMMARY PREVIEW ---');
    console.log(article.content);
    console.log('\n[DRY RUN] No changes saved.');
    return article;
  }

  const resourceIds = data.resources.map(r => r.id);
  const articleId = await saveArticleDraft(article, resourceIds);

  console.log(`\nMonthly summary draft saved (ID: ${articleId}). Review it in the admin panel.`);
  return articleId;
}

// ── CLI ─────────────────────────────────────────────────────────

const program = new Command();

program
  .name('article-engine')
  .description('ClaudeLists article engine: generate, schedule, and publish curated articles')
  .option('--type <type>', 'Article type to generate: daily, weekly, monthly')
  .option('--week <date>', 'Week start date (ISO) for weekly summary')
  .option('--month <month>', 'Month (YYYY-MM) for monthly summary')
  .option('--count <n>', 'Number of resources for daily article (2-5)', parseInt, 5)
  .option('--dry-run', 'Preview without saving to database', false)
  .option('--publish <id>', 'Manually publish a specific article by ID')
  .option('--check-schedule', 'Check for and publish any due scheduled articles', false);

program.parse();
const opts = program.opts();

try {
  if (opts.checkSchedule) {
    const result = await checkAndPublish();
    console.log(`\nResult: ${result.published} published, ${result.errors.length} errors`);
  } else if (opts.publish) {
    await publishArticle(opts.publish);
  } else if (opts.type) {
    const options = {
      count: Math.max(2, Math.min(5, opts.count)),
      week: opts.week,
      month: opts.month,
      dryRun: opts.dryRun,
    };

    switch (opts.type) {
      case 'daily':
        await generateDaily(options);
        break;
      case 'weekly':
        await generateWeekly(options);
        break;
      case 'monthly':
        await generateMonthly(options);
        break;
      default:
        console.error(`Unknown article type: ${opts.type}. Use: daily, weekly, monthly`);
        process.exit(1);
    }
  } else {
    program.help();
  }
} catch (e) {
  console.error('\nArticle engine failed:', e.message);
  if (process.env.DEBUG) console.error(e);
  process.exit(1);
}
