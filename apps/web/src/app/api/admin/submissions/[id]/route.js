import { NextResponse } from 'next/server';
import { createServiceClient } from '../../../../../lib/supabase';

function checkAdminKey(request) {
  const { searchParams } = new URL(request.url);
  const key = searchParams.get('key');
  if (!key || key !== process.env.ADMIN_SECRET_KEY) {
    return false;
  }
  return true;
}

export async function PATCH(request, { params }) {
  if (!checkAdminKey(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const { action, notes } = body;

  if (!['approve', 'reject'].includes(action)) {
    return NextResponse.json({ error: 'Action must be approve or reject' }, { status: 400 });
  }

  const supabase = createServiceClient();

  // Fetch the submission first
  const { data: submission, error: fetchError } = await supabase
    .from('submissions')
    .select('*')
    .eq('id', id)
    .single();

  if (fetchError || !submission) {
    return NextResponse.json({ error: 'Submission not found' }, { status: 404 });
  }

  // Update submission status
  const { error: updateError } = await supabase
    .from('submissions')
    .update({
      status: action === 'approve' ? 'approved' : 'rejected',
      reviewer_notes: notes || null,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (updateError) {
    console.error('Submission update error:', updateError);
    return NextResponse.json({ error: 'Failed to update submission' }, { status: 500 });
  }

  // If approved, create a resource entry
  if (action === 'approve') {
    const { error: resourceError } = await supabase
      .from('resources')
      .insert({
        tweet_id: `submission-${id}`,
        title: submission.title,
        summary: submission.description || submission.title,
        tweet_text: '',
        tweet_url: submission.url,
        author_handle: submission.submitter_twitter || 'community',
        author_name: submission.submitter_name || 'Community Submission',
        content_type: submission.resource_type || 'link',
        primary_url: submission.url,
        status: 'published',
        discovered_at: new Date().toISOString(),
      });

    if (resourceError) {
      console.error('Resource creation error:', resourceError);
      return NextResponse.json({
        error: 'Submission approved but failed to create resource. Check logs.',
        submission_updated: true,
      }, { status: 500 });
    }
  }

  return NextResponse.json({ success: true, action });
}
