import { ImageResponse } from 'next/og';
import { createServerClient } from '../../../lib/supabase';
import { CATEGORIES } from '../../../lib/categories';

export const runtime = 'edge';
export const alt = 'ClaudeLists Resource';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

function getScoreColor(score) {
  if (score >= 8) return '#10B981';
  if (score >= 6) return '#3B82F6';
  if (score >= 4) return '#8C8780';
  return '#F59E0B';
}

export default async function OGImage({ params }) {
  const { id } = await params;
  const supabase = createServerClient();
  const { data: resource } = await supabase
    .from('resources')
    .select('title, summary, content_type, ai_quality_score, author_handle, categories(name, slug)')
    .eq('id', id)
    .single();

  if (!resource) {
    return new ImageResponse(
      (
        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#FAF9F5', fontFamily: 'system-ui' }}>
          <div style={{ fontSize: 32, color: '#8C8780' }}>Resource not found</div>
        </div>
      ),
      { ...size }
    );
  }

  const category = CATEGORIES.find(c => c.name === resource.categories?.name);
  const score = resource.ai_quality_score;
  const title = resource.title || 'Untitled Resource';
  // Truncate long titles
  const displayTitle = title.length > 80 ? title.slice(0, 77) + '...' : title;
  const summary = resource.summary || '';
  const displaySummary = summary.length > 150 ? summary.slice(0, 147) + '...' : summary;

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          background: '#FAF9F5',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          padding: 60,
        }}
      >
        {/* Accent bar top */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 6, background: '#C15F3C' }} />

        {/* Top row: category + score */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          {category && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 16px',
                borderRadius: 999,
                background: category.color + '20',
                color: category.color,
                fontSize: 18,
                fontWeight: 600,
              }}
            >
              {`${category.icon} ${category.name}`}
            </div>
          )}
          {score && (
            <div
              style={{
                display: 'flex',
                padding: '6px 14px',
                borderRadius: 8,
                border: `2px solid ${getScoreColor(score)}`,
                color: getScoreColor(score),
                fontSize: 18,
                fontWeight: 700,
              }}
            >
              {`${score}/10`}
            </div>
          )}
        </div>

        {/* Title */}
        <div
          style={{
            fontSize: 48,
            fontWeight: 700,
            color: '#1A1915',
            lineHeight: 1.2,
            marginBottom: 16,
            maxWidth: 1000,
          }}
        >
          {displayTitle}
        </div>

        {/* Summary */}
        {displaySummary && (
          <div
            style={{
              fontSize: 22,
              color: '#8C8780',
              lineHeight: 1.5,
              maxWidth: 900,
            }}
          >
            {displaySummary}
          </div>
        )}

        {/* Bottom: author + branding */}
        <div
          style={{
            marginTop: 'auto',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
            width: '100%',
          }}
        >
          {resource.author_handle && (
            <div style={{ display: 'flex', fontSize: 20, color: '#8C8780' }}>
              {`@${resource.author_handle}`}
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
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
      </div>
    ),
    { ...size }
  );
}
