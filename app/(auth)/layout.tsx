import { CompactHeader } from '@/components/layout/compact-header';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <CompactHeader exitHref="/" exitLabel="Close and return to the homepage" />
      <main id="main" className="flex-1">
        {children}
      </main>
    </div>
  );
}
