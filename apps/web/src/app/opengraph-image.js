import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'ClaudeLists - Curated Claude & AI Resources';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          background: '#FAF9F5',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}
      >
        {/* Accent bar top */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 6, background: '#C15F3C' }} />

        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 14,
              background: '#C15F3C',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#FAF9F5',
              fontSize: 28,
              fontWeight: 700,
            }}
          >
            CL
          </div>
          <div style={{ fontSize: 40, fontWeight: 700, color: '#1A1915', display: 'flex' }}>
            <span style={{ color: '#C15F3C' }}>Claude</span>
            <span>Lists</span>
          </div>
        </div>

        {/* Tagline */}
        <div
          style={{
            fontSize: 24,
            color: '#8C8780',
            textAlign: 'center',
            maxWidth: 700,
            lineHeight: 1.4,
          }}
        >
          The community-curated directory of Claude ecosystem resources
        </div>

        {/* Categories preview */}
        <div style={{ display: 'flex', gap: 12, marginTop: 32, flexWrap: 'wrap', justifyContent: 'center', maxWidth: 800 }}>
          {['MCP Servers', 'Prompts', 'CLAUDE.md', 'Workflows', 'Tools', 'Tutorials'].map((cat) => (
            <div
              key={cat}
              style={{
                padding: '8px 20px',
                borderRadius: 999,
                border: '1.5px solid #E8E6DC',
                fontSize: 16,
                color: '#8C8780',
              }}
            >
              {cat}
            </div>
          ))}
        </div>

        {/* URL */}
        <div style={{ position: 'absolute', bottom: 28, fontSize: 18, color: '#C15F3C', fontWeight: 500 }}>
          claudelists.com
        </div>
      </div>
    ),
    { ...size }
  );
}
