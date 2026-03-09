import { createServerClient } from '../../../lib/supabase';
import { CATEGORIES } from '../../../lib/categories';
import { notFound } from 'next/navigation';
import { formatContentType, getScoreStyle } from '../../../lib/resource-utils';
import ShareButtons from './ShareButtons';

export async function generateMetadata({ params }) {
  const { id } = await params;
  const supabase = createServerClient();
  const { data } = await supabase
    .from('resources')
    .select('title, summary')
    .eq('id', id)
    .single();

  if (!data) return { title: 'Resource - ClaudeLists' };
  return {
    title: `${data.title} - ClaudeLists`,
    description: data.summary,
    alternates: {
      canonical: `https://claudelists.com/resource/${id}`,
    },
    openGraph: {
      title: data.title,
      description: data.summary,
      type: 'article',
    },
    twitter: {
      card: 'summary_large_image',
      title: data.title,
      description: data.summary,
    },
  };
}

async function getResource(id) {
  const supabase = createServerClient();
  const { data } = await supabase
    .from('resources')
    .select(`
      *,
      categories(name, slug),
      resource_tags(tags(name))
    `)
    .eq('id', id)
    .eq('status', 'published')
    .single();
  return data;
}

async function getLinkedArticle(resourceId) {
  const supabase = createServerClient();
  const { data } = await supabase
    .from('article_resources')
    .select('articles(id, slug, title, article_type, meta_description, status)')
    .eq('resource_id', resourceId)
    .limit(1)
    .single();

  if (data?.articles?.status === 'published') return data.articles;
  return null;
}

export const revalidate = 300;

export default async function ResourcePage({ params }) {
  const { id } = await params;
  const resource = await getResource(id);

  if (!resource) notFound();

  const linkedArticle = await getLinkedArticle(resource.id);

  const category = CATEGORIES.find(c => c.name === resource.categories?.name);
  const tags = resource.resource_tags?.map(rt => rt.tags?.name).filter(Boolean) || [];
  const links = resource.expanded_links || [];
  const score = resource.ai_quality_score;
  const scoreStyle = getScoreStyle(score);
  const shareUrl = `https://claudelists.com/resource/${resource.id}`;

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-8">
      {/* Back + Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-[var(--muted)] mb-6">
        <a href="/browse" className="hover:text-[var(--foreground)] flex items-center gap-1">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <path d="M10 12l-4-4 4-4" />
          </svg>
          Browse
        </a>
        {category && (
          <>
            <span>/</span>
            <a href={`/category/${category.slug}`} className="hover:text-[var(--foreground)]">
              {category.name}
            </a>
          </>
        )}
        <span>/</span>
        <span className="text-[var(--foreground)] truncate max-w-[200px]">{resource.title}</span>
      </div>

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          {category && (
            <a
              href={`/category/${category.slug}`}
              className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium"
              style={{ backgroundColor: category.color + '15', color: category.color }}
            >
              {category.icon} {category.name}
            </a>
          )}
          {score && scoreStyle && (
            <span
              className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold ${scoreStyle}`}
              title={`Quality score: ${score}/10`}
            >
              {score}/10
            </span>
          )}
        </div>
        <h1 className="text-2xl font-bold mb-2">{resource.title}</h1>
        {resource.summary && (
          <p className="text-[var(--muted)]">{resource.summary}</p>
        )}
      </div>

      {/* Linked Article CTA */}
      {linkedArticle && (
        <a
          href={`/digest/${linkedArticle.slug}`}
          className="block mb-6 rounded-xl border-2 border-[var(--accent)] bg-[#C15F3C10] p-4 hover:bg-[#C15F3C18] transition-colors"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-xs font-semibold text-[var(--accent)] uppercase tracking-wide mb-1">
                Full Article Available
              </div>
              <div className="text-sm font-medium text-[var(--foreground)] truncate">
                {linkedArticle.title}
              </div>
              {linkedArticle.meta_description && (
                <div className="text-xs text-[var(--muted)] mt-1 line-clamp-1">
                  {linkedArticle.meta_description}
                </div>
              )}
            </div>
            <svg width="20" height="20" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="shrink-0 text-[var(--accent)]">
              <path d="M6 4l4 4-4 4" />
            </svg>
          </div>
        </a>
      )}

      {/* Meta */}
      <div className="flex flex-wrap items-center gap-4 text-sm text-[var(--muted)] mb-6 pb-6 border-b border-[var(--border)]">
        {resource.author_handle && (
          <a
            href={`https://x.com/${resource.author_handle}`}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-[var(--foreground)]"
          >
            @{resource.author_handle}
          </a>
        )}
        <span>{formatContentType(resource.content_type)}</span>
        {resource.tweet_created_at && (
          <span>{new Date(resource.tweet_created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</span>
        )}
        {resource.engagement && (
          <span>
            {resource.engagement.likes || 0} likes &middot; {resource.engagement.retweets || 0} RTs
          </span>
        )}
      </div>

      {/* Share */}
      <div className="flex items-center gap-2 mb-6">
        <span className="text-xs text-[var(--muted)]">Share:</span>
        <ShareButtons url={shareUrl} title={resource.title} />
      </div>

      {/* Tweet text */}
      {resource.tweet_text && (
        <div className="mb-6">
          <h2 className="text-sm font-semibold mb-2 text-[var(--muted)]">Original Tweet</h2>
          <blockquote className="border-l-2 border-[var(--accent)] pl-4 text-sm whitespace-pre-wrap">
            {resource.tweet_text}
          </blockquote>
          {resource.tweet_url && (
            <a
              href={resource.tweet_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block mt-2 text-xs text-[var(--accent)] hover:underline"
            >
              View on X →
            </a>
          )}
        </div>
      )}

      {/* Links */}
      {links.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-semibold mb-2 text-[var(--muted)]">Links</h2>
          <ul className="space-y-1">
            {links.map((link, i) => (
              <li key={i}>
                <a
                  href={link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-[var(--accent)] hover:underline break-all"
                >
                  {link}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Extracted content - only show if there's user-visible data */}
      {resource.extracted_content && (resource.extracted_content.title || resource.extracted_content.description || resource.extracted_content.stars != null || resource.extracted_content.language) && (
        <div className="mb-6">
          <h2 className="text-sm font-semibold mb-2 text-[var(--muted)]">Extracted Info</h2>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 text-sm space-y-1">
            {resource.extracted_content.title && <p><strong>Title:</strong> {resource.extracted_content.title}</p>}
            {resource.extracted_content.description && <p><strong>Description:</strong> {resource.extracted_content.description}</p>}
            {resource.extracted_content.stars != null && <p><strong>Stars:</strong> {resource.extracted_content.stars.toLocaleString()}</p>}
            {resource.extracted_content.language && <p><strong>Language:</strong> {resource.extracted_content.language}</p>}
          </div>
        </div>
      )}

      {/* Download .md */}
      {resource.has_downloadable && (
        <div className="mb-6">
          <a
            href={`/api/resources/${resource.id}/download`}
            className="inline-flex items-center gap-2 rounded-xl border border-[var(--accent)] px-4 py-2 text-sm font-medium text-[var(--accent)] hover:bg-[var(--accent)] hover:text-white transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M8 2v9M4 8l4 4 4-4M2 14h12" />
            </svg>
            Download Markdown
          </a>
        </div>
      )}

      {/* Tags */}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {tags.map(tag => (
            <span key={tag} className="rounded-md bg-[var(--surface-alt)] px-3 py-1 text-xs text-[var(--muted)]">
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
