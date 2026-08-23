'use client';

import { useMemo, useState } from 'react';
import * as Accordion from '@radix-ui/react-accordion';
import { ChevronDown } from 'lucide-react';
import {
  type Category,
  CATEGORY_LABELS,
  type Issue,
  SEVERITY_LABELS,
  SEVERITY_ORDER,
  type Severity,
} from '@/schemas/audit';
import { cn } from '@/lib/utils';
import { IssueDetail } from './issue-detail';
import { Badge } from '@/components/ui/badge';

type SeverityFilter = Severity | 'all';
type CategoryFilter = Category | 'all';

const SEVERITY_TONE: Record<Severity, 'critical' | 'high' | 'medium' | 'low'> = {
  critical: 'critical',
  high: 'high',
  medium: 'medium',
  low: 'low',
};

/**
 * Issues are sorted by severity, then by impact, then by effort ascending — so
 * within a severity band the cheapest high-impact work rises to the top. This is
 * a display concern, deliberately not something the model is asked to get right.
 */
const IMPACT_RANK = { high: 0, medium: 1, low: 2 } as const;
const EFFORT_RANK = { low: 0, medium: 1, high: 2 } as const;

function sortIssues(issues: Issue[]): Issue[] {
  return [...issues].sort((a, b) => {
    const severity =
      SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity);
    if (severity !== 0) return severity;
    const impact = IMPACT_RANK[a.impact] - IMPACT_RANK[b.impact];
    if (impact !== 0) return impact;
    return EFFORT_RANK[a.effort] - EFFORT_RANK[b.effort];
  });
}

export function IssueSection({ issues }: { issues: Issue[] }) {
  const [severity, setSeverity] = useState<SeverityFilter>('all');
  const [category, setCategory] = useState<CategoryFilter>('all');

  const sorted = useMemo(() => sortIssues(issues), [issues]);

  const severityCounts = useMemo(() => {
    const counts = { critical: 0, high: 0, medium: 0, low: 0 } as Record<
      Severity,
      number
    >;
    for (const issue of issues) counts[issue.severity] += 1;
    return counts;
  }, [issues]);

  const presentCategories = useMemo(() => {
    const set = new Set<Category>(issues.map((i) => i.category));
    return [...set];
  }, [issues]);

  const visible = useMemo(
    () =>
      sorted.filter(
        (issue) =>
          (severity === 'all' || issue.severity === severity) &&
          (category === 'all' || issue.category === category),
      ),
    [sorted, severity, category],
  );

  // First two open by default: enough to show the pattern without forcing the
  // reader to scroll past twenty expanded panels.
  const defaultOpen = sorted.slice(0, 2).map((i) => i.id);

  return (
    <div>
      {/* Filters */}
      <div className="border-line bg-canvas/90 sticky top-[7.25rem] z-30 -mx-5 space-y-2 border-b px-5 py-3 backdrop-blur-md md:-mx-8 md:px-8 xl:top-16">
        <div
          className="scroll-rail flex gap-1.5"
          role="group"
          aria-label="Filter by severity"
        >
          <FilterChip
            active={severity === 'all'}
            onClick={() => setSeverity('all')}
            label="All"
            count={issues.length}
          />
          {SEVERITY_ORDER.filter((s) => severityCounts[s] > 0).map((s) => (
            <FilterChip
              key={s}
              active={severity === s}
              onClick={() => setSeverity(severity === s ? 'all' : s)}
              label={SEVERITY_LABELS[s]}
              count={severityCounts[s]}
            />
          ))}
        </div>

        {presentCategories.length > 1 ? (
          <div
            className="scroll-rail flex gap-1.5"
            role="group"
            aria-label="Filter by category"
          >
            <FilterChip
              active={category === 'all'}
              onClick={() => setCategory('all')}
              label="All areas"
              subtle
            />
            {presentCategories.map((c) => (
              <FilterChip
                key={c}
                active={category === c}
                onClick={() => setCategory(category === c ? 'all' : c)}
                label={CATEGORY_LABELS[c]}
                subtle
              />
            ))}
          </div>
        ) : null}
      </div>

      <p aria-live="polite" className="text-ink-subtle mt-4 text-sm">
        Showing {visible.length} of {issues.length}{' '}
        {issues.length === 1 ? 'issue' : 'issues'}
      </p>

      {visible.length === 0 ? (
        <div className="border-line mt-4 rounded-[var(--radius-card)] border border-dashed p-10 text-center">
          <p className="text-ink-muted text-[15px]">
            No issues match this combination of filters.
          </p>
          <button
            type="button"
            onClick={() => {
              setSeverity('all');
              setCategory('all');
            }}
            className="text-brand mt-2 text-sm font-medium underline-offset-4 hover:underline"
          >
            Clear filters
          </button>
        </div>
      ) : (
        <Accordion.Root
          type="multiple"
          defaultValue={defaultOpen}
          className="mt-4 space-y-2.5"
        >
          {visible.map((issue) => (
            <Accordion.Item
              key={issue.id}
              value={issue.id}
              id={`issue-${issue.id}`}
              className="border-line bg-surface scroll-mt-40 overflow-hidden rounded-[var(--radius-card)] border shadow-[var(--shadow-card)]"
            >
              <Accordion.Header>
                <Accordion.Trigger className="group hover:bg-surface-subtle flex w-full items-start gap-3 p-4 text-left transition-colors md:p-5">
                  <Badge
                    tone={SEVERITY_TONE[issue.severity]}
                    size="sm"
                    className="mt-0.5"
                  >
                    {SEVERITY_LABELS[issue.severity]}
                  </Badge>

                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-medium">{issue.title}</span>
                    <span className="text-ink-faint mt-1 block text-xs">
                      {CATEGORY_LABELS[issue.category]}
                    </span>
                  </span>

                  <ChevronDown
                    className="text-ink-faint mt-0.5 size-4 shrink-0 transition-transform duration-[var(--duration-base)] group-data-[state=open]:rotate-180"
                    aria-hidden
                  />
                </Accordion.Trigger>
              </Accordion.Header>

              <Accordion.Content className="data-[state=closed]:animate-none">
                <IssueDetail issue={issue} />
              </Accordion.Content>
            </Accordion.Item>
          ))}
        </Accordion.Root>
      )}
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  label,
  count,
  subtle = false,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count?: number;
  subtle?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'shrink-0 rounded-full border px-3 py-1.5 text-[13px] font-medium whitespace-nowrap transition-colors',
        active
          ? subtle
            ? 'border-brand-line bg-brand-subtle text-brand-hover'
            : 'border-brand bg-brand text-ink-inverse'
          : 'border-line text-ink-muted hover:text-ink hover:bg-surface-sunken bg-transparent',
      )}
    >
      {label}
      {count !== undefined ? (
        <span className={cn('tabular ml-1.5', active ? 'opacity-80' : 'text-ink-faint')}>
          {count}
        </span>
      ) : null}
    </button>
  );
}
