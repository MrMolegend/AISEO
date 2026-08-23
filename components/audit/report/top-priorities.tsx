import { ArrowDown } from 'lucide-react';
import type { AuditAnalysis } from '@/schemas/audit';
import { SEVERITY_LABELS } from '@/schemas/audit';
import { Badge } from '@/components/ui/badge';

const SEVERITY_TONE = {
  critical: 'critical',
  high: 'high',
  medium: 'medium',
  low: 'low',
} as const;

/**
 * The ranked shortlist.
 *
 * Each entry resolves its issue by id rather than restating it, so the priority
 * list can never drift out of sync with the issue it points at. Clicking jumps
 * to the full issue rather than duplicating its detail here.
 */
export function TopPriorities({ analysis }: { analysis: AuditAnalysis }) {
  const byId = new Map(analysis.issues.map((issue) => [issue.id, issue]));
  const ranked = [...analysis.topPriorities].sort((a, b) => a.rank - b.rank);

  return (
    <ol className="space-y-3">
      {ranked.map((priority) => {
        const issue = byId.get(priority.issueId);
        // Cross-reference validation guarantees this resolves; skip defensively
        // rather than rendering a broken row if a legacy record ever slips through.
        if (!issue) return null;

        return (
          <li key={priority.issueId}>
            <a
              href={`#issue-${issue.id}`}
              className="border-line bg-surface hover:border-line-strong group flex gap-4 rounded-[var(--radius-card)] border p-4 shadow-[var(--shadow-card)] transition-colors md:p-5"
            >
              <span className="bg-surface-sunken text-ink-muted tabular flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold">
                {priority.rank}
              </span>

              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="text-[15px] font-medium">{issue.title}</span>
                  <Badge tone={SEVERITY_TONE[issue.severity]} size="sm">
                    {SEVERITY_LABELS[issue.severity]}
                  </Badge>
                </span>
                <span className="text-ink-muted mt-1.5 block text-sm leading-relaxed">
                  {priority.rationale}
                </span>
                <span className="text-brand mt-2 inline-flex items-center gap-1 text-xs font-medium opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                  Jump to the full issue
                  <ArrowDown className="size-3" aria-hidden />
                </span>
              </span>
            </a>
          </li>
        );
      })}
    </ol>
  );
}
