import { CATEGORY_LABELS, CATEGORY_ORDER, type AuditAnalysis } from '@/schemas/audit';
import { ratingPresentation } from '@/lib/scoring';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const BASIS_NOTE: Record<string, string> = {
  heuristic: 'Estimated from page signals rather than measured directly.',
  inferred: 'Judged from page structure rather than observed behaviour.',
};

/**
 * Six category cards.
 *
 * The `basis` chip is not decoration. In V1 we have no PageSpeed or field data,
 * so Performance and Mobile are heuristic — and a product whose whole pitch is
 * honesty has to say so at the point the number is read, not only in a footnote.
 */
export function CategoryScoreGrid({ analysis }: { analysis: AuditAnalysis }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {CATEGORY_ORDER.map((category) => {
        const entry = analysis.categoryScores[category];
        const { color, label } = ratingPresentation(entry.score);
        const note = BASIS_NOTE[entry.basis];

        return (
          <Card key={category} className="flex flex-col p-5">
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="text-[15px] font-medium">{CATEGORY_LABELS[category]}</h3>
              <span className="tabular text-2xl font-semibold" style={{ color }}>
                {entry.score}
              </span>
            </div>

            <div
              className="bg-surface-sunken mt-3 h-1.5 overflow-hidden rounded-full"
              role="img"
              aria-label={`${CATEGORY_LABELS[category]}: ${entry.score} out of 100, ${label}`}
            >
              <div
                className="h-full rounded-full transition-[width] duration-[var(--duration-slow)] ease-[var(--ease-out-soft)]"
                style={{ width: `${entry.score}%`, backgroundColor: color }}
              />
            </div>

            <div className="mt-3 flex items-center gap-2">
              <span className="text-ink-faint text-xs font-medium">{label}</span>
              {note ? (
                <Badge tone="neutral" size="sm" title={note}>
                  {entry.basis === 'heuristic' ? 'Estimated' : 'Inferred'}
                </Badge>
              ) : null}
            </div>

            <p className="text-ink-muted mt-3 text-sm leading-relaxed">{entry.summary}</p>
          </Card>
        );
      })}
    </div>
  );
}
