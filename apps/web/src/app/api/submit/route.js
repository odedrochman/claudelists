import { NextResponse } from 'next/server';
import { createServerClient } from '../../../lib/supabase';

export async function POST(request) {
  try {
    const body = await request.json();
    const { url, title, type, description, submitter_name, submitter_twitter } = body;

    if (!url || !title) {
      return NextResponse.json(
        { error: 'URL and title are required.' },
        { status: 400 }
      );
    }

    // Basic URL validation
    try {
      new URL(url);
    } catch {
      return NextResponse.json(
        { error: 'Please enter a valid URL.' },
        { status: 400 }
      );
    }

    const supabase = createServerClient();

    // Check for duplicate URL
    const { data: existing } = await supabase
      .from('submissions')
      .select('id')
      .eq('url', url)
      .limit(1);

    if (existing && existing.length > 0) {
      return NextResponse.json(
        { error: 'This resource has already been submitted. Thanks!' },
        { status: 409 }
      );
    }

    const { error } = await supabase
      .from('submissions')
      .insert({
        url,
        title,
        resource_type: type || null,
        description: description || null,
        submitter_name: submitter_name || null,
        submitter_twitter: submitter_twitter?.replace('@', '') || null,
        status: 'pending',
      });

    if (error) {
      console.error('Submission insert error:', error);
      // If submissions table doesn't exist yet, still return success
      // (we'll create it later, for now log the submission)
      if (error.code === '42P01') {
        console.log('Submissions table not found. Submission data:', { url, title, type, description, submitter_name, submitter_twitter });
        return NextResponse.json({ success: true, note: 'Logged for review' });
      }
      return NextResponse.json(
        { error: 'Failed to save submission. Please try again.' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Submit API error:', err);
    return NextResponse.json(
      { error: 'Something went wrong. Please try again.' },
      { status: 500 }
    );
  }
}
