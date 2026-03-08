import { createServerClient, createServiceClient } from '../../../lib/supabase';
import { notFound } from 'next/navigation';
import { marked } from 'marked';
import Image from 'next/image';
import ShareButtons from './ShareButtons';
import TweetEmbeds from './TweetEmbeds';

export const revalidate = 300;

const TYPE_LABEL = {
  daily: 'Daily Digest',
  weekly: 'Weekly Digest',
  monthly: 'Monthly Digest',
};

const TYPE_COLOR = {
  daily: 'bg-blue-50 text-blue-700',
  weekly: 'bg-purple-50 text-purple-700',
  monthly: 'bg-emerald-50 text-emerald-700',
};

async function getArticle(slug, allowDraft = false) {
  // Draft preview requires service role to bypass RLS (anon can only read published)
  const supabase = allowDraft ? createServiceClient() : createServerClient();
  let query = supabase
    .from('articles')
    .select(`
      id, slug, title, article_type, content, meta_description, og_title,
      status, published_at, period_start, period_end,
      article_resources ( position, resource_id, resources ( title, tweet_url, author_handle ) )
    `)
    .eq('slug', slug);

  if (allowDraft) {
    query = query.in('status', ['published', 'draft']);
  } else {
    query = query.eq('status', 'published');
  }

  const { data } = await query.single();
  return data;
}

function isAdminPreview(searchParams) {
  return searchParams?.preview === 'true' && searchParams?.key === process.env.ADMIN_SECRET_KEY;
}

export async function generateMetadata({ params, searchParams }) {
  const { slug } = await params;
  const sp = await searchParams;
  const article = await getArticle(slug, isAdminPreview(sp));
  if (!article) return {};

  return {
    title: `${article.title} - ClaudeLists`,
    description: article.meta_description || article.title,
    alternates: {
      canonical: `https://claudelists.com/digest/${article.slug}`,
    },
    openGraph: {
      title: article.og_title || article.title,
      description: article.meta_description || article.title,
      url: `https://claudelists.com/digest/${article.slug}`,
      type: 'article',
      publishedTime: article.published_at,
      section: TYPE_LABEL[article.article_type] || 'Digest',
      authors: ['ClaudeLists'],
    },
    twitter: {
      card: 'summary_large_image',
      title: article.og_title || article.title,
      description: article.meta_description || article.title,
    },
  };
}

export default async function ArticlePage({ params, searchParams }) {
  const { slug } = await params;
  const sp = await searchParams;
  const isDraftPreview = isAdminPreview(sp);
  const article = await getArticle(slug, isDraftPreview);

  if (!article) notFound();

  marked.setOptions({
    breaks: true,
    gfm: true,
  });

  // Strip leading H1 title from markdown (already shown in page header)
  let content = article.content || '';
  content = content.replace(/^#\s+.*\n+/, '');
  let htmlContent = marked.parse(content);

  // Strip hyperlinks from H2 headings (tweet embeds replace them)
  htmlContent = htmlContent.replace(
    /<h2><a\s+href="[^"]*">([^<]*)<\/a><\/h2>/g,
    '<h2>$1</h2>'
  );

  const articleUrl = `https://claudelists.com/digest/${article.slug}`;

  // Build handle -> tweet_url map for inline embeds
  const handleTweetMap = {};
  (article.article_resources || [])
    .filter(ar => ar.resources?.tweet_url && ar.resources?.author_handle)
    .forEach(ar => {
      handleTweetMap[ar.resources.author_handle.toLowerCase()] = ar.resources.tweet_url;
    });

  // Inject tweet embed placeholders before each <hr> by finding the @handle in the preceding section
  // Split HTML on <hr> tags, and for each section find the author handle to attach the tweet
  if (Object.keys(handleTweetMap).length > 0) {
    const parts = htmlContent.split(/<hr\s*\/?>/);
    const rebuilt = [];
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      rebuilt.push(part);
      // Only add tweet embed between sections (not after the last one)
      if (i < parts.length - 1) {
        // Find @handle link in this section
        const handleMatch = part.match(/x\.com\/([a-zA-Z0-9_]+)(?:"|'|\))/);
        if (handleMatch) {
          const handle = handleMatch[1].toLowerCase();
          const tweetUrl = handleTweetMap[handle];
          if (tweetUrl) {
            rebuilt.push(`<div data-tweet-url="${tweetUrl}" style="margin: 1rem 0; max-width: 550px;"></div>`);
          }
        }
        rebuilt.push('<hr>');
      }
    }
    htmlContent = rebuilt.join('');
  }
  const date = article.published_at
    ? new Date(article.published_at).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
    : '';

  const ogImageUrl = `/digest/${article.slug}/opengraph-image`;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: article.title,
    description: article.meta_description || article.title,
    image: `https://claudelists.com${ogImageUrl}`,
    datePublished: article.published_at,
    author: { '@type': 'Organization', name: 'ClaudeLists', url: 'https://claudelists.com' },
    publisher: { '@type': 'Organization', name: 'ClaudeLists', url: 'https://claudelists.com' },
    mainEntityOfPage: articleUrl,
  };

  return (
    <div className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      {isDraftPreview && article.status === 'draft' && (
        <div className="mb-6 rounded-lg border-2 border-amber-400 bg-amber-50 px-4 py-3 text-center">
          <span className="text-sm font-semibold text-amber-800">DRAFT PREVIEW</span>
          <span className="ml-2 text-sm text-amber-700">This article is not published yet.</span>
        </div>
      )}
      <article className="py-10">
        {/* OG hero image */}
        <div className="mb-8 rounded-xl overflow-hidden shadow-lg">
          <Image
            src={ogImageUrl}
            alt={article.title}
            width={1200}
            height={630}
            className="w-full h-auto"
            priority
          />
        </div>

        {/* Header */}
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-4">
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${TYPE_COLOR[article.article_type] || 'bg-gray-100 text-gray-700'}`}>
              {TYPE_LABEL[article.article_type] || article.article_type}
            </span>
            {date && <span className="text-sm text-[var(--muted)]">{date}</span>}
          </div>

          <h1 className="text-3xl font-bold tracking-tight mb-5">{article.title}</h1>

          <ShareButtons url={articleUrl} title={article.title} />
        </div>

        {/* Article content */}
        <div
          className="article-content prose prose-lg max-w-none
            prose-headings:text-[var(--foreground)] prose-headings:font-semibold prose-headings:tracking-tight
            prose-h2:text-[1.375rem] prose-h2:mt-10 prose-h2:mb-3
            prose-h3:text-lg prose-h3:mt-8 prose-h3:mb-3
            prose-p:text-[var(--foreground)] prose-p:leading-[1.75] prose-p:mb-4 prose-p:text-base
            prose-a:text-[var(--accent)] prose-a:font-medium prose-a:no-underline hover:prose-a:underline
            prose-strong:text-[var(--foreground)] prose-strong:font-semibold
            prose-li:text-[var(--foreground)] prose-li:mb-1
            prose-hr:my-10 prose-hr:border-[var(--border)]
            prose-ul:my-4 prose-ol:my-4"
          dangerouslySetInnerHTML={{ __html: htmlContent }}
        />

        {/* Activates inline tweet embeds in the article content */}
        <TweetEmbeds />

        {/* Back link */}
        <div className="mt-12 pt-6 border-t border-[var(--border)]">
          <a href="/digest" className="text-sm text-[var(--accent)] hover:underline">
            &larr; All digests
          </a>
        </div>
      </article>
    </div>
  );
}
