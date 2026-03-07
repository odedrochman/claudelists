import { ImageResponse } from 'next/og';
import { CATEGORIES } from '../../../lib/categories';

export const runtime = 'edge';
export const alt = 'ClaudeLists Category';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function OGImage({ params }) {
  const { slug } = await params;
  const category = CATEGORIES.find(c => c.slug === slug);

  if (!category) {
    return new ImageResponse(
      (
        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#FAF9F5', fontFamily: 'system-ui' }}>
          <div style={{ fontSize: 32, color: '#8C8780' }}>Category not found</div>
        </div>
      ),
      { ...size }
    );
  }

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
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 6, background: category.color }} />

        {/* Category icon */}
        <div style={{ fontSize: 72, marginBottom: 20 }}>{category.icon}</div>

        {/* Category name */}
        <div
          style={{
            fontSize: 52,
            fontWeight: 700,
            color: '#1A1915',
            marginBottom: 16,
          }}
        >
          {category.name}
        </div>

        {/* Description */}
        <div
          style={{
            fontSize: 24,
            color: '#8C8780',
            textAlign: 'center',
            maxWidth: 700,
          }}
        >
          {`Browse ${category.name.toLowerCase()} resources in the Claude ecosystem`}
        </div>

        {/* Bottom branding */}
        <div
          style={{
            position: 'absolute',
            bottom: 28,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 9,
              background: '#C15F3C',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#FAF9F5',
              fontSize: 18,
              fontWeight: 700,
            }}
          >
            CL
          </div>
          <div style={{ fontSize: 20, fontWeight: 600, color: '#C15F3C' }}>
            claudelists.com
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
