import { cn } from '@/lib/utils';

/**
 * A data panel.
 *
 * Square by default, bounded by a hairline rather than lifted by a shadow, and
 * without a radius. That is the deliberate opposite of the rounded-card grid
 * this product used to be, and it is most of why a page of panels now reads as
 * a document rather than as a feed.
 *
 * `edge` puts a three-pixel coloured rule down the leading side. It is how a
 * decision panel, a risk row or a blocked source announces what it is without
 * a badge, an icon or a tinted background — one line of colour against an
 * otherwise uniform surface carries further than any of them.
 */
export function Panel({
  className,
  edge,
  inset = false,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  /** A `--color-*` token name for the leading edge rule. */
  edge?: string;
  /** Sunken rather than flush, for a block quoted from somewhere else. */
  inset?: boolean;
}) {
  return (
    <div
      className={cn(
        'border-rule border',
        inset ? 'bg-ground-sunken' : 'bg-ground-raised',
        edge && 'border-l-[3px]',
        className,
      )}
      style={edge ? { borderLeftColor: `var(--color-${edge})` } : undefined}
      {...props}
    />
  );
}

export function PanelBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('p-5 md:p-6', className)} {...props} />;
}

/**
 * A labelled hairline.
 *
 * The cartographic device the whole layout leans on: a rule that carries a
 * short monospace label sitting on it, the way a map annotates a boundary. Used
 * instead of a heading wherever a section needs marking but not announcing.
 */
export function Rule({ label, className }: { label?: string; className?: string }) {
  if (!label) {
    return <hr className={cn('border-rule border-t', className)} />;
  }
  return (
    <div className={cn('flex items-center gap-3', className)} role="presentation">
      <span className="meta text-text-faint shrink-0">{label}</span>
      <span aria-hidden="true" className="bg-rule h-px flex-1" />
    </div>
  );
}

/**
 * Compact monospace metadata.
 *
 * Market codes, source refs, retrieval dates, coordinates. Rendered as a
 * `<span>` so it can sit inline in a sentence, and never used for anything a
 * reader needs to read as prose — uppercase mono at 11px is a label, not text.
 */
export function Meta({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return <span className={cn('meta text-text-faint', className)} {...props} />;
}
