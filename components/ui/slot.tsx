import { Children, cloneElement, isValidElement, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * Renders a component's styling onto its child instead of a wrapper element.
 *
 * Exists for one recurring problem: a link that must look like a button. The
 * previous design system had no answer to it, so roughly fifteen call sites
 * hand-copied the button's class string onto an anchor — which meant the button
 * had one definition and its appearance had sixteen, and they had already
 * started to disagree.
 *
 * Deliberately not Radix's Slot. This does the one thing needed: merge class
 * names, let the child's own props win, and pass everything else through. Two
 * dozen lines beat a dependency for a component this small, and there is no
 * ref-forwarding subtlety to get wrong in React 19.
 */
export function Slot({
  className,
  children,
  ...props
}: { className?: string; children: ReactNode } & Record<string, unknown>) {
  const child = Children.only(children);

  if (!isValidElement<{ className?: string }>(child)) {
    throw new Error('Slot expects a single React element child');
  }

  return cloneElement(child, {
    ...props,
    ...child.props,
    className: cn(className, child.props.className),
  } as never);
}
