import type { Evidence } from '@/schemas/audit';

/**
 * The real value read from the page, shown beside the model's commentary.
 *
 * This is the component that makes the audit checkable. If the model claims a
 * title is too long, the reader sees the actual title and can count for
 * themselves. Rendered as plain text children — never as markup — so injected
 * page content cannot escape into the DOM.
 */
export function EvidenceBlock({ evidence }: { evidence: Evidence }) {
  return (
    <div className="border-line bg-surface-sunken rounded-[var(--radius-control)] border px-3.5 py-3">
      <p className="text-ink-faint text-[11px] font-medium tracking-wide uppercase">
        {evidence.label}
      </p>
      <p className="text-ink mt-1.5 font-mono text-[13px] leading-relaxed break-words">
        {evidence.value}
      </p>
    </div>
  );
}
