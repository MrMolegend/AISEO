import Link from 'next/link';
import { SiteHeader } from '@/components/marketing/site-header';
import { SiteFooter } from '@/components/marketing/site-footer';
import { Button } from '@/components/ui/button';

export default function AuditNotFound() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto flex min-h-[60vh] max-w-[520px] flex-col justify-center px-5 py-16 text-center">
        <p className="text-ink-faint font-mono text-sm">404</p>
        <h1 className="mt-4 text-2xl font-semibold md:text-3xl">
          We could not find that audit
        </h1>
        <p className="text-ink-muted mt-3 text-[17px] leading-relaxed">
          The link may be mistyped, or the audit may have been removed. Running a fresh
          one takes about a minute.
        </p>
        <div className="mt-8 flex justify-center">
          <Link href="/">
            <Button size="lg">Run an audit</Button>
          </Link>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
