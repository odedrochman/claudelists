import { ImageResponse } from 'next/og';

export const runtime = 'edge';

const TYPE_CONFIG = {
  daily: { label: 'DAILY DIGEST', accent: '#E8926E', accentDark: '#B56A45' },
  weekly: { label: 'WEEKLY ROUNDUP', accent: '#A78BFA', accentDark: '#7C5FC7' },
  monthly: { label: 'MONTHLY RECAP', accent: '#34D399', accentDark: '#1F9E6E' },
  quick: { label: 'QUICK UPDATE', accent: '#F97316', accentDark: '#C25A0E' },
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

// Shared top bar: type badge + brand logo
function TopBar({ config }) {
  return (
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
}

// Background layer (AI image or gradient fallback)
function Background({ bgUrl, config }) {
  if (bgUrl) {
    return (
      <>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={bgUrl}
          alt=""
          width={1200}
          height={630}
          style={{ position: 'absolute', top: 0, left: 0, width: 1200, height: 630, objectFit: 'cover' }}
        />
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', background: 'rgba(15, 13, 19, 0.55)' }} />
      </>
    );
  }

  return (
    <>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', background: 'linear-gradient(135deg, #0F0D13 0%, #1A1520 40%, #12101A 100%)' }} />
      <div style={{ position: 'absolute', top: -120, left: -80, width: 500, height: 500, display: 'flex', borderRadius: 250, background: `radial-gradient(circle, ${config.accent}30 0%, transparent 70%)` }} />
      <div style={{ position: 'absolute', top: 100, right: -60, width: 400, height: 400, display: 'flex', borderRadius: 200, background: `radial-gradient(circle, ${config.accent}22 0%, transparent 60%)` }} />
      <div style={{ position: 'absolute', top: 0, left: 0, width: 1200, height: 3, display: 'flex', background: `linear-gradient(90deg, ${config.accent} 0%, transparent 60%)` }} />
      <div style={{ position: 'absolute', top: 0, left: 0, width: 5, height: '100%', display: 'flex', background: `linear-gradient(180deg, ${config.accent} 0%, ${config.accent}40 50%, transparent 100%)` }} />
    </>
  );
}

// Quote-centric layout (when og_quote exists)
function QuoteLayout({ quote, title, count, config }) {
  const quoteSize = getQuoteSize(quote);
  const displayQuote = truncate(quote, 80, 50);
  const displayTitle = truncate(title, 70);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        padding: '48px 56px 90px 56px',
        width: '100%',
        height: '100%',
        justifyContent: 'space-between',
        position: 'relative',
      }}
    >
      <TopBar config={config} />

      {/* Quote hero */}
      <div style={{ display: 'flex', flexDirection: 'column', position: 'relative', maxWidth: 1000 }}>
        {/* Decorative opening quote mark */}
        <div
          style={{
            position: 'absolute',
            top: -50,
            left: -16,
            fontSize: 160,
            fontWeight: 900,
            color: `${config.accent}30`,
            lineHeight: 1,
            display: 'flex',
          }}
        >
          &ldquo;
        </div>
        {/* Quote text */}
        <div
          style={{
            display: 'flex',
            fontSize: quoteSize,
            fontWeight: 900,
            color: '#FFFFFF',
            lineHeight: 1.2,
            letterSpacing: -1,
            position: 'relative',
          }}
        >
          {displayQuote}
        </div>
      </div>

      {/* Bottom: title (secondary) + resource count */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 32, height: 4, borderRadius: 2, background: config.accent, display: 'flex' }} />
          <div style={{ display: 'flex', fontSize: 20, fontWeight: 600, color: '#B0A698', lineHeight: 1.3 }}>
            {displayTitle}
          </div>
        </div>
        {count > 0 && (
          <div style={{ display: 'flex', fontSize: 14, fontWeight: 700, color: `${config.accent}CC`, letterSpacing: 1, paddingLeft: 44 }}>
            {count} {count === 1 ? 'RESOURCE' : 'RESOURCES'} FEATURED
          </div>
        )}
      </div>
    </div>
  );
}

// Title-centric layout (fallback when no quote)
function TitleLayout({ title, count, config }) {
  const showBigNumber = count > 1;
  const displayTitle = truncate(title, 65);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'row',
        width: '100%',
        height: '100%',
        position: 'relative',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          padding: showBigNumber ? '48px 40px 90px 48px' : '48px 56px 90px 48px',
          flex: 1,
          justifyContent: 'space-between',
        }}
      >
        <TopBar config={config} />

        <div
          style={{
            display: 'flex',
            fontSize: showBigNumber ? 46 : 52,
            fontWeight: 900,
            color: '#FFFFFF',
            lineHeight: 1.15,
            letterSpacing: -0.5,
            maxWidth: showBigNumber ? '100%' : 900,
          }}
        >
          {displayTitle}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ width: 48, height: 4, borderRadius: 2, background: config.accent, display: 'flex' }} />
          {count > 0 && (
            <div style={{ display: 'flex', fontSize: 16, fontWeight: 700, color: `${config.accent}CC`, letterSpacing: 1 }}>
              {count} {count === 1 ? 'RESOURCE' : 'RESOURCES'} FEATURED
            </div>
          )}
        </div>
      </div>

      {showBigNumber && (
        <div
          style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            width: 340, background: `linear-gradient(180deg, ${config.accent}15 0%, ${config.accent}08 100%)`,
            borderLeft: `2px solid ${config.accent}30`, position: 'relative',
          }}
        >
          <div style={{ position: 'absolute', top: 100, left: 30, width: 280, height: 280, display: 'flex', borderRadius: 140, background: config.accent, opacity: 0.1 }} />
          <div style={{ display: 'flex', fontSize: 200, fontWeight: 900, color: config.accent, lineHeight: 1, letterSpacing: -8, position: 'relative' }}>
            {count}
          </div>
          <div style={{ display: 'flex', fontSize: 24, fontWeight: 800, color: '#F5F0EB', letterSpacing: 6, marginTop: 4, position: 'relative' }}>
            PICKS
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 20, position: 'relative' }}>
            {Array.from({ length: Math.min(count, 5) }).map((_, i) => (
              <div key={i} style={{ width: 10, height: 10, borderRadius: 5, background: config.accent, opacity: 1 - i * 0.15, display: 'flex' }} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const title = searchParams.get('title') || 'ClaudeLists Digest';
  const type = searchParams.get('type') || 'daily';
  const count = parseInt(searchParams.get('count') || '0', 10);
  const bgUrl = searchParams.get('bg') || '';
  const quote = searchParams.get('quote') || '';

  const config = TYPE_CONFIG[type] || TYPE_CONFIG.daily;
  const hasQuote = quote.length > 0;

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
        <Background bgUrl={bgUrl} config={config} />

        {hasQuote ? (
          <QuoteLayout quote={quote} title={title} count={count} config={config} />
        ) : (
          <TitleLayout title={title} count={count} config={config} />
        )}
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
