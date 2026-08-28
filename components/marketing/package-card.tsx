import Link from 'next/link';
import { Card, CardBody } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BRAND } from '@/config/brand';
import { formatTokens } from '@/config/tokens';
import type { ResearchPackage } from '@/config/packages';

/**
 * One research package.
 *
 * The cost is stated in tokens rather than money, because that is what the user
 * actually spends and because the money price is provisional. The deliverables
 * list is the honest version of the pitch: it is what the report contains, not
 * what it might achieve.
 */
export function PackageCard({
  pkg,
  href,
  balance,
  featured = false,
}: {
  pkg: ResearchPackage;
  href: string;
  /** When known, shows whether this is affordable right now. */
  balance?: number;
  featured?: boolean;
}) {
  const affordable = balance === undefined || balance >= pkg.tokenCost;

  return (
    <Card raised={featured} className="flex h-full flex-col">
      <CardBody className="flex h-full flex-col">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-text text-[17px] font-semibold tracking-[var(--tracking-tight)]">
            {pkg.name}
          </h3>
          <Badge tone={featured ? 'brand' : 'neutral'} size="sm">
            <span className="tabular-nums">{formatTokens(pkg.tokenCost)}</span>
            <span className="sr-only"> </span>
            {BRAND.currency.plural}
          </Badge>
        </div>

        <p className="text-text-muted mt-2 text-sm leading-relaxed">{pkg.summary}</p>

        <ul className="mt-4 space-y-1.5">
          {pkg.deliverables.map((item) => (
            <li
              key={item}
              className="text-text-subtle flex gap-2 text-sm leading-relaxed"
            >
              <span aria-hidden="true" className="text-cobalt mt-[3px] shrink-0">
                ·
              </span>
              {item}
            </li>
          ))}
        </ul>

        <div className="mt-auto pt-5">
          <p className="text-text-faint mb-3 text-xs tabular-nums">
            Typically {pkg.typicalDurationMinutes[0]}–{pkg.typicalDurationMinutes[1]}{' '}
            minutes
          </p>

          {affordable ? (
            <Link
              href={href}
              className="bg-signal text-text-on-signal hover:bg-signal-dim focus-visible:ring-cobalt inline-flex h-11 w-full items-center justify-center rounded-[var(--radius-control)] px-5 text-[15px] font-medium transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
            >
              Start this research
            </Link>
          ) : (
            <div>
              <Link
                href="/wallet"
                className="border-rule-strong bg-ground-raised text-text hover:bg-ground-raised focus-visible:ring-cobalt inline-flex h-11 w-full items-center justify-center rounded-[var(--radius-control)] border px-5 text-[15px] font-medium transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
              >
                Not enough {BRAND.currency.plural}
              </Link>
              <p className="text-text-faint mt-2 text-center text-xs tabular-nums">
                You have {formatTokens(balance!)} of {formatTokens(pkg.tokenCost)}
              </p>
            </div>
          )}
        </div>
      </CardBody>
    </Card>
  );
}
