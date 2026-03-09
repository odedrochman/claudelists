import { ImageResponse } from 'next/og';
import { createServiceClient } from '../../../lib/supabase';

export const runtime = 'edge';
export const alt = 'ClaudeLists Digest';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const TYPE_CONFIG = {
  daily: { label: 'DAILY DIGEST', accent: '#E8926E', panelBg: '#2A1810' },
  weekly: { label: 'WEEKLY ROUNDUP', accent: '#A78BFA', panelBg: '#1A1430' },
  monthly: { label: 'MONTHLY RECAP', accent: '#34D399', panelBg: '#0F1F1A' },
  quick: { label: 'QUICK UPDATE', accent: '#F97316', panelBg: '#2A1A08' },
};

export default async function OGImage({ params }) {
  const { slug } = await params;
  const supabase = createServiceClient();
  const { data: article } = await supabase
    .from('articles')
    .select('title, article_type, og_title, published_at, og_background_url, article_resources ( resource_id )')
    .eq('slug', slug)
    .single();

  if (!article) {
    return new ImageResponse(
      (
        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#111014', fontFamily: 'system-ui' }}>
          <div style={{ fontSize: 32, color: '#555' }}>Article not found</div>
        </div>
      ),
      { ...size }
    );
  }

  const config = TYPE_CONFIG[article.article_type] || TYPE_CONFIG.daily;
  const resourceCount = (article.article_resources || []).length;
  const title = article.og_title || article.title || 'Untitled';
  let displayTitle = title;
  if (title.length > 65) {
    const truncated = title.slice(0, 62);
    const lastSpace = truncated.lastIndexOf(' ');
    displayTitle = (lastSpace > 40 ? truncated.slice(0, lastSpace) : truncated) + '...';
  }
  const showBigNumber = resourceCount > 1;

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
        {article.og_background_url ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={article.og_background_url}
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
            background: config.accent,
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
              padding: showBigNumber ? '52px 40px 72px 56px' : '52px 56px 72px 56px',
              flex: 1,
              justifyContent: 'space-between',
            }}
          >
            {/* Type badge - bolder */}
            <div
              style={{
                display: 'flex',
                alignSelf: 'flex-start',
                padding: '12px 24px',
                borderRadius: 8,
                background: `${config.accent}30`,
                border: `2.5px solid ${config.accent}`,
                color: config.accent,
                fontSize: 18,
                fontWeight: 900,
                letterSpacing: 3,
              }}
            >
              {config.label}
            </div>

            {/* Title - bigger and bolder */}
            <div
              style={{
                display: 'flex',
                fontSize: showBigNumber ? 48 : 56,
                fontWeight: 900,
                color: '#FFFFFF',
                lineHeight: 1.1,
                letterSpacing: -1,
              }}
            >
              {displayTitle}
            </div>

            {/* Bottom: brand */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
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

          {/* RIGHT: Bold colored panel with number */}
          {showBigNumber && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                width: 380,
                background: config.panelBg,
                borderLeft: `3px solid ${config.accent}40`,
                position: 'relative',
              }}
            >
              {/* Panel glow */}
              <div
                style={{
                  position: 'absolute',
                  top: 80,
                  left: 40,
                  width: 300,
                  height: 300,
                  display: 'flex',
                  borderRadius: 150,
                  background: config.accent,
                  opacity: 0.15,
                }}
              />
              {/* Big number */}
              <div
                style={{
                  display: 'flex',
                  fontSize: 220,
                  fontWeight: 900,
                  color: config.accent,
                  lineHeight: 1,
                  letterSpacing: -10,
                  position: 'relative',
                }}
              >
                {resourceCount}
              </div>
              {/* Label */}
              <div
                style={{
                  display: 'flex',
                  fontSize: 28,
                  fontWeight: 800,
                  color: '#F5F0EB',
                  letterSpacing: 6,
                  marginTop: 4,
                  position: 'relative',
                }}
              >
                PICKS
              </div>
              {/* Decorative dots */}
              <div style={{ display: 'flex', gap: 10, marginTop: 24, position: 'relative' }}>
                {Array.from({ length: Math.min(resourceCount, 5) }).map((_, i) => (
                  <div
                    key={i}
                    style={{
                      width: 12,
                      height: 12,
                      borderRadius: 6,
                      background: config.accent,
                      opacity: 1 - i * 0.15,
                      display: 'flex',
                    }}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    ),
    { ...size }
  );
}
