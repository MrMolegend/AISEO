'use client';

import { useState } from 'react';
import {
  type Effort,
  type Impact,
  IMPACT_EFFORT_COORDS,
  type Issue,
  SEVERITY_LABELS,
  type Severity,
} from '@/schemas/audit';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

/**
 * Impact against effort.
 *
 * Both axes are real enum data mapped to fixed coordinates, so nothing here is
 * invented precision — an issue sits exactly where the model classified it.
 * Points sharing a cell are spread deterministically around it, so the layout is
 * identical between renders and between server and client.
 *
 * Below md the plot is replaced by four grouped lists. A 3x3 scatter at 390px is
 * unreadable, and shrinking it would be the "fake visualisation" the design
 * direction rules out.
 */

const impactRank = (impact: Impact) => IMPACT_EFFORT_COORDS.impact[impact];
const effortRank = (effort: Effort) => IMPACT_EFFORT_COORDS.effort[effort];

const QUADRANTS = [
  {
    id: 'quick-wins',
    title: 'Quick wins',
    detail: 'Strong return, little work. Start here.',
    match: (i: Issue) => impactRank(i.impact) >= 2 && effortRank(i.effort) <= 2,
  },
  {
    id: 'major-projects',
    title: 'Major projects',
    detail: 'Strong return, real work. Worth planning properly.',
    match: (i: Issue) => impactRank(i.impact) >= 2 && effortRank(i.effort) === 3,
  },
  {
    id: 'fill-ins',
    title: 'Fill-ins',
    detail: 'Smaller return, little work. Do them when convenient.',
    match: (i: Issue) => impactRank(i.impact) < 2 && effortRank(i.effort) <= 2,
  },
  {
    id: 'low-priority',
    title: 'Low priority',
    detail: 'Smaller return, real work. Revisit only if something changes.',
    match: (i: Issue) => impactRank(i.impact) < 2 && effortRank(i.effort) === 3,
  },
] as const;

/** Explicit, so a point's colour is read straight from its severity. */
const SEVERITY_COLOR: Record<Severity, string> = {
  critical: 'var(--color-severity-critical)',
  high: 'var(--color-severity-high)',
  medium: 'var(--color-severity-medium)',
  low: 'var(--color-severity-low)',
};

export function ImpactEffortMatrix({ issues }: { issues: Issue[] }) {
  const [hovered, setHovered] = useState<string | null>(null);

  return (
    <>
      <div className="hidden md:block">
        <Plot issues={issues} hovered={hovered} onHover={setHovered} />
      </div>
      <div className="md:hidden">
        <GroupedLists issues={issues} />
      </div>
    </>
  );
}

function Plot({
  issues,
  hovered,
  onHover,
}: {
  issues: Issue[];
  hovered: string | null;
  onHover: (id: string | null) => void;
}) {
  // Asymmetric margins: the left needs room for tick labels *and* the rotated
  // axis title, the bottom for tick labels and its title.
  const W = 520;
  const H = 460;
  const M = { top: 16, right: 16, bottom: 56, left: 94 };
  const plotW = W - M.left - M.right;
  const plotH = H - M.top - M.bottom;
  const cellW = plotW / 3;
  const cellH = plotH / 3;

  const cells = new Map<string, Issue[]>();
  for (const issue of issues) {
    const key = `${effortRank(issue.effort)}-${impactRank(issue.impact)}`;
    cells.set(key, [...(cells.get(key) ?? []), issue]);
  }

  const points: { issue: Issue; x: number; y: number }[] = [];
  for (const [key, group] of cells) {
    const [ex, iy] = key.split('-').map(Number) as [number, number];
    const cx = M.left + (ex - 0.5) * cellW;
    const cy = M.top + plotH - (iy - 0.5) * cellH;

    group.forEach((issue, index) => {
      if (group.length === 1) {
        points.push({ issue, x: cx, y: cy });
        return;
      }
      const angle = (index / group.length) * Math.PI * 2 - Math.PI / 2;
      const radius = Math.min(cellW * 0.28, 9 + group.length * 2.2);
      points.push({
        issue,
        x: cx + Math.cos(angle) * radius,
        y: cy + Math.sin(angle) * radius,
      });
    });
  }

  const active = points.find((p) => p.issue.id === hovered);
  const levels = ['Low', 'Medium', 'High'] as const;

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
      {/*
        role="group" rather than "img": the plot contains focusable links, and an
        image role with interactive descendants is an accessibility violation
        (axe: nested-interactive). A group exposes the label and still lets a
        screen reader reach each point as a link.
      */}
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full max-w-[520px] shrink-0 lg:w-[56%]"
        role="group"
        aria-label={`${issues.length} issues plotted by impact and effort. The same issues are listed individually in the issues section below.`}
      >
        {/* Quick-wins region: high or medium impact at low or medium effort. */}
        <rect
          x={M.left}
          y={M.top}
          width={cellW * 2}
          height={cellH * 2}
          fill="var(--color-score-good-bg)"
          opacity="0.55"
        />

        {[0, 1, 2, 3].map((i) => (
          <g key={i}>
            <line
              x1={M.left + i * cellW}
              y1={M.top}
              x2={M.left + i * cellW}
              y2={M.top + plotH}
              stroke="var(--color-line)"
            />
            <line
              x1={M.left}
              y1={M.top + i * cellH}
              x2={M.left + plotW}
              y2={M.top + i * cellH}
              stroke="var(--color-line)"
            />
          </g>
        ))}

        {/* Effort ticks and axis title */}
        {levels.map((label, i) => (
          <text
            key={label}
            x={M.left + (i + 0.5) * cellW}
            y={M.top + plotH + 20}
            textAnchor="middle"
            fill="var(--color-ink-faint)"
            fontSize="11"
          >
            {label}
          </text>
        ))}
        <text
          x={M.left + plotW / 2}
          y={H - 12}
          textAnchor="middle"
          fill="var(--color-ink-subtle)"
          fontSize="12"
          fontWeight="500"
        >
          Effort →
        </text>

        {/* Impact ticks and axis title. The title is rotated about its own
            midpoint so it sits clear of the tick labels rather than over them. */}
        {levels.map((label, i) => (
          <text
            key={label}
            x={M.left - 12}
            y={M.top + plotH - (i + 0.5) * cellH + 4}
            textAnchor="end"
            fill="var(--color-ink-faint)"
            fontSize="11"
          >
            {label}
          </text>
        ))}
        <text
          x={18}
          y={M.top + plotH / 2}
          textAnchor="middle"
          transform={`rotate(-90 18 ${M.top + plotH / 2})`}
          fill="var(--color-ink-subtle)"
          fontSize="12"
          fontWeight="500"
        >
          Impact →
        </text>

        {points.map(({ issue, x, y }) => {
          const isActive = hovered === issue.id;
          return (
            <a key={issue.id} href={`#issue-${issue.id}`} aria-label={issue.title}>
              <circle
                cx={x}
                cy={y}
                r={isActive ? 9.5 : 7}
                fill={SEVERITY_COLOR[issue.severity]}
                fillOpacity={isActive ? 1 : 0.88}
                stroke="var(--color-surface)"
                strokeWidth="2"
                className="cursor-pointer transition-all duration-[var(--duration-fast)]"
                onMouseEnter={() => onHover(issue.id)}
                onMouseLeave={() => onHover(null)}
                onFocus={() => onHover(issue.id)}
                onBlur={() => onHover(null)}
              />
            </a>
          );
        })}
      </svg>

      <div className="min-w-0 flex-1 space-y-4">
        <div
          className={cn(
            'border-line bg-surface-subtle min-h-[104px] rounded-[var(--radius-card)] border p-4',
          )}
        >
          {active ? (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[15px] font-medium">{active.issue.title}</span>
                <Badge tone="neutral" size="sm">
                  {SEVERITY_LABELS[active.issue.severity]}
                </Badge>
              </div>
              <p className="text-ink-muted mt-2 text-sm leading-relaxed">
                {active.issue.expectedImpact}
              </p>
            </>
          ) : (
            <p className="text-ink-subtle text-sm leading-relaxed">
              Hover or focus a point to see the issue. The shaded region is where the
              cheapest high-return work sits — start there.
            </p>
          )}
        </div>

        <ul className="flex flex-wrap gap-x-4 gap-y-2">
          {(['critical', 'high', 'medium', 'low'] as const)
            .filter((s) => issues.some((i) => i.severity === s))
            .map((severity) => (
              <li key={severity} className="flex items-center gap-1.5">
                <span
                  className="size-2.5 rounded-full"
                  style={{ backgroundColor: SEVERITY_COLOR[severity] }}
                  aria-hidden
                />
                <span className="text-ink-subtle text-xs">
                  {SEVERITY_LABELS[severity]}
                </span>
              </li>
            ))}
        </ul>
      </div>
    </div>
  );
}

function GroupedLists({ issues }: { issues: Issue[] }) {
  return (
    <div className="space-y-5">
      {QUADRANTS.map((quadrant) => {
        const matched = issues.filter(quadrant.match);
        if (matched.length === 0) return null;
        return (
          <div key={quadrant.id}>
            <h3 className="text-[15px] font-semibold">{quadrant.title}</h3>
            <p className="text-ink-faint mt-0.5 text-xs">{quadrant.detail}</p>
            <ul className="mt-2.5 space-y-1.5">
              {matched.map((issue) => (
                <li key={issue.id}>
                  <a
                    href={`#issue-${issue.id}`}
                    className="border-line bg-surface flex items-center gap-2 rounded-[var(--radius-control)] border px-3 py-2.5 text-sm"
                  >
                    <Badge tone="neutral" size="sm">
                      {SEVERITY_LABELS[issue.severity]}
                    </Badge>
                    <span className="min-w-0 flex-1">{issue.title}</span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
