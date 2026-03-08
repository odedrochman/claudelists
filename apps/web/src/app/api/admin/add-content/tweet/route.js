import { NextResponse } from 'next/server';
import { postTweet } from '../../../../../lib/twitter';

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
  const { tweet_text } = body;

  if (!tweet_text || !tweet_text.trim()) {
    return NextResponse.json({ error: 'tweet_text is required' }, { status: 400 });
  }

  if (tweet_text.length > 280) {
    return NextResponse.json({ error: 'Tweet exceeds 280 characters' }, { status: 400 });
  }

  try {
    const tweetData = await postTweet(tweet_text);
    return NextResponse.json({ success: true, tweet: tweetData });
  } catch (e) {
    console.error('Failed to post standalone tweet:', e);
    return NextResponse.json({ error: 'Failed to post tweet', details: e.message }, { status: 500 });
  }
}
