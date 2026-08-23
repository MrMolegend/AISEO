import { ArrowRight, CircleCheck, TriangleAlert } from 'lucide-react';
import type { AuditAnalysis } from '@/schemas/audit';
import { Card } from '@/components/ui/card';

/**
 * Written for someone who does not do SEO for a living. Three panels — what is
 * working, what is hurting, what to do first — because that is the order a
 * business owner actually reads in.
 */
export function ExecutiveSummary({ analysis }: { analysis: AuditAnalysis }) {
  const { executiveSummary, website } = analysis;

  return (
    <div className="space-y-8">
      <div>
        <p className="text-ink measure text-[17px] leading-relaxed">
          {executiveSummary.summary}
        </p>
        <p className="text-ink-subtle measure mt-4 text-sm leading-relaxed">
          <span className="text-ink-muted font-medium">
            What this site appears to do:
          </span>{' '}
          {website.description}
          {website.targetAudience ? (
            <>
              {' '}
              <span className="text-ink-muted font-medium">Aimed at:</span>{' '}
              {website.targetAudience}
            </>
          ) : null}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-5">
          <div className="flex items-center gap-2">
            <CircleCheck className="size-4 text-[var(--color-score-good)]" aria-hidden />
            <h3 className="text-sm font-semibold">Biggest strength</h3>
          </div>
          <p className="text-ink-muted mt-2.5 text-[15px] leading-relaxed">
            {executiveSummary.biggestStrength}
          </p>
        </Card>

        <Card className="p-5">
          <div className="flex items-center gap-2">
            <TriangleAlert
              className="size-4 text-[var(--color-severity-high)]"
              aria-hidden
            />
            <h3 className="text-sm font-semibold">Biggest weakness</h3>
          </div>
          <p className="text-ink-muted mt-2.5 text-[15px] leading-relaxed">
            {executiveSummary.biggestWeakness}
          </p>
        </Card>
      </div>

      <div className="border-brand-line bg-brand-subtle rounded-[var(--radius-card)] border p-5 md:p-6">
        <div className="flex items-center gap-2">
          <ArrowRight className="text-brand size-4" aria-hidden />
          <h3 className="text-brand-hover text-sm font-semibold">Do this first</h3>
        </div>
        <p className="text-ink mt-2.5 text-[15px] leading-relaxed">
          {executiveSummary.firstThingToDo}
        </p>
      </div>
    </div>
  );
}
