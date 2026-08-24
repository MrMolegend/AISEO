import { Badge } from './badge';
import type { Confidence, Basis } from '@/schemas/research/shared';

/**
 * Confidence and provenance, rendered together wherever a claim appears.
 *
 * These two labels are the mechanism by which a reader decides how much weight
 * to put on a line, so they are never colour alone: every badge carries a word.
 * A reader who cannot distinguish the tints still gets the whole meaning.
 */

const CONFIDENCE_TONE = {
  high: 'success',
  medium: 'medium',
  low: 'low',
} as const;

const CONFIDENCE_LABEL = {
  high: 'High confidence',
  medium: 'Medium confidence',
  low: 'Low confidence',
} as const;

export function ConfidenceBadge({
  confidence,
  size = 'sm',
}: {
  confidence: Confidence;
  size?: 'sm' | 'md';
}) {
  return (
    <Badge tone={CONFIDENCE_TONE[confidence]} size={size}>
      {CONFIDENCE_LABEL[confidence]}
    </Badge>
  );
}

/**
 * What kind of knowledge this is.
 *
 * The distinction the whole product rests on: "read on their pricing page" and
 * "our reasoning from other evidence" are different claims, and a reader who
 * cannot tell them apart has been misled even when both are true.
 */
const BASIS_COPY: Record<
  Basis,
  { label: string; tone: 'success' | 'medium' | 'low' | 'neutral'; title: string }
> = {
  measured: {
    label: 'Read directly',
    tone: 'success',
    title: 'Read directly from a page we fetched',
  },
  sourced: {
    label: 'Sourced',
    tone: 'medium',
    title: 'Stated by a public source we did not fetch ourselves',
  },
  inferred: {
    label: 'Inferred',
    tone: 'low',
    title: 'Our reasoning from other evidence, not stated in any source',
  },
  unavailable: {
    label: 'Not available',
    tone: 'neutral',
    title: 'We looked and could not establish this',
  },
};

export function BasisBadge({ basis, size = 'sm' }: { basis: Basis; size?: 'sm' | 'md' }) {
  const copy = BASIS_COPY[basis];
  return (
    <Badge tone={copy.tone} size={size} title={copy.title}>
      {copy.label}
    </Badge>
  );
}
