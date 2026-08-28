import { cn } from '@/lib/utils';

/**
 * Initials rather than stock photography.
 *
 * Real tutor photographs would be uploaded to Supabase Storage; until then a
 * generated portrait would be worse than none, so this renders a duotone
 * initials mark drawn from the brand palette. `tone` is stored on the record so
 * the same person always gets the same colour.
 */
const TONES = [
  'bg-brand-subtle text-brand-ink',
  'bg-mint text-mint-ink',
  'bg-navy text-white dark:bg-[#33415f] dark:text-white',
  'bg-warning-bg text-warning',
  'bg-info-bg text-info',
] as const;

const SIZES = {
  xs: 'size-7 text-[0.625rem]',
  sm: 'size-9 text-xs',
  md: 'size-11 text-sm',
  lg: 'size-14 text-base',
  xl: 'size-20 text-xl',
  '2xl': 'size-28 text-3xl',
} as const;

export function Avatar({
  firstName,
  lastName,
  tone = 0,
  size = 'md',
  className,
}: {
  firstName: string;
  lastName: string;
  tone?: number;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const label = `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-[var(--radius-card)] font-semibold tracking-tight select-none',
        TONES[tone % TONES.length],
        SIZES[size],
        className,
      )}
      // The name is always rendered next to the avatar, so this mark is
      // decorative as far as a screen reader is concerned.
      aria-hidden
    >
      {label}
    </span>
  );
}
