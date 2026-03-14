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
  quick: 'Quick Update',
  editorial: 'Editorial',
};

const TYPE_COLOR = {
  daily: 'bg-blue-50 text-blue-700',
  weekly: 'bg-purple-50 text-purple-700',
  monthly: 'bg-emerald-50 text-emerald-700',
  quick: 'bg-red-50 text-red-700',
  editorial: 'bg-amber-50 text-amber-700',
};

async function getAdjacentArticles(article) {
  if (!article?.published_at) return { prev: null, next: null };
  const supabase = createServerClient();

  const [{ data: prevData }, { data: nextData }] = await Promise.all([
    supabase
      .from('articles')
      .select('slug, title, article_type')
      .eq('status', 'published')
      .lt('published_at', article.published_at)
      .order('published_at', { ascending: false })
      .limit(1)
      .single(),
    supabase
      .from('articles')
      .select('slug, title, article_type')
      .eq('status', 'published')
      .gt('published_at', article.published_at)
      .order('published_at', { ascending: true })
      .limit(1)
      .single(),
  ]);

  return { prev: prevData || null, next: nextData || null };
}

async function getArticle(slug, allowDraft = false) {
  // Draft preview requires service role to bypass RLS (anon can only read published)
  const supabase = allowDraft ? createServiceClient() : createServerClient();
  let query = supabase
    .from('articles')
    .select(`
      id, slug, title, article_type, content, meta_description, og_title, og_quote, og_background_url,
      status, published_at, period_start, period_end,
      article_resources ( position, resource_id, resources ( title, tweet_url, author_handle, primary_url, content_type ) )
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

  const ogTitle = article.og_title || article.title;
  const resourceCount = (article.article_resources || []).length;

  // Editorial articles use the background image directly (no overlay)
  let ogImageUrl;
  if (article.article_type === 'editorial' && article.og_background_url) {
    ogImageUrl = article.og_background_url;
  } else {
    const ogImageParams = new URLSearchParams({
      title: ogTitle,
      type: article.article_type || 'daily',
      count: String(resourceCount),
    });
    if (article.og_background_url) {
      ogImageParams.set('bg', article.og_background_url);
    }
    if (article.og_quote) {
      ogImageParams.set('quote', article.og_quote);
    }
    ogImageUrl = `https://claudelists.com/api/og?${ogImageParams.toString()}`;
  }

  return {
    title: `${article.title} - ClaudeLists`,
    description: article.meta_description || article.title,
    alternates: {
      canonical: `https://claudelists.com/digest/${article.slug}`,
    },
    openGraph: {
      title: ogTitle,
      description: article.meta_description || article.title,
      url: `https://claudelists.com/digest/${article.slug}`,
      type: 'article',
      publishedTime: article.published_at,
      section: TYPE_LABEL[article.article_type] || 'Digest',
      authors: ['ClaudeLists'],
      images: [{
        url: ogImageUrl,
        width: 1200,
        height: 630,
        alt: ogTitle,
      }],
    },
    twitter: {
      card: 'summary_large_image',
      title: ogTitle,
      description: article.meta_description || article.title,
      images: [ogImageUrl],
    },
  };
}

export default async function ArticlePage({ params, searchParams }) {
  const { slug } = await params;
  const sp = await searchParams;
  const isDraftPreview = isAdminPreview(sp);
  const article = await getArticle(slug, isDraftPreview);

  if (!article) notFound();

  const { prev, next } = article.status === 'published' ? await getAdjacentArticles(article) : { prev: null, next: null };

  marked.setOptions({
    breaks: true,
    gfm: true,
  });

  // Strip leading H1 title from markdown (already shown in page header)
  let content = article.content || '';
  content = content.replace(/^#\s+.*\n+/, '');
  let htmlContent = marked.parse(content);

  // Strip external hyperlinks from H2 headings (tweet embeds replace them)
  // Keep internal /resource/ links for internal linking
  htmlContent = htmlContent.replace(
    /<h2><a\s+href="((?!https:\/\/claudelists\.com\/resource\/)[^"]*)">([^<]*)<\/a><\/h2>/g,
    '<h2>$2</h2>'
  );

  const articleUrl = `https://claudelists.com/digest/${article.slug}`;

  // Build ordered resource list for embed injection (position-based)
  const orderedResources = (article.article_resources || [])
    .sort((a, b) => a.position - b.position)
    .map(ar => ({
      tweetUrl: ar.resources?.tweet_url,
      handle: ar.resources?.author_handle,
      primaryUrl: ar.resources?.primary_url,
      contentType: ar.resources?.content_type,
    }));

  // Helper: extract YouTube video ID from URL
  function extractYouTubeId(url) {
    if (!url) return null;
    const match = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
    return match ? match[1] : null;
  }

  // Inject tweet embeds and YouTube iframes between <hr>-separated sections
  if (orderedResources.length > 0) {
    const parts = htmlContent.split(/<hr\s*\/?>/);
    const rebuilt = [];
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      rebuilt.push(part);
      // Only add embeds between sections (not after the last one)
      if (i < parts.length - 1) {
        const resource = orderedResources[i];

        // Check for YouTube video embed
        const youtubeId = resource ? (extractYouTubeId(resource.primaryUrl) || extractYouTubeId(resource.tweetUrl)) : null;
        if (youtubeId) {
          rebuilt.push(`<div style="position:relative;padding-bottom:56.25%;height:0;overflow:hidden;margin:1.5rem 0;border-radius:12px;"><iframe src="https://www.youtube.com/embed/${youtubeId}" style="position:absolute;top:0;left:0;width:100%;height:100%;" frameborder="0" allow="accelerometer;autoplay;clipboard-write;encrypted-media;gyroscope;picture-in-picture" allowfullscreen></iframe></div>`);
        }

        // Check for tweet embed
        if (resource && resource.tweetUrl && resource.handle) {
          rebuilt.push(`<div data-tweet-url="${resource.tweetUrl}" style="margin: 1rem 0; max-width: 550px;"></div>`);
        }

        rebuilt.push('<hr>');
      }
    }
    htmlContent = rebuilt.join('');
  }
  const date = article.published_at
    ? new Date(article.published_at).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
    : '';

  // Build OG image URL from query params (fast, no DB call at render time)
  const resourceCount = (article.article_resources || []).length;
  let pageOgImageUrl;
  if (article.article_type === 'editorial' && article.og_background_url) {
    pageOgImageUrl = article.og_background_url;
  } else {
    const ogParams = new URLSearchParams({
      title: article.og_title || article.title,
      type: article.article_type || 'daily',
      count: String(resourceCount),
    });
    if (article.og_background_url) {
      ogParams.set('bg', article.og_background_url);
    }
    pageOgImageUrl = `/api/og?${ogParams.toString()}`;
  }

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: article.title,
    description: article.meta_description || article.title,
    image: pageOgImageUrl.startsWith('http') ? pageOgImageUrl : `https://claudelists.com${pageOgImageUrl}`,
    datePublished: article.published_at,
    author: { '@type': 'Organization', name: 'ClaudeLists', url: 'https://claudelists.com' },
    publisher: { '@type': 'Organization', name: 'ClaudeLists', url: 'https://claudelists.com' },
    mainEntityOfPage: articleUrl,
  };

  return (
    <div className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-[var(--muted)] pt-6 mb-4">
        <a href="/" className="hover:text-[var(--foreground)]">Home</a>
        <span>/</span>
        <a href="/digest" className="hover:text-[var(--foreground)]">Digest</a>
        <span>/</span>
        <span className="text-[var(--foreground)] truncate max-w-[250px]">{article.title}</span>
      </div>

      {isDraftPreview && article.status === 'draft' && (
        <div className="mb-6 rounded-lg border-2 border-amber-400 bg-amber-50 px-4 py-3 text-center">
          <span className="text-sm font-semibold text-amber-800">DRAFT PREVIEW</span>
          <span className="ml-2 text-sm text-amber-700">This article is not published yet.</span>
        </div>
      )}
      <article className="py-10">
        {/* OG hero image */}
        <div className="mb-8 rounded-xl overflow-hidden shadow-lg">
          {article.article_type === 'editorial' && article.og_background_url ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={article.og_background_url}
              alt={article.title}
              width={1200}
              height={630}
              className="w-full h-auto"
            />
          ) : (
            <Image
              src={pageOgImageUrl}
              alt={article.title}
              width={1200}
              height={630}
              className="w-full h-auto"
              priority
            />
          )}
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

        {/* Navigation */}
        <div className="mt-12 pt-6 border-t border-[var(--border)]">
          <div className="flex items-center justify-between mb-4">
            {prev ? (
              <a href={`/digest/${prev.slug}`} className="group flex items-center gap-2 text-sm text-[var(--muted)] hover:text-[var(--accent)] transition-colors max-w-[45%]">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="shrink-0">
                  <path d="M10 12l-4-4 4-4" />
                </svg>
                <span className="truncate">{prev.title}</span>
              </a>
            ) : <span />}
            {next ? (
              <a href={`/digest/${next.slug}`} className="group flex items-center gap-2 text-sm text-[var(--muted)] hover:text-[var(--accent)] transition-colors text-right max-w-[45%]">
                <span className="truncate">{next.title}</span>
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="shrink-0">
                  <path d="M6 4l4 4-4 4" />
                </svg>
              </a>
            ) : <span />}
          </div>
          <div className="text-center">
            <a href="/digest" className="text-xs text-[var(--accent)] hover:underline">
              All digests
            </a>
          </div>
        </div>
      </article>
    </div>
  );
}
