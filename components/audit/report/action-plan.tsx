import {
  type ActionItem,
  type AuditAnalysis,
  type Issue,
  OWNER_LABELS,
} from '@/schemas/audit';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';

const EFFORT_LABEL = { low: 'Low effort', medium: 'Medium effort', high: 'High effort' };

const PHASES = [
  { key: 'immediate', title: 'Do now', detail: 'This week' },
  { key: 'next30Days', title: 'Next 30 days', detail: 'This month' },
  { key: 'next90Days', title: 'Next 90 days', detail: 'This quarter' },
] as const;

export function ActionPlan({ analysis }: { analysis: AuditAnalysis }) {
  const issuesById = new Map(analysis.issues.map((issue) => [issue.id, issue]));

  return (
    <div className="grid gap-5 lg:grid-cols-3">
      {PHASES.map((phase) => {
        const items = analysis.actionPlan[phase.key];
        return (
          <section key={phase.key} aria-labelledby={`plan-${phase.key}`}>
            <div className="border-line flex items-baseline justify-between border-b pb-2.5">
              <h3 id={`plan-${phase.key}`} className="text-[15px] font-semibold">
                {phase.title}
              </h3>
              <span className="text-ink-faint text-xs">{phase.detail}</span>
            </div>
            <ol className="mt-3 space-y-2.5">
              {items.map((item) => (
                <li key={item.id}>
                  <ActionCard item={item} issuesById={issuesById} />
                </li>
              ))}
            </ol>
          </section>
        );
      })}
    </div>
  );
}

function ActionCard({
  item,
  issuesById,
}: {
  item: ActionItem;
  issuesById: Map<string, Issue>;
}) {
  const linked = item.issueIds
    .map((id) => issuesById.get(id))
    .filter((issue): issue is Issue => issue !== undefined);

  return (
    <Card className="p-4">
      <h4 className="text-[15px] font-medium">{item.title}</h4>
      <p className="text-ink-muted mt-1.5 text-sm leading-relaxed">{item.description}</p>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <Badge tone="neutral" size="sm">
          {OWNER_LABELS[item.owner]}
        </Badge>
        <Badge tone="neutral" size="sm">
          {EFFORT_LABEL[item.effort]}
        </Badge>
      </div>

      {/*
        Issues are named rather than numbered. An index would be meaningless
        here — "#1" on one card and "#1" on another would point at different
        issues, and the numbers would not match the issue list's own ordering,
        which is sorted independently for display.

        An action can legitimately reference no issue: general improvements.
      */}
      {linked.length > 0 ? (
        <p className="text-ink-faint mt-2.5 text-xs leading-relaxed">
          Addresses{' '}
          {linked.map((issue, index) => (
            <span key={issue.id}>
              {index > 0 ? (index === linked.length - 1 ? ' and ' : ', ') : ''}
              <a
                href={`#issue-${issue.id}`}
                className="text-brand underline-offset-2 hover:underline"
              >
                {issue.title}
              </a>
            </span>
          ))}
        </p>
      ) : null}
    </Card>
  );
}
