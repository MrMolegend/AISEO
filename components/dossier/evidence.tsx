import { Badge } from '@/components/ui/badge';
import { Meta } from '@/components/ui/panel';
import { Drawer } from '@/components/ui/drawer';
import {
  EVIDENCE_GRADE_LABEL,
  EVIDENCE_GRADE_MEANING,
  EVIDENCE_GRADE_TOKEN,
  type EvidenceGrade,
} from '@/config/design';
import type { MarketClaim, MarketValue } from '@/schemas/market-entry/evidence';
import type { MarketSource } from '@/schemas/market-entry/report';

/**
 * Rendering a claim, with its evidence attached rather than footnoted.
 *
 * The design decision that shapes this whole file: a citation is not a small
 * superscript number pointing at an appendix nobody opens. It is a drawer that
 * opens underneath the sentence and shows the publisher, how the page reached
 * us, when it was published and how relevant it is to the market — because the
 * reader's real question is never "what number is this source", it is "should I
 * believe this".
 *
 * The grade beside every claim is computed by lib/validation/market-entry.ts
 * from the claim's declared basis and the metadata of its sources. It is never
 * something the model chose, which is what stops a confident sentence looking
 * like a verified one.
 */

export interface SourceLookup {
  byRef: ReadonlyMap<string, MarketSource>;
  gradeAt: (path: string) => EvidenceGrade;
}

export function buildLookup(
  sources: readonly MarketSource[],
  grades: Record<string, EvidenceGrade>,
): SourceLookup {
  const byRef = new Map(sources.map((source) => [source.ref, source]));
  return {
    byRef,
    // A claim with no recorded grade is shown as unverified rather than
    // unlabelled. An unlabelled claim reads as a fact.
    gradeAt: (path) => grades[path] ?? 'unknown',
  };
}

export function GradeChip({ grade }: { grade: EvidenceGrade }) {
  return (
    <Badge tone="token" token={EVIDENCE_GRADE_TOKEN[grade]} size="sm">
      <span title={EVIDENCE_GRADE_MEANING[grade]}>{EVIDENCE_GRADE_LABEL[grade]}</span>
    </Badge>
  );
}

/** A single claim: the sentence, its grade, and its sources on request. */
export function Claim({
  claim,
  path,
  lookup,
}: {
  claim: MarketClaim;
  path: string;
  lookup: SourceLookup;
}) {
  const grade = lookup.gradeAt(path);
  const cited = claim.sources
    .map((ref) => lookup.byRef.get(ref))
    .filter((source): source is MarketSource => source !== undefined);

  return (
    <li className="border-rule border-b py-4 last:border-b-0" data-print-keep>
      <p className="text-text measure text-[15px] leading-relaxed">{claim.statement}</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <GradeChip grade={grade} />
        {cited.length === 0 ? (
          <Meta>No source</Meta>
        ) : (
          <Meta>
            {cited.length} {cited.length === 1 ? 'source' : 'sources'}
          </Meta>
        )}
      </div>
      {cited.length > 0 && <SourceDrawer sources={cited} />}
    </li>
  );
}

export function ClaimList({
  claims,
  path,
  lookup,
  empty = 'Nothing was established here.',
}: {
  claims: readonly MarketClaim[];
  /** Dotted path of the array, e.g. `marketSignals.demand`. */
  path: string;
  lookup: SourceLookup;
  empty?: string;
}) {
  if (claims.length === 0) {
    return <p className="text-text-faint text-[14px]">{empty}</p>;
  }
  return (
    <ul>
      {claims.map((claim, index) => (
        <Claim
          key={`${path}-${index}`}
          claim={claim}
          path={`${path}[${index}]`}
          lookup={lookup}
        />
      ))}
    </ul>
  );
}

/**
 * A value that may not exist.
 *
 * Renders the absence as prominently as the presence. "Not established" set in
 * the same size as a price, with the reason beside it, is the difference
 * between a report that admits a gap and one that looks like it forgot.
 */
export function Value({
  value,
  path,
  lookup,
  label,
}: {
  value: MarketValue;
  path: string;
  lookup: SourceLookup;
  label: string;
}) {
  const grade = lookup.gradeAt(path);
  const cited = value.sources
    .map((ref) => lookup.byRef.get(ref))
    .filter((source): source is MarketSource => source !== undefined);

  return (
    <div data-print-keep>
      <Meta>{label}</Meta>
      <p
        className={`mt-1 text-[15px] ${value.value ? 'text-text' : 'text-text-faint italic'}`}
      >
        {value.value ?? 'Not established'}
      </p>
      <div className="mt-1.5 flex flex-wrap items-center gap-2">
        <GradeChip grade={grade} />
      </div>
      {value.note && (
        <p className="text-text-subtle mt-1.5 text-[13px] leading-relaxed">
          {value.note}
        </p>
      )}
      {cited.length > 0 && <SourceDrawer sources={cited} />}
    </div>
  );
}

/**
 * The source drawer.
 *
 * Native `<details>`, so it is keyboard-operable, announced as expanded or
 * collapsed, and findable by in-page search without any of that being
 * reimplemented. What it shows is chosen to answer "should I believe this":
 * the publisher, whether we opened the page or only saw an index summary of it,
 * when it was published, and whether it is about the right country.
 */
export function SourceDrawer({ sources }: { sources: readonly MarketSource[] }) {
  return (
    <Drawer
      className="mt-2"
      summary={
        <span className="meta">
          {sources.map((source) => source.ref).join(' · ')} — show evidence
        </span>
      }
    >
      <ul className="space-y-3">
        {sources.map((source) => (
          <li key={source.ref} className="border-rule border-l-2 pl-3">
            <div className="flex flex-wrap items-center gap-2">
              <Meta className="text-signal">{source.ref}</Meta>
              <Badge
                size="sm"
                tone={source.retrievalMode === 'direct' ? 'signal' : 'neutral'}
              >
                {source.retrievalMode === 'direct' ? 'Read directly' : 'Index summary'}
              </Badge>
              <Meta>{source.category.replace(/_/g, ' ')}</Meta>
              {source.geographicRelevance !== 'unknown' && (
                <Meta>{source.geographicRelevance.replace(/-/g, ' ')}</Meta>
              )}
            </div>

            <p className="text-text mt-1.5 text-[13px] leading-snug">
              {source.title ?? source.publisher ?? source.url}
            </p>

            {source.excerpt && (
              <blockquote className="text-text-muted border-rule mt-2 border-l pl-3 text-[13px] leading-relaxed italic">
                {source.excerpt}
              </blockquote>
            )}

            <p className="mt-1.5 flex flex-wrap gap-x-3">
              <a
                href={source.url}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="text-cobalt text-[12px] break-all underline-offset-4 hover:underline"
              >
                {source.url}
              </a>
            </p>
            <Meta className="mt-1 block">
              {source.publishedAt ? `Published ${source.publishedAt} · ` : ''}
              Retrieved {source.retrievedAt.slice(0, 10)}
            </Meta>
          </li>
        ))}
      </ul>
    </Drawer>
  );
}
