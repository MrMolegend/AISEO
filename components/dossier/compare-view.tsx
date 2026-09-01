import { Panel, Rule, Meta } from '@/components/ui/panel';
import { VERDICT_LABEL, type Verdict } from '@/config/design';
import type {
  VersionComparison,
  ListDiff,
  ClaimChange,
} from '@/lib/market-entry/compare';

/**
 * Two report versions, compared.
 *
 * Everything on this page is the output of a deterministic structural
 * comparison — see lib/market-entry/compare.ts. Nothing here is generated
 * prose; every line can be checked against the two documents it summarises,
 * and running the comparison twice produces the same page twice.
 *
 * Change is never encoded in colour alone: every delta carries its sign and
 * every list entry its verb (added / removed / changed).
 */

function verdictLabel(value: string): string {
  return value in VERDICT_LABEL ? VERDICT_LABEL[value as Verdict] : value;
}

function signed(delta: number): string {
  if (delta > 0) return `+${delta}`;
  return String(delta);
}

function DiffSection({ title, diff }: { title: string; diff: ListDiff }) {
  const total = diff.added.length + diff.removed.length + diff.changed.length;

  return (
    <section aria-label={title} className="mt-8">
      <div className="flex items-baseline justify-between gap-4">
        <h3 className="text-text text-[15px] font-medium">{title}</h3>
        <Meta>
          {total === 0
            ? `Unchanged (${diff.unchanged})`
            : `${total} ${total === 1 ? 'change' : 'changes'} · ${diff.unchanged} unchanged`}
        </Meta>
      </div>
      <Rule className="mt-2" />

      {total > 0 && (
        <ul className="mt-3 space-y-2">
          {diff.added.map((item) => (
            <li key={`added-${item.id}`} className="flex gap-3 text-[14px]">
              <span className="text-signal w-16 shrink-0 text-[12px] tracking-wide uppercase">
                Added
              </span>
              <span className="text-text">{item.title}</span>
            </li>
          ))}
          {diff.removed.map((item) => (
            <li key={`removed-${item.id}`} className="flex gap-3 text-[14px]">
              <span className="text-copper w-16 shrink-0 text-[12px] tracking-wide uppercase">
                Removed
              </span>
              <span className="text-text-muted line-through decoration-1">
                {item.title}
              </span>
            </li>
          ))}
          {diff.changed.map((item) => (
            <li key={`changed-${item.id}`} className="flex gap-3 text-[14px]">
              <span className="text-cobalt w-16 shrink-0 text-[12px] tracking-wide uppercase">
                Changed
              </span>
              <span className="text-text">
                {item.title}
                <span className="text-text-subtle"> — {item.fields.join(', ')}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Claim({ claim }: { claim: ClaimChange }) {
  return (
    <div className="mt-4">
      <Meta>{claim.label}</Meta>
      {claim.changed ? (
        <div className="mt-2 grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="border-rule border-l-2 pl-3">
            <p className="text-text-faint text-[12px] tracking-wide uppercase">Before</p>
            <p className="text-text-muted mt-1 text-[14px] leading-relaxed">
              {claim.before}
            </p>
          </div>
          <div className="border-signal border-l-2 pl-3">
            <p className="text-text-faint text-[12px] tracking-wide uppercase">After</p>
            <p className="text-text mt-1 text-[14px] leading-relaxed">{claim.after}</p>
          </div>
        </div>
      ) : (
        <p className="text-text-subtle mt-2 text-[14px] leading-relaxed">
          Unchanged: {claim.after}
        </p>
      )}
    </div>
  );
}

export function CompareView({
  comparison,
  beforeLabel,
  afterLabel,
}: {
  comparison: VersionComparison;
  beforeLabel: string;
  afterLabel: string;
}) {
  return (
    <div className="mx-auto max-w-[var(--container-content)] px-5 py-10 md:px-8">
      {/* ── The decision, before and after ─────────────────────────────── */}
      <Panel edge="signal">
        <div className="grid grid-cols-1 gap-px sm:grid-cols-3">
          <div className="p-5">
            <Meta>Verdict</Meta>
            <p className="text-text mt-2 text-[17px]" data-numeric>
              {comparison.verdict.changed ? (
                <>
                  <span className="text-text-muted">
                    {verdictLabel(comparison.verdict.before)}
                  </span>
                  <span aria-hidden="true"> → </span>
                  <span className="sr-only">changed to</span>
                  {verdictLabel(comparison.verdict.after)}
                </>
              ) : (
                <>{verdictLabel(comparison.verdict.after)} (unchanged)</>
              )}
            </p>
          </div>
          <div className="p-5">
            <Meta>Readiness</Meta>
            <p className="text-text mt-2 text-[17px]" data-numeric>
              {comparison.readiness.before} → {comparison.readiness.after}
              <span
                className={
                  comparison.readiness.delta === 0
                    ? 'text-text-faint'
                    : comparison.readiness.delta > 0
                      ? 'text-signal'
                      : 'text-copper'
                }
              >
                {' '}
                ({signed(comparison.readiness.delta)})
              </span>
            </p>
          </div>
          <div className="p-5">
            <Meta>Confidence</Meta>
            <p className="text-text mt-2 text-[17px]">
              {comparison.confidence.changed
                ? `${comparison.confidence.before} → ${comparison.confidence.after}`
                : `${comparison.confidence.after} (unchanged)`}
            </p>
          </div>
        </div>
      </Panel>

      {/* ── Readiness factors ──────────────────────────────────────────── */}
      <section aria-label="Readiness factors" className="mt-10">
        <h3 className="text-text text-[15px] font-medium">Readiness factors</h3>
        <Rule className="mt-2" />
        <ul className="mt-3 space-y-2">
          {comparison.factors.map((factor) => {
            const delta = factor.delta === null ? null : Math.round(factor.delta * 100);
            return (
              <li
                key={factor.id}
                className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-[14px]"
              >
                <span className="text-text w-64 shrink-0">{factor.label}</span>
                <span className="text-text-muted" data-numeric>
                  {factor.before === null ? '—' : Math.round(factor.before * 100)}
                  {' → '}
                  {factor.after === null ? '—' : Math.round(factor.after * 100)}
                </span>
                {delta !== null && delta !== 0 && (
                  <span
                    data-numeric
                    className={delta > 0 ? 'text-signal' : 'text-copper'}
                  >
                    {signed(delta)}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      {/* ── Headline claims ────────────────────────────────────────────── */}
      <section aria-label="Headline findings" className="mt-10">
        <h3 className="text-text text-[15px] font-medium">Headline findings</h3>
        <Rule className="mt-2" />
        {comparison.headlineClaims.map((claim) => (
          <Claim key={claim.label} claim={claim} />
        ))}
      </section>

      <DiffSection title="Risk register" diff={comparison.risks} />
      <DiffSection title="Regulatory requirements" diff={comparison.regulation} />
      <DiffSection title="Recommended actions" diff={comparison.planActions} />

      {/* ── Margins and coverage ───────────────────────────────────────── */}
      <section aria-label="Margin scenarios" className="mt-10">
        <h3 className="text-text text-[15px] font-medium">Margin scenarios</h3>
        <Rule className="mt-2" />
        <ul className="mt-3 space-y-2">
          {comparison.scenarios.map((scenario) => (
            <li
              key={scenario.id}
              className="flex flex-wrap items-baseline gap-x-4 text-[14px]"
            >
              <span className="text-text w-64 shrink-0">{scenario.label}</span>
              <span className="text-text-muted" data-numeric>
                {scenario.marginPercent.before === null
                  ? 'not computable'
                  : `${scenario.marginPercent.before}%`}
                {' → '}
                {scenario.marginPercent.after === null
                  ? 'not computable'
                  : `${scenario.marginPercent.after}%`}
              </span>
            </li>
          ))}
          {comparison.scenarios.length === 0 && (
            <li className="text-text-faint text-[14px]">
              Neither version could compute a margin scenario.
            </li>
          )}
        </ul>
      </section>

      <section aria-label="Evidence coverage" className="mt-10">
        <h3 className="text-text text-[15px] font-medium">Evidence coverage</h3>
        <Rule className="mt-2" />
        <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {comparison.coverage.map((entry) => (
            <li
              key={entry.field}
              className="flex items-baseline justify-between gap-4 text-[14px]"
            >
              <span className="text-text-muted">{entry.label}</span>
              <span className="text-text" data-numeric>
                {entry.before} → {entry.after}
              </span>
            </li>
          ))}
          <li className="flex items-baseline justify-between gap-4 text-[14px]">
            <span className="text-text-muted">Stated limitations</span>
            <span className="text-text" data-numeric>
              {comparison.limitations.before} → {comparison.limitations.after}
            </span>
          </li>
        </ul>
      </section>

      <p className="text-text-faint mt-12 text-[13px] leading-relaxed">
        Comparing {beforeLabel} against {afterLabel}. This comparison is computed
        structurally from the two stored reports; it contains no generated prose.
      </p>
    </div>
  );
}
