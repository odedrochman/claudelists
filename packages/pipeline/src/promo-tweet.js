// Shared promo tweet logic used by both CLI (publish-long-tweet.js) and web API route.
// All functions accept a supabase client as parameter for portability.

import { writeFile, unlink } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';

// Fetch author handles from article resources
export async function getArticleAuthors(supabase, articleId) {
  const { data: articleResources } = await supabase
    .from('article_resources')
    .select('resource_id')
    .eq('article_id', articleId);

  if (!articleResources || articleResources.length === 0) return [];

  const resourceIds = articleResources.map(ar => ar.resource_id);
  const { data: resources } = await supabase
    .from('resources')
    .select('author_handle')
    .in('id', resourceIds);

  if (!resources) return [];

  // Deduplicate and filter out nulls/empty, exclude our own handle
  const handles = [...new Set(
    resources
      .map(r => r.author_handle)
      .filter(h => h && h.toLowerCase() !== 'claudelists')
  )];

  return handles;
}

// Download OG image to temp file
export async function downloadOgImage(slug) {
  const ogUrl = `https://claudelists.com/digest/${slug}/opengraph-image`;
  console.log(`Downloading OG image from ${ogUrl}...`);

  const response = await fetch(ogUrl);
  if (!response.ok) {
    throw new Error(`Failed to download OG image: ${response.status} ${response.statusText}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  const tempPath = join(tmpdir(), `og-${slug}-${Date.now()}.png`);
  await writeFile(tempPath, buffer);
  console.log(`OG image saved to ${tempPath} (${buffer.length} bytes)`);
  return tempPath;
}

// Generate promo tweet following the checklist
// Checklist order:
//   1. Title + catchy hook
//   2. @mentions of featured creators
//   3. Website digest link FIRST
//   4. X Article link SECOND (optional)
//   5. CTA
//   6. Hashtags
export async function formatPromoTweet(supabase, article, xArticleUrl) {
  const digestUrl = `https://claudelists.com/digest/${article.slug}`;
  const authors = await getArticleAuthors(supabase, article.id);

  // Count resources
  const resourceMatches = [...(article.content || '').matchAll(/##\s*\[([^\]]+)\]\(([^)]+)\)/g)];
  const count = resourceMatches.length;

  const lines = [];

  // 1. Title + hook (Persona G: loss aversion + social proof)
  lines.push(article.title);
  lines.push('');
  if (count > 0) {
    const hooks = [
      `${count} resources your timeline already knows about. Catch up.`,
      `${count} drops the Claude power users found this week. You're behind.`,
      `The people shipping faster than you found these ${count} resources. Now you can too.`,
      `${count} picks separating "I use Claude" from "I ship with Claude."`,
      `Your competitors bookmarked these ${count} resources yesterday. Your move.`,
    ];
    lines.push(hooks[Math.floor(Math.random() * hooks.length)]);
  }

  // 2. @mentions
  if (authors.length > 0) {
    lines.push('');
    lines.push('Featuring ' + authors.map(h => `@${h}`).join(' '));
  }

  // 3. Website link FIRST (priority for traffic)
  lines.push('');
  lines.push(digestUrl);

  // 4. X Article link SECOND (optional)
  if (xArticleUrl) {
    lines.push('');
    lines.push(`Full article: ${xArticleUrl}`);
  }

  // 5. CTA
  lines.push('');
  lines.push('Tag @claudelists to get featured');

  // 6. Hashtags
  lines.push('');
  lines.push('#Claude #AI #ClaudeCode');

  return lines.join('\n');
}
