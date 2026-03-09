import { NextResponse } from 'next/server';
import { createServiceClient } from '../../../../../../lib/supabase';

function checkAdminKey(request) {
  const { searchParams } = new URL(request.url);
  const key = searchParams.get('key');
  if (!key || key !== process.env.ADMIN_SECRET_KEY) {
    return false;
  }
  return true;
}

// Format article content for X Article editor
// Includes tweet URLs for embedding and link back to site
async function formatForXArticle(supabase, article) {
  // Get linked resources with tweet URLs
  const { data: articleResources } = await supabase
    .from('article_resources')
    .select('resource_id, position')
    .eq('article_id', article.id)
    .order('position');

  const tweetUrlMap = {};
  if (articleResources && articleResources.length > 0) {
    const resourceIds = articleResources.map(ar => ar.resource_id);
    const { data: resources } = await supabase
      .from('resources')
      .select('id, tweet_url, author_handle, primary_url, content_type')
      .in('id', resourceIds);
    if (resources) {
      for (const r of resources) {
        tweetUrlMap[r.id] = { tweet_url: r.tweet_url, author_handle: r.author_handle, primary_url: r.primary_url, content_type: r.content_type };
      }
    }
  }

  const orderedTweetUrls = (articleResources || []).map(ar => tweetUrlMap[ar.resource_id] || null);

  let text = article.content || '';

  // Remove leading H1
  text = text.replace(/^#\s+.*\n+/, '');

  // Helper: check if URL is a YouTube video
  function isYouTubeUrl(url) {
    if (!url) return false;
    return /(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)/.test(url);
  }

  // Convert ## headings to numbered entries and inject embed markers.
  // Handles both "## [Title](url)" (linked) and "## Title" (plain) formats.
  let resourceIdx = 0;
  text = text.replace(/##\s*(?:\[([^\]]+)\]\(([^)]+)\)|(.+))/g, (match, linkedTitle, linkedUrl, plainTitle) => {
    const title = linkedTitle || plainTitle;
    const info = orderedTweetUrls[resourceIdx];
    resourceIdx++;
    let section = `${resourceIdx}. ${title}`;
    if (linkedUrl) section += `\n${linkedUrl}`;

    // Add video embed marker for YouTube resources
    const videoUrl = info?.primary_url || linkedUrl;
    if (isYouTubeUrl(videoUrl)) {
      section += `\n\n[EMBED VIDEO]: ${videoUrl}`;
    }

    // Add tweet embed marker
    if (info && info.tweet_url) {
      section += `\n\n[EMBED TWEET]: ${info.tweet_url}`;
    }
    return section;
  });

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

  // Remove closing CTA (we add our own)
  text = text.replace(/(The pattern is clear|The community keeps delivering|Found something worth sharing).*$/s, '').trim();

  const digestUrl = `https://claudelists.com/digest/${article.slug}`;

  const parts = [
    article.title,
    '',
    text,
    '',
    `Read the full article with links at ${digestUrl}`,
    '',
    'Found a Claude resource worth sharing? Tag @claudelists on X or submit at claudelists.com/submit',
  ];

  return parts.join('\n');
}

export async function POST(request, { params }) {
  if (!checkAdminKey(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const supabase = createServiceClient();

  const { data: article, error: fetchError } = await supabase
    .from('articles')
    .select('*')
    .eq('id', id)
    .single();

  if (fetchError || !article) {
    return NextResponse.json({ error: 'Article not found' }, { status: 404 });
  }

  if (article.status !== 'published') {
    return NextResponse.json({ error: 'Article must be published first' }, { status: 400 });
  }

  const content = await formatForXArticle(supabase, article);

  return NextResponse.json({
    success: true,
    content,
    charCount: content.length,
    instructions: '[EMBED TWEET] = use + menu > Tweet in X Article editor. [EMBED VIDEO] = paste YouTube URL on its own line (X auto-renders preview).',
  });
}
