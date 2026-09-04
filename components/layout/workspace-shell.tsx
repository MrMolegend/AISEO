import { SiteHeader } from '@/components/layout/site-header';
import { SiteFooter } from '@/components/layout/site-footer';
import { Meta } from '@/components/ui/panel';

/**
 * The workspace page frame: header, titled main region, footer.
 *
 * Every signed-in surface shares this skeleton so the title block, spacing
 * and landmark structure stay identical across the product — one `main`,
 * one `h1`, the kicker above it.
 */
export function WorkspaceShell({
  kicker,
  title,
  intro,
  actions,
  children,
}: {
  kicker: string;
  title: string;
  intro?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />

      <main className="mx-auto w-full max-w-[var(--container-page)] flex-1 px-5 pt-10 pb-16 md:px-8">
        <header className="flex flex-wrap items-end justify-between gap-6">
          <div className="max-w-2xl">
            <Meta>{kicker}</Meta>
            <h1 className="font-display text-text mt-2 text-3xl font-medium tracking-tight md:text-4xl">
              {title}
            </h1>
            {intro && (
              <p className="text-text-muted mt-3 text-[15px] leading-relaxed">{intro}</p>
            )}
          </div>
          {actions && <div className="flex flex-wrap gap-3">{actions}</div>}
        </header>

        {children}
      </main>

      <SiteFooter />
    </div>
  );
}
