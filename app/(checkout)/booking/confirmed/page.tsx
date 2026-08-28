import type { Metadata } from 'next';
import { BookingConfirmation } from '@/components/booking/confirmation';

export const metadata: Metadata = {
  title: 'Booking confirmed',
  robots: { index: false, follow: false },
};

export default async function BookingConfirmedPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const id = typeof params.id === 'string' ? params.id : null;
  return <BookingConfirmation bookingId={id} />;
}
