import { createServerClient } from '../../../lib/supabase';
import { CATEGORIES } from '../../../lib/categories';
import { notFound } from 'next/navigation';

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

export const revalidate = 300;

export default async function ResourcePage({ params }) {
  const { id } = await params;
  const resource = await getResource(id);

  if (!resource) notFound();

  const category = CATEGORIES.find(c => c.name === resource.categories?.name);
  const tags = resource.resource_tags?.map(rt => rt.tags?.name).filter(Boolean) || [];
  const links = resource.expanded_links || [];

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-[var(--muted)] mb-6">
        <a href="/" className="hover:text-[var(--foreground)]">Home</a>
        <span>/</span>
        {category && (
          <>
            <a href={`/category/${category.slug}`} className="hover:text-[var(--foreground)]">
              {category.name}
            </a>
            <span>/</span>
          </>
        )}
        <span className="text-[var(--foreground)]">{resource.title}</span>
      </div>

      {/* Header */}
      <div className="mb-6">
        {category && (
          <a
            href={`/category/${category.slug}`}
            className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium mb-3"
            style={{ backgroundColor: category.color + '15', color: category.color }}
          >
            {category.icon} {category.name}
          </a>
        )}
        <h1 className="text-2xl font-bold mb-2">{resource.title}</h1>
        <p className="text-[var(--muted)]">{resource.summary}</p>
      </div>

      {/* Meta */}
      <div className="flex flex-wrap items-center gap-4 text-sm text-[var(--muted)] mb-6 pb-6 border-b border-[var(--border)]">
        <a
          href={`https://x.com/${resource.author_handle}`}
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-[var(--foreground)]"
        >
          @{resource.author_handle}
        </a>
        <span>{resource.content_type.replace('_', ' ')}</span>
        {resource.tweet_created_at && (
          <span>{new Date(resource.tweet_created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</span>
        )}
        {resource.engagement && (
          <span>
            {resource.engagement.likes || 0} likes &middot; {resource.engagement.retweets || 0} RTs
          </span>
        )}
      </div>

      {/* Tweet text */}
      {resource.tweet_text && (
        <div className="mb-6">
          <h2 className="text-sm font-semibold mb-2 text-[var(--muted)]">Original Tweet</h2>
          <blockquote className="border-l-2 border-[var(--accent)] pl-4 text-sm whitespace-pre-wrap">
            {resource.tweet_text}
          </blockquote>
          <a
            href={resource.tweet_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block mt-2 text-xs text-[var(--accent)] hover:underline"
          >
            View on Twitter &rarr;
          </a>
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

      {/* Extracted content */}
      {resource.extracted_content && (
        <div className="mb-6">
          <h2 className="text-sm font-semibold mb-2 text-[var(--muted)]">Extracted Info</h2>
          <div className="rounded-lg border border-[var(--border)] p-4 text-sm space-y-1">
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
            className="inline-flex items-center gap-2 rounded-lg border border-[var(--accent)] px-4 py-2 text-sm font-medium text-[var(--accent)] hover:bg-[var(--accent)] hover:text-white transition-colors"
          >
            ⬇ Download .md file
          </a>
        </div>
      )}

      {/* Tags */}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {tags.map(tag => (
            <span key={tag} className="rounded-full bg-[var(--border)] px-3 py-1 text-xs text-[var(--muted)]">
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
