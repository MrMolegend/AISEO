import { CircleCheck } from 'lucide-react';
import { CATEGORY_LABELS, type AuditAnalysis } from '@/schemas/audit';

export function StrengthsList({ analysis }: { analysis: AuditAnalysis }) {
  return (
    <ul className="grid gap-4 md:grid-cols-2">
      {analysis.strengths.map((strength) => (
        <li key={strength.id} className="flex gap-3">
          <CircleCheck
            className="mt-0.5 size-4 shrink-0 text-[var(--color-score-good)]"
            aria-hidden
          />
          <div className="min-w-0">
            <h3 className="text-[15px] font-medium">{strength.title}</h3>
            <p className="text-ink-faint mt-0.5 text-xs">
              {CATEGORY_LABELS[strength.category]}
            </p>
            <p className="text-ink-muted mt-1.5 text-sm leading-relaxed">
              {strength.detail}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}
