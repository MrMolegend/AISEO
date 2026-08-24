import { ImageResponse } from 'next/og';
import { BRAND } from '@/config/brand';

export const size = { width: 32, height: 32 };
export const contentType = 'image/png';

/**
 * Favicon — the monogram from config/brand.ts on the brand square.
 *
 * Generated rather than checked in as a PNG so that renaming the product does
 * not leave a stale asset behind that nobody remembers to replace.
 */
export default function Icon() {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#3538cd',
        borderRadius: 7,
        color: '#fff',
        fontSize: 15,
        fontWeight: 600,
        letterSpacing: '-0.02em',
      }}
    >
      {BRAND.monogram}
    </div>,
    size,
  );
}
