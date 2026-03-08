import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
// Load both root .env and apps/web/.env.local for Supabase vars
config({ override: true });
config({ path: resolve(__dirname, '../../../apps/web/.env.local'), override: true });

import { createClient } from '@supabase/supabase-js';
import { getClients, verifyAuth } from './twitter-client.js';

// ── Supabase client ─────────────────────────────────────────────
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ── Convert article markdown to clean long-tweet format ─────────
function formatForLongTweet(article) {
  let text = article.content || '';

  // Remove leading H1 (title is handled separately)
  text = text.replace(/^#\s+.*\n+/, '');

  // Convert ## [Title](url) resource headers to numbered entries with link
  let resourceNum = 0;
  text = text.replace(/##\s*\[([^\]]+)\]\(([^)]+)\)/g, () => {
    resourceNum++;
    return `__RESOURCE_${resourceNum}__`;
  });

  // Convert ## headers to plain text
  text = text.replace(/##\s+(.+)/g, '$1');

  // Remove bold markers but keep the text
  text = text.replace(/\*\*Who it's for:\*\*/g, 'For:');
  text = text.replace(/\*\*Quick take:\*\*/g, 'Take:');
  text = text.replace(/\*\*([^*]+)\*\*/g, '$1');

  // Remove italic markers
  text = text.replace(/\*([^*]+)\*/g, '$1');

  // Convert "Shared by [@handle](url)" to just "by @handle"
  text = text.replace(/Shared by \[@([^\]]+)\]\([^)]+\)/g, 'by @$1');

  // Convert remaining [text](url) links to just the URL (cleaner in long posts)
  text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$2');

  // Convert --- separators to blank line (X handles spacing)
  text = text.replace(/^---$/gm, '');

  // Clean up excessive newlines (3+ -> 2)
  text = text.replace(/\n{3,}/g, '\n\n');

  // Trim
  text = text.trim();

  // Now rebuild with resource sections from original content
  // Re-parse the original to get resource titles and URLs
  const resourceMatches = [...(article.content || '').matchAll(/##\s*\[([^\]]+)\]\(([^)]+)\)/g)];

  // Replace resource placeholders with clean numbered format
  for (let i = 0; i < resourceMatches.length; i++) {
    const [, title, url] = resourceMatches[i];
    text = text.replace(`__RESOURCE_${i + 1}__`, `${i + 1}. ${title}\n${url}`);
  }

  // Remove the closing community CTA paragraph (we'll add our own)
  text = text.replace(/The community keeps delivering.*$/s, '').trim();

  // Build final long reply content
  const parts = [
    article.title,
    '',
    text,
    '',
    '@claudelists | claudelists.com',
  ];

  return parts.join('\n');
}

// ── Generate a short promo tweet with digest link ────────────────
function formatPromoTweet(article) {
  const articleUrl = `https://claudelists.com/digest/${article.slug}`;

  // Count resources in the article
  const resourceMatches = [...(article.content || '').matchAll(/##\s*\[([^\]]+)\]\(([^)]+)\)/g)];
  const count = resourceMatches.length;

  // Build a short tweet under 280 chars that will generate an OG card
  const lines = [
    article.title,
    '',
    count > 0 ? `${count} curated picks from the Claude community.` : 'Curated picks from the Claude community.',
    '',
    articleUrl,
  ];

  return lines.join('\n');
}

// ── Format article content for X Article editor ──────────────────
// Includes tweet URLs so they can be embedded in the X Article editor
async function formatForXArticle(article) {
  // Get linked resources with tweet URLs from Supabase
  const { data: articleResources } = await supabase
    .from('article_resources')
    .select('resource_id, position')
    .eq('article_id', article.id)
    .order('position');

  let tweetUrlMap = {};
  if (articleResources && articleResources.length > 0) {
    const resourceIds = articleResources.map(ar => ar.resource_id);
    const { data: resources } = await supabase
      .from('resources')
      .select('id, tweet_url, author_handle')
      .in('id', resourceIds);
    if (resources) {
      for (const r of resources) {
        tweetUrlMap[r.id] = { tweet_url: r.tweet_url, author_handle: r.author_handle };
      }
    }
  }

  // Build ordered list of tweet URLs matching resource positions
  const orderedTweetUrls = (articleResources || []).map(ar => tweetUrlMap[ar.resource_id] || null);

  let text = article.content || '';

  // Remove leading H1
  text = text.replace(/^#\s+.*\n+/, '');

  // Convert ## [Title](url) resource headers to numbered entries
  let resourceIdx = 0;
  text = text.replace(/##\s*\[([^\]]+)\]\(([^)]+)\)/g, (_, title, url) => {
    const info = orderedTweetUrls[resourceIdx];
    resourceIdx++;
    let section = `${resourceIdx}. ${title}\n${url}`;
    if (info && info.tweet_url) {
      section += `\n\n[EMBED TWEET]: ${info.tweet_url}`;
    }
    return section;
  });

  // Convert ## headers to plain text
  text = text.replace(/##\s+(.+)/g, '$1');

  // Clean markdown formatting
  text = text.replace(/\*\*Who it's for:\*\*/g, 'For:');
  text = text.replace(/\*\*Quick take:\*\*/g, 'Take:');
  text = text.replace(/\*\*([^*]+)\*\*/g, '$1');
  text = text.replace(/\*([^*]+)\*/g, '$1');
  text = text.replace(/Shared by \[@([^\]]+)\]\([^)]+\)/g, 'by @$1');
  text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$2');
  text = text.replace(/^---$/gm, '');
  text = text.replace(/\n{3,}/g, '\n\n');
  text = text.trim();

  // Remove closing CTA
  text = text.replace(/The community keeps delivering.*$/s, '').trim();

  const parts = [
    article.title,
    '',
    text,
    '',
    `Read more at claudelists.com/digest/${article.slug}`,
  ];

  return parts.join('\n');
}

// ── CLI commands ────────────────────────────────────────────────

const command = process.argv[2];
const articleSlug = process.argv[3];

if (command === 'list') {
  // List published articles
  const { data, error } = await supabase
    .from('articles')
    .select('id, slug, title, article_type, published_at, thread_url')
    .eq('status', 'published')
    .order('published_at', { ascending: false });

  if (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }

  console.log('\nPublished articles:\n');
  data.forEach((a, i) => {
    const tweeted = a.thread_url ? `  [TWEETED: ${a.thread_url}]` : '  [NOT TWEETED]';
    console.log(`${i + 1}. [${a.article_type}] ${a.title}`);
    console.log(`   slug: ${a.slug}${tweeted}`);
    console.log();
  });

} else if (command === 'preview') {
  // Preview how the article will look as a long tweet
  if (!articleSlug) {
    console.error('Usage: node publish-long-tweet.js preview <slug>');
    process.exit(1);
  }

  const { data: article, error } = await supabase
    .from('articles')
    .select('*')
    .eq('slug', articleSlug)
    .eq('status', 'published')
    .single();

  if (error || !article) {
    console.error('Article not found or not published');
    process.exit(1);
  }

  const promo = formatPromoTweet(article);
  const longReply = formatForLongTweet(article);

  console.log('\n' + '='.repeat(60));
  console.log('TWEET 1: PROMO (shows OG card)');
  console.log('='.repeat(60));
  console.log(`Characters: ${promo.length}/280`);
  console.log('\n' + '-'.repeat(60) + '\n');
  console.log(promo);
  console.log('\n' + '='.repeat(60));
  console.log('TWEET 2: LONG REPLY (full details)');
  console.log('='.repeat(60));
  console.log(`Characters: ${longReply.length}`);
  console.log('\n' + '-'.repeat(60) + '\n');
  console.log(longReply);
  console.log('\n' + '-'.repeat(60));

} else if (command === 'post') {
  // Post the article as a long tweet
  if (!articleSlug) {
    console.error('Usage: node publish-long-tweet.js post <slug>');
    process.exit(1);
  }

  const { data: article, error } = await supabase
    .from('articles')
    .select('*')
    .eq('slug', articleSlug)
    .eq('status', 'published')
    .single();

  if (error || !article) {
    console.error('Article not found or not published');
    process.exit(1);
  }

  if (article.thread_url) {
    console.error(`Article already tweeted: ${article.thread_url}`);
    process.exit(1);
  }

  // Verify auth first
  const me = await verifyAuth();
  if (!me) {
    console.error('Twitter auth failed');
    process.exit(1);
  }

  const promo = formatPromoTweet(article);
  const longReply = formatForLongTweet(article);

  const { userClient } = getClients();

  // Step 1: Post short promo tweet (will show OG card)
  console.log(`\nStep 1: Posting promo tweet (${promo.length} chars) as @${me.username}...`);
  const promoResult = await userClient.v2.tweet(promo);
  const promoTweetId = promoResult.data.id;
  const tweetUrl = `https://x.com/${me.username}/status/${promoTweetId}`;
  console.log(`Promo posted: ${tweetUrl}`);

  // Step 2: Post long reply with full details
  console.log(`\nStep 2: Posting long reply (${longReply.length} chars)...`);
  const replyResult = await userClient.v2.tweet({
    text: longReply,
    reply: { in_reply_to_tweet_id: promoTweetId },
  });
  const replyId = replyResult.data.id;
  const replyUrl = `https://x.com/${me.username}/status/${replyId}`;
  console.log(`Reply posted: ${replyUrl}`);

  // Save the URL back to the article
  const { error: updateError } = await supabase
    .from('articles')
    .update({
      thread_url: tweetUrl,
      updated_at: new Date().toISOString(),
    })
    .eq('id', article.id);

  if (updateError) {
    console.error('Warning: Failed to save tweet URL to article:', updateError.message);
  } else {
    console.log('Saved tweet URL to article record.');
  }

} else if (command === 'xarticle') {
  // Generate formatted content for pasting into X Article editor
  if (!articleSlug) {
    console.error('Usage: node publish-long-tweet.js xarticle <slug>');
    process.exit(1);
  }

  const { data: article, error } = await supabase
    .from('articles')
    .select('*')
    .eq('slug', articleSlug)
    .eq('status', 'published')
    .single();

  if (error || !article) {
    console.error('Article not found or not published');
    process.exit(1);
  }

  const xArticleContent = await formatForXArticle(article);

  console.log('\n' + '='.repeat(60));
  console.log('X ARTICLE CONTENT (paste into X Article editor)');
  console.log('='.repeat(60));
  console.log('Lines marked [EMBED TWEET] = use + menu > Tweet to embed');
  console.log('='.repeat(60) + '\n');
  console.log(xArticleContent);
  console.log('\n' + '='.repeat(60));

} else {
  console.log('Usage:');
  console.log('  node publish-long-tweet.js list              # List published articles');
  console.log('  node publish-long-tweet.js preview <slug>    # Preview formatted long tweet');
  console.log('  node publish-long-tweet.js xarticle <slug>   # Format for X Article editor');
  console.log('  node publish-long-tweet.js post <slug>       # Post to X as long tweet');
}
