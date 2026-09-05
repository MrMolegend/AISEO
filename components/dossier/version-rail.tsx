import Link from 'next/link';
import { Meta } from '@/components/ui/panel';
import { VERDICT_LABEL, type Verdict } from '@/config/design';

/**
 * The version rail.
 *
 * Shown to the owner when a report belongs to a business profile with more
 * than one run. Each run is immutable; the rail is how the history reads as a
 * history — which version this is, when the others ran, and the one-click
 * comparison against the previous version, which is the question a repeat
 * customer actually has ("what changed since last time?").
 */
export interface VersionEntry {
  publicId: string;
  createdAt: string;
  verdict: string | null;
  current: boolean;
  number: number;
}

function dateLabel(iso: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  return parsed.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function VersionRail({
  versions,
  profileName,
}: {
  versions: VersionEntry[];
  profileName: string | null;
}) {
  if (versions.length < 2) return null;

  const current = versions.find((version) => version.current);
  const previous = current
    ? versions.filter((version) => version.number < current.number).at(-1)
    : undefined;

  return (
    <nav
      aria-label="Report versions"
      className="border-rule mx-auto max-w-[var(--container-page)] border-b px-5 py-3 md:px-8 print:hidden"
    >
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <Meta>
          Version {current?.number} of {versions.length}
          {profileName ? ` · ${profileName}` : ''}
        </Meta>

        <ol className="flex flex-wrap items-center gap-2">
          {versions.map((version) => (
            <li key={version.publicId}>
              {version.current ? (
                <span
                  aria-current="page"
                  className="border-signal text-text inline-block border-b-2 px-1 pb-0.5 text-[13px]"
                >
                  v{version.number} · {dateLabel(version.createdAt)}
                </span>
              ) : (
                <Link
                  href={`/research/${version.publicId}`}
                  className="text-text-muted hover:text-text inline-block px-1 pb-0.5 text-[13px] transition-colors"
                >
                  v{version.number} · {dateLabel(version.createdAt)}
                  {version.verdict && version.verdict in VERDICT_LABEL ? (
                    <span className="text-text-faint">
                      {' '}
                      — {VERDICT_LABEL[version.verdict as Verdict]}
                    </span>
                  ) : null}
                </Link>
              )}
            </li>
          ))}
        </ol>

        {previous && current && (
          <Link
            href={`/research/${current.publicId}/compare/${previous.publicId}`}
            className="text-cobalt ml-auto text-[13px] underline-offset-4 hover:underline"
          >
            Compare with v{previous.number}
          </Link>
        )}
      </div>
    </nav>
  );
}
