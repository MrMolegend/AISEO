import { cn } from '@/lib/utils';

/**
 * A table that can be scrolled sideways, by a keyboard as well as a finger.
 *
 * A comparison table is the right way to show four routes to market against
 * five criteria, and on a 360px phone it will not fit. Making it scroll is
 * easy; making the scroll reachable without a pointer is the part everyone
 * misses, and axe fails it as `scrollable-region-focusable`.
 *
 * So the scroller is a labelled region with `tabIndex={0}`. It is named by the
 * table's own caption rather than by the surrounding heading — pointing it at
 * the section heading gives the landmark and the region the same accessible
 * name, which reads as a duplicate to anything navigating by name.
 */
export function DataTable({
  caption,
  captionId,
  children,
  className,
  minWidth = 640,
}: {
  /** Required. A table nobody can name is a table nobody can find. */
  caption: React.ReactNode;
  captionId: string;
  children: React.ReactNode;
  className?: string;
  minWidth?: number;
}) {
  return (
    <div
      role="region"
      aria-labelledby={captionId}
      tabIndex={0}
      className={cn('scroll-rail focus-visible:outline-cobalt -mx-1 px-1', className)}
    >
      <table className="w-full border-collapse text-left" style={{ minWidth }}>
        <caption id={captionId} className="sr-only">
          {caption}
        </caption>
        {children}
      </table>
    </div>
  );
}

export function Th({
  className,
  scope = 'col',
  ...props
}: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      scope={scope}
      className={cn(
        'meta text-text-faint border-rule border-b px-3 py-2.5 align-bottom font-normal',
        className,
      )}
      {...props}
    />
  );
}

export function Td({
  className,
  ...props
}: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td
      className={cn(
        'border-rule-faint text-text border-b px-3 py-3 align-top text-[14px]',
        className,
      )}
      {...props}
    />
  );
}
