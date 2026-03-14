import { ImageResponse } from 'next/og';
import { createServiceClient } from '../../../lib/supabase';

export const runtime = 'edge';
export const alt = 'ClaudeLists Digest';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const TYPE_CONFIG = {
  daily: { label: 'DAILY DIGEST', accent: '#E8926E', accentDark: '#B56A45', glowColor: '#E8926E' },
  weekly: { label: 'WEEKLY ROUNDUP', accent: '#A78BFA', accentDark: '#7C5FC7', glowColor: '#A78BFA' },
  monthly: { label: 'MONTHLY RECAP', accent: '#34D399', accentDark: '#1F9E6E', glowColor: '#34D399' },
  quick: { label: 'QUICK UPDATE', accent: '#F97316', accentDark: '#C25A0E', glowColor: '#F97316' },
};

function truncate(text, max, minWord = 40) {
  if (text.length <= max) return text;
  const truncated = text.slice(0, max - 3);
  const lastSpace = truncated.lastIndexOf(' ');
  return (lastSpace > minWord ? truncated.slice(0, lastSpace) : truncated) + '...';
}

function getQuoteSize(quote) {
  if (quote.length <= 30) return 64;
  if (quote.length <= 45) return 58;
  if (quote.length <= 60) return 52;
  return 46;
}

export default async function OGImage({ params }) {
  const { slug } = await params;
  const supabase = createServiceClient();
  const { data: article } = await supabase
    .from('articles')
    .select('title, article_type, og_title, og_quote, published_at, og_background_url, article_resources ( resource_id )')
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
  const quote = article.og_quote || '';
  const hasQuote = quote.length > 0;

  // Top bar: type badge + brand (shared between layouts)
  const topBar = (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
      <div
        style={{
          display: 'flex',
          padding: '10px 22px',
          borderRadius: 8,
          background: `${config.accent}25`,
          border: `2px solid ${config.accent}`,
          color: config.accent,
          fontSize: 16,
          fontWeight: 900,
          letterSpacing: 3,
        }}
      >
        {config.label}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div
          style={{
            width: 36, height: 36, borderRadius: 8,
            background: '#C15F3C', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontSize: 15, fontWeight: 900,
          }}
        >
          CL
        </div>
        <div style={{ display: 'flex', fontSize: 18, fontWeight: 700, color: '#D97757' }}>
          claudelists.com
        </div>
      </div>
    </div>
  );

  // Background layer
  const background = article.og_background_url ? (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={article.og_background_url}
        alt=""
        width={1200}
        height={630}
        style={{ position: 'absolute', top: 0, left: 0, width: 1200, height: 630, objectFit: 'cover' }}
      />
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', background: 'rgba(15, 13, 19, 0.55)' }} />
    </>
  ) : (
    <>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', background: 'linear-gradient(135deg, #0F0D13 0%, #1A1520 40%, #12101A 100%)' }} />
      <div style={{ position: 'absolute', top: -120, left: -80, width: 500, height: 500, display: 'flex', borderRadius: 250, background: `radial-gradient(circle, ${config.accent}30 0%, transparent 70%)` }} />
      <div style={{ position: 'absolute', top: 100, right: -60, width: 400, height: 400, display: 'flex', borderRadius: 200, background: `radial-gradient(circle, ${config.accent}22 0%, transparent 60%)` }} />
      <div style={{ position: 'absolute', top: 0, left: 0, width: 1200, height: 3, display: 'flex', background: `linear-gradient(90deg, ${config.accent} 0%, transparent 60%)` }} />
      <div style={{ position: 'absolute', top: 0, left: 0, width: 5, height: '100%', display: 'flex', background: `linear-gradient(180deg, ${config.accent} 0%, ${config.accent}40 50%, transparent 100%)` }} />
      <div style={{ position: 'absolute', top: 40, right: 40, width: 160, height: 160, display: 'flex', flexWrap: 'wrap', gap: 20, opacity: 0.25 }}>
        {Array.from({ length: 36 }).map((_, i) => (
          <div key={i} style={{ width: 4, height: 4, borderRadius: 2, background: config.accent, display: 'flex' }} />
        ))}
      </div>
      <img
        src={`data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path d="M50 0 C52 40, 60 48, 100 50 C60 52, 52 60, 50 100 C48 60, 40 52, 0 50 C40 48, 48 40, 50 0Z" fill="${config.accent}" opacity="0.3"/><circle cx="50" cy="50" r="8" fill="${config.accent}" opacity="0.5"/></svg>`)}`}
        width={140} height={140} alt=""
        style={{ position: 'absolute', top: 130, right: 280, width: 140, height: 140 }}
      />
      <img
        src={`data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path d="M50 0 C52 40, 60 48, 100 50 C60 52, 52 60, 50 100 C48 60, 40 52, 0 50 C40 48, 48 40, 50 0Z" fill="${config.accent}" opacity="0.2"/><circle cx="50" cy="50" r="6" fill="${config.accent}" opacity="0.35"/></svg>`)}`}
        width={70} height={70} alt=""
        style={{ position: 'absolute', bottom: 150, right: 100, width: 70, height: 70 }}
      />
      <img
        src={`data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path d="M50 0 C52 40, 60 48, 100 50 C60 52, 52 60, 50 100 C48 60, 40 52, 0 50 C40 48, 48 40, 50 0Z" fill="${config.accent}" opacity="0.25"/><circle cx="50" cy="50" r="5" fill="${config.accent}" opacity="0.4"/></svg>`)}`}
        width={40} height={40} alt=""
        style={{ position: 'absolute', top: 65, right: 480, width: 40, height: 40 }}
      />
    </>
  );

  // Quote-centric layout
  if (hasQuote) {
    const quoteSize = getQuoteSize(quote);
    const displayQuote = truncate(quote, 80, 50);
    const displayTitle = truncate(title, 70);

    return new ImageResponse(
      (
        <div style={{ width: '100%', height: '100%', display: 'flex', fontFamily: 'system-ui, -apple-system, sans-serif', position: 'relative', overflow: 'hidden', background: '#0F0D13' }}>
          {background}

          <div style={{ display: 'flex', flexDirection: 'column', padding: '48px 56px 90px 56px', width: '100%', height: '100%', justifyContent: 'space-between', position: 'relative' }}>
            {topBar}

            {/* Quote hero */}
            <div style={{ display: 'flex', flexDirection: 'column', position: 'relative', maxWidth: 1000 }}>
              <div style={{ position: 'absolute', top: -50, left: -16, fontSize: 160, fontWeight: 900, color: `${config.accent}30`, lineHeight: 1, display: 'flex' }}>
                &ldquo;
              </div>
              <div style={{ display: 'flex', fontSize: quoteSize, fontWeight: 900, color: '#FFFFFF', lineHeight: 1.2, letterSpacing: -1, position: 'relative' }}>
                {displayQuote}
              </div>
            </div>

            {/* Bottom: title (secondary) + count */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 32, height: 4, borderRadius: 2, background: config.accent, display: 'flex' }} />
                <div style={{ display: 'flex', fontSize: 20, fontWeight: 600, color: '#B0A698', lineHeight: 1.3 }}>
                  {displayTitle}
                </div>
              </div>
              {resourceCount > 0 && (
                <div style={{ display: 'flex', fontSize: 14, fontWeight: 700, color: `${config.accent}CC`, letterSpacing: 1, paddingLeft: 44 }}>
                  {resourceCount} {resourceCount === 1 ? 'RESOURCE' : 'RESOURCES'} FEATURED
                </div>
              )}
            </div>
          </div>
        </div>
      ),
      { ...size }
    );
  }

  // Fallback: title-centric layout (existing articles without quote)
  const displayTitle = truncate(title, 65);
  const showBigNumber = resourceCount > 1;

  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', fontFamily: 'system-ui, -apple-system, sans-serif', position: 'relative', overflow: 'hidden', background: '#0F0D13' }}>
        {background}

        <div style={{ display: 'flex', flexDirection: 'row', width: '100%', height: '100%', position: 'relative' }}>
          <div style={{ display: 'flex', flexDirection: 'column', padding: showBigNumber ? '48px 40px 90px 48px' : '48px 56px 90px 48px', flex: 1, justifyContent: 'space-between' }}>
            {topBar}

            <div style={{ display: 'flex', fontSize: showBigNumber ? 46 : 52, fontWeight: 900, color: '#FFFFFF', lineHeight: 1.15, letterSpacing: -0.5, maxWidth: showBigNumber ? '100%' : 900 }}>
              {displayTitle}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ width: 48, height: 4, borderRadius: 2, background: config.accent, display: 'flex' }} />
              {resourceCount > 0 && (
                <div style={{ display: 'flex', fontSize: 16, fontWeight: 700, color: `${config.accent}CC`, letterSpacing: 1 }}>
                  {resourceCount} {resourceCount === 1 ? 'RESOURCE' : 'RESOURCES'} FEATURED
                </div>
              )}
            </div>
          </div>

          {showBigNumber && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: 340, background: `linear-gradient(180deg, ${config.accent}15 0%, ${config.accent}08 100%)`, borderLeft: `2px solid ${config.accent}30`, position: 'relative' }}>
              <div style={{ position: 'absolute', top: 100, left: 30, width: 280, height: 280, display: 'flex', borderRadius: 140, background: config.accent, opacity: 0.1 }} />
              <div style={{ display: 'flex', fontSize: 200, fontWeight: 900, color: config.accent, lineHeight: 1, letterSpacing: -8, position: 'relative' }}>{resourceCount}</div>
              <div style={{ display: 'flex', fontSize: 24, fontWeight: 800, color: '#F5F0EB', letterSpacing: 6, marginTop: 4, position: 'relative' }}>PICKS</div>
              <div style={{ display: 'flex', gap: 8, marginTop: 20, position: 'relative' }}>
                {Array.from({ length: Math.min(resourceCount, 5) }).map((_, i) => (
                  <div key={i} style={{ width: 10, height: 10, borderRadius: 5, background: config.accent, opacity: 1 - i * 0.15, display: 'flex' }} />
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
