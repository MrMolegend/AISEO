import { ImageResponse } from 'next/og';

export const alt = 'AISEO — AI-powered SEO audits for any website';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpenGraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        background: '#ffffff',
        padding: '80px',
        fontFamily: 'sans-serif',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 11,
            background: '#3538cd',
            display: 'flex',
          }}
        />
        <span style={{ fontSize: 30, fontWeight: 600, color: '#18181b' }}>AISEO</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <span
          style={{
            fontSize: 68,
            fontWeight: 600,
            color: '#18181b',
            lineHeight: 1.1,
            letterSpacing: '-0.03em',
          }}
        >
          Find out what is holding
        </span>
        <span
          style={{
            fontSize: 68,
            fontWeight: 600,
            color: '#18181b',
            lineHeight: 1.1,
            letterSpacing: '-0.03em',
          }}
        >
          your website back
        </span>
        <span style={{ fontSize: 30, color: '#52525b', marginTop: 28 }}>
          AI-powered SEO audits · Free · No account required
        </span>
      </div>
    </div>,
    size,
  );
}
