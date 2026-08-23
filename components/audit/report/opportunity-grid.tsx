import type { AuditAnalysis, OpportunityType } from '@/schemas/audit';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';

const TYPE_LABELS: Record<OpportunityType, string> = {
  seo: 'Search',
  content: 'Content',
  conversion: 'Conversion',
  technical: 'Technical',
  growth: 'Growth',
};

const EFFORT_LABEL = { low: 'Low effort', medium: 'Medium effort', high: 'High effort' };
const IMPACT_LABEL = { high: 'High impact', medium: 'Medium impact', low: 'Low impact' };

/**
 * Opportunities are growth ideas rather than defect fixes, so they are presented
 * separately from issues — mixing the two makes a report read as a list of
 * complaints.
 */
export function OpportunityGrid({ analysis }: { analysis: AuditAnalysis }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {analysis.opportunities.map((opportunity) => (
        // Flex column with an auto-margin footer keeps chips aligned across
        // cards of different heights.
        <Card key={opportunity.id} className="flex flex-col p-5">
          <Badge tone="brand" size="sm" className="self-start">
            {TYPE_LABELS[opportunity.type]}
          </Badge>
          <h3 className="mt-3 text-[15px] font-semibold">{opportunity.title}</h3>
          <p className="text-ink-muted mt-2 text-sm leading-relaxed">
            {opportunity.description}
          </p>
          <p className="text-ink-subtle mt-3 text-sm leading-relaxed italic">
            {opportunity.rationale}
          </p>
          <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-4">
            <Badge tone="neutral" size="sm">
              {IMPACT_LABEL[opportunity.impact]}
            </Badge>
            <Badge tone="neutral" size="sm">
              {EFFORT_LABEL[opportunity.effort]}
            </Badge>
          </div>
        </Card>
      ))}
    </div>
  );
}
