import { ImageResponse } from 'next/og';

export const size = { width: 32, height: 32 };
export const contentType = 'image/png';

/** The favicon: the Tutor Hub mark, drawn with the same shapes as the SVG. */
export default function Icon() {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#14213a',
        borderRadius: 9,
        position: 'relative',
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: 7,
          top: 6,
          width: 4,
          height: 20,
          borderRadius: 2,
          background: '#ffffff',
        }}
      />
      <div
        style={{
          position: 'absolute',
          right: 7,
          top: 6,
          width: 4,
          height: 20,
          borderRadius: 2,
          background: '#ffffff',
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: 8,
          top: 15,
          width: 16,
          height: 4,
          borderRadius: 2,
          background: '#a5ddc9',
          transform: 'rotate(-9deg)',
        }}
      />
    </div>,
    size,
  );
}
