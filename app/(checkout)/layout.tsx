import { CompactHeader } from '@/components/layout/compact-header';

export default function CheckoutLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <CompactHeader />
      <main id="main" className="flex-1">
        {children}
      </main>
    </div>
  );
}
