import { ImageResponse } from 'next/og';
import { createServerClient } from '../../../lib/supabase';
import { CATEGORIES } from '../../../lib/categories';

export const runtime = 'edge';
export const alt = 'ClaudeLists Resource';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

function getScoreColor(score) {
  if (score >= 8) return '#34D399';
  if (score >= 6) return '#60A5FA';
  if (score >= 4) return '#FBBF24';
  return '#F87171';
}

function getScoreLabel(score) {
  if (score >= 9) return 'EXCEPTIONAL';
  if (score >= 8) return 'EXCELLENT';
  if (score >= 7) return 'GREAT';
  if (score >= 6) return 'SOLID';
  if (score >= 5) return 'DECENT';
  return 'BASIC';
}

function getScorePanelBg(score) {
  if (score >= 8) return '#0F1F1A';
  if (score >= 6) return '#0F1520';
  if (score >= 4) return '#1F1A0F';
  return '#1F0F0F';
}

export default async function OGImage({ params }) {
  const { id } = await params;
  const supabase = createServerClient();
  const { data: resource } = await supabase
    .from('resources')
    .select('title, summary, content_type, ai_quality_score, author_handle, og_background_url, categories(name, slug)')
    .eq('id', id)
    .single();

  if (!resource) {
    return new ImageResponse(
      (
        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#111014', fontFamily: 'system-ui' }}>
          <div style={{ fontSize: 32, color: '#555' }}>Resource not found</div>
        </div>
      ),
      { ...size }
    );
  }

  const category = CATEGORIES.find(c => c.name === resource.categories?.name);
  const catColor = category?.color || '#C15F3C';
  const catIcon = category?.icon || '';
  const catName = category?.name || '';
  const score = resource.ai_quality_score;
  const scoreColor = score ? getScoreColor(score) : '#888';
  const scoreLabel = score ? getScoreLabel(score) : '';
  const scorePanelBg = score ? getScorePanelBg(score) : '#151218';
  const title = resource.title || 'Untitled Resource';

  let displayTitle = title;
  if (title.length > 70) {
    const truncated = title.slice(0, 67);
    const lastSpace = truncated.lastIndexOf(' ');
    displayTitle = (lastSpace > 40 ? truncated.slice(0, lastSpace) : truncated) + '...';
  }

  const author = resource.author_handle ? `@${resource.author_handle}` : '';

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          position: 'relative',
          overflow: 'hidden',
          background: '#0F0D13',
        }}
      >
        {/* Background: AI image or gradient fallback */}
        {resource.og_background_url ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={resource.og_background_url}
              alt=""
              width={1200}
              height={630}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: 1200,
                height: 630,
                objectFit: 'cover',
              }}
            />
            {/* Dark overlay for text readability */}
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                display: 'flex',
                background: 'rgba(15, 13, 19, 0.55)',
              }}
            />
          </>
        ) : (
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              display: 'flex',
              background: 'linear-gradient(160deg, #0F0D13 0%, #1A1520 100%)',
            }}
          />
        )}

        {/* Bold left accent bar */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: 8,
            height: '100%',
            display: 'flex',
            background: catColor,
          }}
        />

        {/* Main layout */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'row',
            width: '100%',
            height: '100%',
            position: 'relative',
          }}
        >
          {/* LEFT: Text content */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              padding: score ? '52px 40px 52px 56px' : '52px 56px',
              flex: 1,
              justifyContent: 'space-between',
            }}
          >
            {/* Category badge - bolder */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {catName && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '10px 22px',
                    borderRadius: 8,
                    background: `${catColor}30`,
                    border: `2.5px solid ${catColor}80`,
                    color: catColor,
                    fontSize: 18,
                    fontWeight: 800,
                  }}
                >
                  {catIcon} {catName}
                </div>
              )}
            </div>

            {/* Title - bigger and bolder */}
            <div
              style={{
                display: 'flex',
                fontSize: score ? 46 : 52,
                fontWeight: 900,
                color: '#FFFFFF',
                lineHeight: 1.1,
                letterSpacing: -0.5,
              }}
            >
              {displayTitle}
            </div>

            {/* Bottom: author + brand */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', fontSize: 22, color: '#B0A698', fontWeight: 600 }}>
                {author}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 10,
                    background: '#C15F3C',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#fff',
                    fontSize: 18,
                    fontWeight: 900,
                  }}
                >
                  CL
                </div>
                <div style={{ display: 'flex', fontSize: 22, fontWeight: 700, color: '#D97757' }}>
                  claudelists.com
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT: Bold colored score panel */}
          {score && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                width: 340,
                background: scorePanelBg,
                borderLeft: `3px solid ${scoreColor}40`,
                position: 'relative',
              }}
            >
              {/* Panel glow */}
              <div
                style={{
                  position: 'absolute',
                  top: 100,
                  left: 30,
                  width: 280,
                  height: 280,
                  display: 'flex',
                  borderRadius: 140,
                  background: scoreColor,
                  opacity: 0.15,
                }}
              />
              {/* Score circle */}
              <div
                style={{
                  width: 200,
                  height: 200,
                  borderRadius: 100,
                  border: `5px solid ${scoreColor}`,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: `${scoreColor}15`,
                  position: 'relative',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    fontSize: 88,
                    fontWeight: 900,
                    color: scoreColor,
                    lineHeight: 1,
                  }}
                >
                  {score}
                </div>
                <div
                  style={{
                    display: 'flex',
                    fontSize: 22,
                    fontWeight: 700,
                    color: `${scoreColor}CC`,
                    marginTop: 2,
                  }}
                >
                  /10
                </div>
              </div>
              {/* Score label */}
              <div
                style={{
                  display: 'flex',
                  fontSize: 18,
                  fontWeight: 900,
                  color: scoreColor,
                  letterSpacing: 4,
                  marginTop: 20,
                  position: 'relative',
                }}
              >
                {scoreLabel}
              </div>
            </div>
          )}
        </div>
      </div>
    ),
    { ...size }
  );
}
