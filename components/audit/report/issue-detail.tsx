import { type Effort, type Impact, type Issue, OWNER_LABELS } from '@/schemas/audit';
import { EvidenceBlock } from './evidence-block';
import { Badge } from '@/components/ui/badge';

const IMPACT_LABEL: Record<Impact, string> = {
  high: 'High impact',
  medium: 'Medium impact',
  low: 'Low impact',
};

const EFFORT_LABEL: Record<Effort, string> = {
  low: 'Low effort',
  medium: 'Medium effort',
  high: 'High effort',
};

/**
 * The five-part issue body. The same five headings in the same order on every
 * issue, so a reader learns the shape once and can then skim.
 */
export function IssueDetail({ issue }: { issue: Issue }) {
  return (
    <div className="border-line space-y-5 border-t px-4 pt-5 pb-5 md:px-5">
      {issue.evidence ? <EvidenceBlock evidence={issue.evidence} /> : null}

      <Field label="What we found">{issue.finding}</Field>
      <Field label="Why it matters">{issue.whyItMatters}</Field>
      <Field label="What to do">{issue.recommendation}</Field>
      <Field label="What to expect">{issue.expectedImpact}</Field>

      <div className="border-line flex flex-wrap items-center gap-2 border-t pt-4">
        <Badge tone="neutral" size="sm">
          {IMPACT_LABEL[issue.impact]}
        </Badge>
        <Badge tone="neutral" size="sm">
          {EFFORT_LABEL[issue.effort]}
        </Badge>
        <Badge tone="neutral" size="sm">
          {OWNER_LABELS[issue.owner]}
        </Badge>
        {issue.confidence !== 'high' ? (
          <Badge
            tone="neutral"
            size="sm"
            title="How confident the analysis is in this finding, given the data available."
          >
            {issue.confidence === 'medium' ? 'Medium confidence' : 'Low confidence'}
          </Badge>
        ) : null}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="text-ink-faint text-[11px] font-semibold tracking-wide uppercase">
        {label}
      </h4>
      <p className="text-ink-muted measure mt-1.5 text-[15px] leading-relaxed">
        {children}
      </p>
    </div>
  );
}
