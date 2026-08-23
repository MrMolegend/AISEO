import { UrlAuditForm } from './url-audit-form';

export function FinalCta() {
  return (
    <section className="mx-auto max-w-[1240px] px-5 py-20 md:px-8 md:py-28">
      <div className="border-line bg-surface-subtle rounded-[var(--radius-panel)] border px-6 py-14 text-center md:px-16 md:py-20">
        <h2 className="text-3xl font-semibold md:text-4xl">See where your site stands</h2>
        <p className="text-ink-muted measure mx-auto mt-4 text-lg leading-relaxed">
          One address, about a minute, no account. You will get a permanent link to your
          report that you can share with whoever needs to act on it.
        </p>
        <div className="mx-auto mt-8 max-w-xl">
          <UrlAuditForm />
        </div>
      </div>
    </section>
  );
}
