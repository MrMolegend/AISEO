import { ImageResponse } from 'next/og';

export const size = { width: 32, height: 32 };
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        gap: 3,
        background: '#3538cd',
        borderRadius: 7,
        paddingBottom: 8,
      }}
    >
      <div
        style={{
          width: 4,
          height: 7,
          background: 'rgba(255,255,255,0.55)',
          borderRadius: 1.5,
        }}
      />
      <div
        style={{
          width: 4,
          height: 12,
          background: 'rgba(255,255,255,0.78)',
          borderRadius: 1.5,
        }}
      />
      <div style={{ width: 4, height: 17, background: '#fff', borderRadius: 1.5 }} />
    </div>,
    size,
  );
}
