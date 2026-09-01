import type { StoredSource } from '@/schemas/research/shared';

/**
 * Citations, rendered beside the claims they support.
 *
 * This is the component the whole product's credibility rests on, so it is
 * deliberately literal: each reference is a link to the actual page, labelled
 * with the domain, opening in a new tab. A citation the reader cannot follow is
 * decoration.
 *
 * `rel="noopener noreferrer nofollow"` on every one. noopener because these are
 * third-party pages we did not vet; nofollow because a report should not pass
 * ranking signal to whatever it happens to cite.
 */
export function Citations({
  refs,
  sources,
  label = 'Sources',
}: {
  refs: readonly string[];
  sources: readonly StoredSource[];
  label?: string;
}) {
  if (refs.length === 0) return null;

  const byRef = new Map(sources.map((source) => [source.ref, source]));
  const resolved = refs
    .map((ref) => byRef.get(ref))
    .filter((source): source is StoredSource => Boolean(source));

  if (resolved.length === 0) return null;

  return (
    <span className="ml-1.5 inline-flex flex-wrap items-baseline gap-1">
      <span className="sr-only">{label}: </span>
      {resolved.map((source) => (
        <a
          key={source.ref}
          href={source.url}
          target="_blank"
          rel="noopener noreferrer nofollow"
          title={source.title ? `${source.title} — ${source.url}` : source.url}
          className="border-rule bg-ground-sunken text-text-subtle hover:border-cobalt-line hover:text-cobalt focus-visible:ring-cobalt inline-flex items-center rounded border px-1.5 py-px text-[11px] font-medium tabular-nums transition-colors focus-visible:ring-2 focus-visible:outline-none"
        >
          {source.ref}
          <span className="sr-only">
            {' '}
            — {source.publisherDomain ?? source.url} (opens in a new tab)
          </span>
        </a>
      ))}
    </span>
  );
}

/**
 * The full source list, rendered at the end of every report.
 *
 * Marks which pages we read ourselves and which we only saw referenced. That
 * distinction is the difference between "their pricing page says £49" and "a
 * directory listing says they charge around £49", and a reader deciding how
 * much to trust a line deserves to know which they are looking at.
 */
export function SourceList({ sources }: { sources: readonly StoredSource[] }) {
  if (sources.length === 0) return null;

  return (
    <ol className="space-y-2">
      {sources.map((source) => (
        <li key={source.ref} className="flex gap-3 text-sm">
          <span className="text-text-faint w-9 shrink-0 pt-px font-medium tabular-nums">
            {source.ref}
          </span>
          <span className="min-w-0">
            <a
              href={source.url}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="text-text hover:text-cobalt focus-visible:ring-cobalt rounded font-medium break-words underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:outline-none"
            >
              {source.title || source.url}
            </a>
            <span className="text-text-faint mt-0.5 block text-xs break-all">
              {source.url}
            </span>
            <span className="text-text-faint mt-0.5 block text-xs">
              {source.fetched ? 'Read directly' : 'Seen in search results'} ·{' '}
              <time dateTime={source.retrievedAt}>
                {new Date(source.retrievedAt).toLocaleDateString('en-GB', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}
              </time>
            </span>
          </span>
        </li>
      ))}
    </ol>
  );
}
