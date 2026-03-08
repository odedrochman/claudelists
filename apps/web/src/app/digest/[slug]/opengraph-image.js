import { ImageResponse } from 'next/og';
import { createServerClient } from '../../../lib/supabase';

export const runtime = 'edge';
export const alt = 'ClaudeLists Digest';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const TYPE_CONFIG = {
  daily: { label: 'DAILY DIGEST', emoji: '\u26A1', pillBg: '#FEF3C7', pillColor: '#92400E' },
  weekly: { label: 'WEEKLY DIGEST', emoji: '\uD83D\uDCCA', pillBg: '#EDE9FE', pillColor: '#6D28D9' },
  monthly: { label: 'MONTHLY DIGEST', emoji: '\uD83C\uDFC6', pillBg: '#D1FAE5', pillColor: '#065F46' },
};

export default async function OGImage({ params }) {
  const { slug } = await params;
  const supabase = createServerClient();
  const { data: article } = await supabase
    .from('articles')
    .select('title, article_type, og_title, published_at, article_resources ( resource_id )')
    .eq('slug', slug)
    .single();

  if (!article) {
    return new ImageResponse(
      (
        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#1A1915', fontFamily: 'system-ui' }}>
          <div style={{ fontSize: 32, color: '#8C8780' }}>Article not found</div>
        </div>
      ),
      { ...size }
    );
  }

  const config = TYPE_CONFIG[article.article_type] || TYPE_CONFIG.daily;
  const resourceCount = (article.article_resources || []).length;
  const title = article.og_title || article.title || 'Untitled';
  const displayTitle = title.length > 75 ? title.slice(0, 72) + '...' : title;
  const date = article.published_at
    ? new Date(article.published_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : '';

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          background: 'linear-gradient(145deg, #2C1810 0%, #1A1008 40%, #1A1510 100%)',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Large decorative terracotta blob top-right */}
        <div
          style={{
            position: 'absolute',
            top: -100,
            right: -60,
            width: 400,
            height: 400,
            borderRadius: '50%',
            background: 'radial-gradient(circle, #C15F3C 0%, transparent 70%)',
            opacity: 0.2,
          }}
        />

        {/* Warm glow bottom-left */}
        <div
          style={{
            position: 'absolute',
            bottom: -120,
            left: -80,
            width: 350,
            height: 350,
            borderRadius: '50%',
            background: 'radial-gradient(circle, #D97757 0%, transparent 70%)',
            opacity: 0.12,
          }}
        />

        {/* Small accent dots */}
        <div style={{ position: 'absolute', top: 80, right: 100, width: 8, height: 8, borderRadius: '50%', background: '#C15F3C', opacity: 0.6 }} />
        <div style={{ position: 'absolute', top: 140, right: 160, width: 6, height: 6, borderRadius: '50%', background: '#D97757', opacity: 0.4 }} />
        <div style={{ position: 'absolute', top: 200, right: 80, width: 10, height: 10, borderRadius: '50%', background: '#C15F3C', opacity: 0.3 }} />
        <div style={{ position: 'absolute', bottom: 180, right: 200, width: 7, height: 7, borderRadius: '50%', background: '#E8926E', opacity: 0.35 }} />

        {/* Top accent stripe */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: 'linear-gradient(90deg, #C15F3C, #D97757, #E8926E)' }} />

        {/* Content container */}
        <div style={{ display: 'flex', flexDirection: 'column', padding: '52px 64px', flex: 1 }}>

          {/* Top row: CL logo + badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 40 }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 11,
                background: '#C15F3C',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#FFFFFF',
                fontSize: 20,
                fontWeight: 800,
              }}
            >
              CL
            </div>
            <div style={{ display: 'flex', fontSize: 20, fontWeight: 600, color: '#D97757' }}>
              ClaudeLists
            </div>
            <div style={{ display: 'flex', marginLeft: 'auto' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 18px',
                  borderRadius: 8,
                  background: config.pillBg,
                  color: config.pillColor,
                  fontSize: 15,
                  fontWeight: 700,
                  letterSpacing: 1.5,
                }}
              >
                {config.emoji} {config.label}
              </div>
            </div>
          </div>

          {/* Title - big and bold */}
          <div
            style={{
              fontSize: 52,
              fontWeight: 800,
              color: '#FAF9F5',
              lineHeight: 1.12,
              marginBottom: 28,
              maxWidth: 920,
              letterSpacing: -1.5,
            }}
          >
            {displayTitle}
          </div>

          {/* Subtitle info row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            {resourceCount > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {/* Resource count pills */}
                {Array.from({ length: Math.min(resourceCount, 5) }).map((_, i) => (
                  <div
                    key={i}
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 8,
                      background: `rgba(193, 95, 60, ${0.6 - i * 0.08})`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#FAF9F5',
                      fontSize: 14,
                      fontWeight: 700,
                    }}
                  >
                    {i + 1}
                  </div>
                ))}
                <div style={{ display: 'flex', fontSize: 18, color: '#B8A99A', fontWeight: 500, marginLeft: 4 }}>
                  curated picks
                </div>
              </div>
            )}
          </div>

          {/* Bottom bar */}
          <div
            style={{
              marginTop: 'auto',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              width: '100%',
              borderTop: '1px solid rgba(193, 95, 60, 0.2)',
              paddingTop: 20,
            }}
          >
            <div style={{ display: 'flex', fontSize: 17, color: '#8C7B6B' }}>
              {date}
            </div>
            <div style={{ display: 'flex', fontSize: 17, color: '#8C7B6B' }}>
              claudelists.com
            </div>
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
