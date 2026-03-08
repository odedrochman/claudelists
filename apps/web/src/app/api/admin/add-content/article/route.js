import { NextResponse } from 'next/server';
import { createServiceClient } from '../../../../../lib/supabase';

function checkAdminKey(request) {
  const { searchParams } = new URL(request.url);
  const key = searchParams.get('key');
  return key && key === process.env.ADMIN_SECRET_KEY;
}

function generateSlug(title) {
  const dateStr = new Date().toISOString().split('T')[0];
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 60)
    .replace(/-$/, '');
  return `${slug}-${dateStr}`;
}

export async function POST(request) {
  if (!checkAdminKey(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { title, article_type, content, meta_description, source_url, resource_id } = body;

  if (!title || !content) {
    return NextResponse.json({ error: 'title and content are required' }, { status: 400 });
  }

  const validTypes = ['daily', 'weekly', 'monthly'];
  const type = validTypes.includes(article_type) ? article_type : 'daily';

  const supabase = createServiceClient();
  let slug = generateSlug(title);

  // Insert article
  const articleRow = {
    slug,
    title,
    article_type: type,
    content,
    status: 'draft',
    meta_description: meta_description || null,
  };

  let article;
  const { data, error: insertError } = await supabase
    .from('articles')
    .insert(articleRow)
    .select('id, slug, title, status')
    .single();

  if (insertError) {
    // Handle slug collision by appending suffix
    if (insertError.code === '23505' && insertError.message?.includes('slug')) {
      slug = `${slug}-2`;
      articleRow.slug = slug;
      const { data: retry, error: retryError } = await supabase
        .from('articles')
        .insert(articleRow)
        .select('id, slug, title, status')
        .single();

      if (retryError) {
        console.error('Failed to insert article (retry):', retryError);
        return NextResponse.json({ error: 'Failed to create article', details: retryError.message }, { status: 500 });
      }
      article = retry;
    } else {
      console.error('Failed to insert article:', insertError);
      return NextResponse.json({ error: 'Failed to create article', details: insertError.message }, { status: 500 });
    }
  } else {
    article = data;
  }

  // Link resource if provided
  if (resource_id) {
    const { error: linkError } = await supabase.from('article_resources').insert({
      article_id: article.id,
      resource_id,
      position: 0,
    });
    if (linkError) {
      console.warn('Failed to link resource to article:', linkError.message);
    }
  }

  return NextResponse.json({
    success: true,
    article: {
      id: article.id,
      slug: article.slug,
      title: article.title,
      status: article.status,
    },
  });
}
