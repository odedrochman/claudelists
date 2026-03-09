import { NextResponse } from 'next/server';
import { createServiceClient } from '../../../../../lib/supabase';
import { generateCategoryBackgrounds, assignResourceBackground } from '../../../../../lib/og-background';
import { CATEGORIES } from '../../../../../lib/categories';

function checkAdminKey(request) {
  const { searchParams } = new URL(request.url);
  const key = searchParams.get('key');
  return key && key === process.env.ADMIN_SECRET_KEY;
}

export async function POST(request) {
  if (!checkAdminKey(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const countPerCategory = body.count || 4;

  const supabase = createServiceClient();
  const results = {};
  const errors = [];

  // Generate backgrounds for each category
  for (const category of CATEGORIES) {
    try {
      // Check if pool already has images
      const { count: existing } = await supabase
        .from('og_background_pools')
        .select('id', { count: 'exact', head: true })
        .eq('category_slug', category.slug);

      if (existing >= countPerCategory) {
        results[category.slug] = { skipped: true, existing };
        continue;
      }

      const needed = countPerCategory - (existing || 0);
      const urls = await generateCategoryBackgrounds(category.slug, category.color, needed);
      results[category.slug] = { generated: urls.length, total: (existing || 0) + urls.length };
    } catch (e) {
      console.error(`Failed to seed ${category.slug}:`, e.message);
      errors.push({ category: category.slug, error: e.message });
    }
  }

  // Assign backgrounds to existing resources without one
  let assignedCount = 0;
  try {
    const { data: resources } = await supabase
      .from('resources')
      .select('id, categories(slug)')
      .is('og_background_url', null)
      .eq('status', 'published')
      .limit(200);

    for (const resource of (resources || [])) {
      const slug = resource.categories?.slug || 'discussion';
      try {
        await assignResourceBackground(slug, resource.id);
        assignedCount++;
      } catch (e) {
        // Skip individual failures
      }
    }
  } catch (e) {
    errors.push({ step: 'assign-resources', error: e.message });
  }

  return NextResponse.json({
    success: true,
    categories: results,
    resourcesAssigned: assignedCount,
    errors: errors.length > 0 ? errors : undefined,
  });
}
