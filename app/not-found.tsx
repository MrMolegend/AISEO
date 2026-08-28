import Link from 'next/link';
import { SiteHeader } from '@/components/layout/site-header';
import { SiteFooter } from '@/components/layout/site-footer';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main
        id="main"
        className="mx-auto flex max-w-lg flex-col items-center px-5 py-28 text-center md:py-36"
      >
        <p className="text-text-faint font-mono text-sm">404</p>
        <h1 className="mt-4 text-3xl font-semibold md:text-4xl">
          We could not find that page
        </h1>
        <p className="text-text-muted mt-4 text-[17px] leading-relaxed">
          The link may be wrong, or the page may have moved. If you were looking for a
          research report, check the link you were sent — report links are long and easy
          to truncate.
        </p>
        <Link href="/dashboard" className="mt-8">
          <Button size="lg">Go to your dashboard</Button>
        </Link>
      </main>
      <SiteFooter />
    </>
  );
}
