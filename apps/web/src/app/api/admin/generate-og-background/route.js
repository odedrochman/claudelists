import { NextResponse } from 'next/server';
import { createServiceClient } from '../../../../lib/supabase';
import { generateArticleBackground, generateCategoryBackgrounds, assignResourceBackground } from '../../../../lib/og-background';
import { CATEGORIES } from '../../../../lib/categories';

function checkAdminKey(request) {
  const { searchParams } = new URL(request.url);
  const key = searchParams.get('key');
  return key && key === process.env.ADMIN_SECRET_KEY;
}

export async function POST(request) {
  if (!checkAdminKey(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { targetType, targetId, categorySlug, count } = body;

  if (!targetType) {
    return NextResponse.json({ error: 'targetType is required (article, category-pool, resource)' }, { status: 400 });
  }

  try {
    if (targetType === 'article') {
      if (!targetId) {
        return NextResponse.json({ error: 'targetId is required for article' }, { status: 400 });
      }

      const supabase = createServiceClient();
      const { data: article } = await supabase
        .from('articles')
        .select('id, article_type, title')
        .eq('id', targetId)
        .single();

      if (!article) {
        return NextResponse.json({ error: 'Article not found' }, { status: 404 });
      }

      const url = await generateArticleBackground(article.article_type, article.title, article.id);
      return NextResponse.json({ success: true, url });

    } else if (targetType === 'category-pool') {
      if (!categorySlug) {
        return NextResponse.json({ error: 'categorySlug is required for category-pool' }, { status: 400 });
      }

      const category = CATEGORIES.find(c => c.slug === categorySlug);
      if (!category) {
        return NextResponse.json({ error: `Unknown category: ${categorySlug}` }, { status: 400 });
      }

      const urls = await generateCategoryBackgrounds(categorySlug, category.color, count || 4);
      return NextResponse.json({ success: true, urls, count: urls.length });

    } else if (targetType === 'resource') {
      if (!targetId) {
        return NextResponse.json({ error: 'targetId is required for resource' }, { status: 400 });
      }

      const supabase = createServiceClient();
      const { data: resource } = await supabase
        .from('resources')
        .select('id, categories(slug)')
        .eq('id', targetId)
        .single();

      if (!resource) {
        return NextResponse.json({ error: 'Resource not found' }, { status: 404 });
      }

      const slug = resource.categories?.slug || 'discussion';
      const url = await assignResourceBackground(slug, resource.id);
      return NextResponse.json({ success: true, url });

    } else {
      return NextResponse.json({ error: 'targetType must be article, category-pool, or resource' }, { status: 400 });
    }
  } catch (e) {
    console.error('OG background generation failed:', e);
    return NextResponse.json({ error: `Generation failed: ${e.message}` }, { status: 500 });
  }
}
