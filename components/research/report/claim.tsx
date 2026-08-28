import { Citations } from './citation';
import { BasisBadge, ConfidenceBadge } from '@/components/ui/confidence-badge';
import type {
  EvidencedClaim,
  OptionalValue,
  StoredSource,
  Limitation,
  SourceConflict,
} from '@/schemas/research/shared';

/**
 * The primitives every report section is built from.
 *
 * Each one renders a claim together with how we know it and how sure we are —
 * never the claim alone. Separating a statement from its provenance is how a
 * report becomes more confident than its evidence, and these components make
 * that separation impossible to do accidentally.
 */

export function ClaimList({
  claims,
  sources,
  className,
}: {
  claims: readonly EvidencedClaim[];
  sources: readonly StoredSource[];
  className?: string;
}) {
  if (claims.length === 0) return null;

  return (
    <ul className={className ?? 'space-y-3'}>
      {claims.map((claim, index) => (
        <li key={`${claim.statement.slice(0, 24)}-${index}`}>
          <p className="text-text-muted text-sm leading-relaxed">
            {claim.statement}
            <Citations refs={claim.sources} sources={sources} />
          </p>
          <p className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <BasisBadge basis={claim.basis} />
            <ConfidenceBadge confidence={claim.confidence} />
          </p>
        </li>
      ))}
    </ul>
  );
}

/**
 * A value that might not exist.
 *
 * The `unavailable` case is rendered as prominently as a real value, on purpose.
 * A blank cell reads as "we did not look"; this reads as "we looked and it is
 * not published", which is a genuinely useful finding about a competitor.
 */
export function ValueWithBasis({
  label,
  value,
  sources,
}: {
  label: string;
  value: OptionalValue;
  sources: readonly StoredSource[];
}) {
  const unavailable = value.basis === 'unavailable' || value.value === null;

  return (
    <div>
      <dt className="text-text-subtle text-xs font-medium tracking-wide uppercase">
        {label}
      </dt>
      <dd className="mt-1">
        <span
          className={
            unavailable ? 'text-text-faint text-sm italic' : 'text-text text-sm font-medium'
          }
        >
          {unavailable ? 'Not publicly available' : value.value}
        </span>
        {!unavailable && <Citations refs={value.sources} sources={sources} />}

        {value.note && (
          <span className="text-text-faint mt-1 block text-xs leading-relaxed">
            {value.note}
          </span>
        )}

        <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <BasisBadge basis={value.basis} />
          {!unavailable && <ConfidenceBadge confidence={value.confidence} />}
        </span>
      </dd>
    </div>
  );
}

/**
 * What the report could not establish.
 *
 * Rendered plainly rather than apologetically — an understated panel reads as
 * candour, a warning-coloured one reads as a failure. This section is required
 * in every report precisely because it is the part a less honest product would
 * omit.
 */
export function LimitationsPanel({
  limitations,
}: {
  limitations: readonly Limitation[];
}) {
  if (limitations.length === 0) return null;

  return (
    <div className="border-rule bg-ground-raised rounded-[var(--radius-panel)] border p-5 md:p-6">
      <h2 className="text-text text-base font-semibold">What we could not determine</h2>
      <p className="text-text-subtle mt-1.5 text-sm leading-relaxed">
        Public sources only go so far. These are the gaps we know about.
      </p>

      <dl className="mt-5 space-y-4">
        {limitations.map((limitation, index) => (
          <div key={`${limitation.area}-${index}`}>
            <dt className="text-text text-sm font-medium">{limitation.area}</dt>
            <dd className="text-text-muted mt-1 text-sm leading-relaxed">
              {limitation.detail}
              {limitation.howToResolve && (
                <span className="text-text-subtle mt-1 block">
                  What would answer it: {limitation.howToResolve}
                </span>
              )}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/**
 * Where sources disagree.
 *
 * Shown rather than resolved. Picking a winner silently would make the report
 * look more certain than the evidence is, and the disagreement is often the
 * most interesting thing on the page.
 */
export function ConflictsPanel({
  conflicts,
  sources,
}: {
  conflicts: readonly SourceConflict[];
  sources: readonly StoredSource[];
}) {
  if (conflicts.length === 0) return null;

  return (
    <div className="border-rule rounded-[var(--radius-panel)] border p-5 md:p-6">
      <h2 className="text-text text-base font-semibold">Where sources disagree</h2>
      <p className="text-text-subtle mt-1.5 text-sm leading-relaxed">
        We found conflicting accounts of these. Both are shown rather than one being
        chosen for you.
      </p>

      <div className="mt-5 space-y-5">
        {conflicts.map((conflict, index) => (
          <div key={`${conflict.topic}-${index}`}>
            <h3 className="text-text text-sm font-medium">{conflict.topic}</h3>
            <ul className="mt-2 space-y-2">
              {conflict.positions.map((position, positionIndex) => (
                <li
                  key={positionIndex}
                  className="border-rule-strong text-text-muted border-l-2 pl-3 text-sm leading-relaxed"
                >
                  {position.claim}
                  <Citations refs={position.sources} sources={sources} />
                </li>
              ))}
            </ul>
            {conflict.note && (
              <p className="text-text-subtle mt-2 text-sm leading-relaxed">
                {conflict.note}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/** A 0–100 score with the band that explains what it means. */
export function ScorePill({ score, band }: { score: number; band: string }) {
  const tone =
    score >= 85
      ? 'var(--color-grade-verified)'
      : score >= 70
        ? 'var(--color-verdict-promising)'
        : score >= 55
          ? 'var(--color-verdict-conditional)'
          : 'var(--color-verdict-risk)';

  return (
    <span className="inline-flex items-baseline gap-1.5">
      <span className="text-[17px] font-semibold tabular-nums" style={{ color: tone }}>
        {score}
      </span>
      {/* The number alone means nothing without the band, so they always ship
          together and the band is never colour-only. */}
      <span className="text-text-subtle text-xs">{band}</span>
    </span>
  );
}
