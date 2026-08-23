import type { AuditAnalysis } from '@/schemas/audit';

/**
 * What the audit could not determine.
 *
 * Deliberately the plainest section in the report. Understating this reads as
 * confidence; dressing it up would read as an apology, and burying it would make
 * the whole product dishonest — V1 audits one page without performance data, and
 * saying so is the difference between a trustworthy report and a bluff.
 */
export function LimitationsPanel({ analysis }: { analysis: AuditAnalysis }) {
  return (
    <div className="border-line bg-surface-subtle rounded-[var(--radius-card)] border p-5 md:p-6">
      <p className="text-ink-muted measure text-sm leading-relaxed">
        This audit read one page, as it was served, without running JavaScript. The
        following could not be determined from that data.
      </p>

      <dl className="mt-5 space-y-4">
        {analysis.limitations.map((limitation) => (
          <div
            key={limitation.id}
            className="border-line border-t pt-4 first:border-t-0 first:pt-0"
          >
            <dt className="text-[15px] font-medium">{limitation.area}</dt>
            <dd className="text-ink-muted mt-1 text-sm leading-relaxed">
              {limitation.detail}
              {limitation.howToResolve ? (
                <span className="text-ink-subtle block pt-1 italic">
                  {limitation.howToResolve}
                </span>
              ) : null}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
