import { createServerClient } from '../../../../../lib/supabase';
import { NextResponse } from 'next/server';

export async function GET(request, { params }) {
  const { id } = await params;
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from('resources')
    .select('id, title, author_handle, markdown_content, has_downloadable')
    .eq('id', id)
    .eq('status', 'published')
    .single();

  if (error || !data) {
    return NextResponse.json({ error: 'Resource not found' }, { status: 404 });
  }

  if (!data.has_downloadable || !data.markdown_content) {
    return NextResponse.json({ error: 'No downloadable content' }, { status: 404 });
  }

  // Generate a clean filename
  const slug = (data.title || 'resource')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 60);
  const filename = `${slug}-by-${data.author_handle || 'unknown'}.md`;

  return new NextResponse(data.markdown_content, {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
