import { ImageResponse } from 'next/og';
import { getAuditStore } from '@/lib/storage';
import { ratingForScore, RATING_LABELS } from '@/schemas/audit';

/**
 * Per-audit share card.
 *
 * A shared report link that unfurls with the domain and its actual score looks
 * like a product; a generic logo card looks like a link someone regrets sending.
 * Cheap to generate and the main reason a report gets forwarded.
 */
export const alt = 'SEO audit report';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

/** Kept in step with the score dial's palette, in plain sRGB for Satori. */
const SCORE_COLOURS = {
  excellent: '#2e7d5b',
  good: '#3d7d3a',
  needsImprovement: '#9a6b12',
  poor: '#b0453c',
} as const;

export default async function AuditOpenGraphImage({
  params,
}: {
  params: Promise<{ publicId: string }>;
}) {
  const { publicId } = await params;

  let domain = 'your website';
  let score: number | null = null;

  try {
    const store = await getAuditStore();
    const record = await store.getByPublicId(publicId);
    if (record) {
      domain = record.domain;
      score = record.report?.overallScore ?? null;
    }
  } catch {
    // A share card is never worth failing a page over.
  }

  const rating = score === null ? null : ratingForScore(score);
  const colour = rating ? SCORE_COLOURS[rating] : '#52525b';

  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        background: '#ffffff',
        padding: '72px 80px',
        fontFamily: 'sans-serif',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        <div
          style={{
            width: 38,
            height: 38,
            borderRadius: 10,
            background: '#3538cd',
            display: 'flex',
          }}
        />
        <span style={{ fontSize: 26, fontWeight: 600, color: '#18181b' }}>AISEO</span>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', maxWidth: 700 }}>
          <span style={{ fontSize: 26, color: '#52525b' }}>SEO audit</span>
          <span
            style={{
              fontSize: 60,
              fontWeight: 600,
              color: '#18181b',
              letterSpacing: '-0.03em',
              marginTop: 10,
              lineHeight: 1.1,
            }}
          >
            {domain}
          </span>
        </div>

        {score !== null ? (
          <div
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}
          >
            <span
              style={{ fontSize: 116, fontWeight: 600, color: colour, lineHeight: 1 }}
            >
              {score}
            </span>
            <span style={{ fontSize: 24, color: '#52525b', marginTop: 6 }}>
              {rating ? RATING_LABELS[rating] : ''} · out of 100
            </span>
          </div>
        ) : null}
      </div>
    </div>,
    size,
  );
}
