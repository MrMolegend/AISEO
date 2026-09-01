import { SiteHeader } from '@/components/layout/site-header';
import { SiteFooter } from '@/components/layout/site-footer';

/** Shared shell for the static legal pages. Prose measure is capped for readability. */
export function LegalPage({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <SiteHeader />
      <main id="main" className="mx-auto max-w-[720px] px-5 py-16 md:px-8 md:py-24">
        <h1 className="text-3xl font-semibold md:text-4xl">{title}</h1>
        <p className="text-text-faint mt-3 text-sm">Last updated {updated}</p>
        <div className="mt-10 space-y-8">{children}</div>
      </main>
      <SiteFooter />
    </>
  );
}

export function LegalSection({
  heading,
  children,
}: {
  heading: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="text-lg font-semibold">{heading}</h2>
      <div className="text-text-muted mt-3 space-y-3 text-[15px] leading-relaxed">
        {children}
      </div>
    </section>
  );
}
