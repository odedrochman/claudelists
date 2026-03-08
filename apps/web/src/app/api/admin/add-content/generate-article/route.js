import { NextResponse } from 'next/server';

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
  const { title, summary, source_url, url_type, author, content, transcript } = body;

  if (!title || !source_url) {
    return NextResponse.json({ error: 'title and source_url are required' }, { status: 400 });
  }

  // Extract YouTube video ID for embedding
  let youtubeVideoId = null;
  if (url_type === 'youtube') {
    const ytMatch = source_url.match(/(?:v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
    if (ytMatch) youtubeVideoId = ytMatch[1];
  }

  const youtubeEmbedInstruction = youtubeVideoId
    ? `\n- This is a YouTube video. Embed it early in the article (after the intro paragraph) using this exact HTML block on its own line:\n\n<div style="position:relative;padding-bottom:56.25%;height:0;overflow:hidden;margin:1.5rem 0"><iframe src="https://www.youtube.com/embed/${youtubeVideoId}" style="position:absolute;top:0;left:0;width:100%;height:100%;border:0" allowfullscreen></iframe></div>\n`
    : '';

  try {
    const { default: Anthropic } = await import('@anthropic-ai/sdk');
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const prompt = `You are a tech blogger writing for claudelists.com/digest. This is a curated Claude ecosystem resource site focused on Claude AI, MCP servers, Claude Code, CLAUDE.md configs, prompts, and related tools.

Write a markdown article about this resource. Always write the article, even if the resource doesn't directly relate to Claude. The site occasionally covers adjacent AI and developer tools too.

Requirements:
- Start with a brief intro paragraph about what this resource is and why it matters
- Include relevant sections covering key features, how to use it, and why it matters
- Be 600-700 words (this is strict, aim for 650)
- Use H2 (##) for section headings
- Include the source URL as a link
- If there is an author, mention them with @handle format
- End with a brief takeaway or call to action
- Where there's a natural connection to the Claude ecosystem (Claude AI, Claude Code, MCP, Anthropic, etc.), mention it. But do NOT force a connection if there isn't one.${youtubeEmbedInstruction}

Writing style (CRITICAL, follow these strictly to avoid sounding AI-generated):
- Never use em dashes (--) or the word "delve"
- Never use "game-changer", "exciting", "revolutionize", "landscape", "leverage", "streamline", "robust", "comprehensive", "cutting-edge", "seamless"
- Never start paragraphs with "In today's..." or "In the world of..."
- Never use "Whether you're a ... or a ..." constructions
- Do not use filler transitions like "Moreover", "Furthermore", "Additionally", "It's worth noting that"
- Vary sentence length. Mix short punchy sentences with longer ones.
- Be specific and concrete, not vague and hyperbolic
- Write like a developer explaining something to another developer over coffee
- Use contractions naturally (it's, don't, you'll, there's)

Resource details:
- Title: ${title}
- Summary: ${summary || 'N/A'}
- URL: ${source_url}
- Type: ${url_type || 'article'}
- Author: ${author || 'unknown'}
- Extracted content: ${(content || '').substring(0, 3000)}${transcript ? `\n\nVideo transcript (use this for richer article content):\n${transcript.substring(0, 6000)}` : ''}

Return ONLY the markdown content. No frontmatter, no code fences wrapping the entire output.`;

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }],
    });

    const articleContent = response.content[0].text.trim();

    return NextResponse.json({ success: true, content: articleContent });
  } catch (e) {
    console.error('Failed to generate article:', e);
    return NextResponse.json({ error: 'Failed to generate article', details: e.message }, { status: 500 });
  }
}
