'use client';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

/**
 * Share, print, download.
 *
 * Sharing used to mean copying the page's own URL — the public id was a
 * capability, and holding it was access. That is gone: a report is private to
 * its owner, and sharing is deliberate, through minted links that can expire
 * and be revoked. So the share affordance here is a door to the share
 * manager, not a clipboard write.
 *
 * Print stays a button because this document's most common destination is a
 * meeting, and `window.print()` picks up the print stylesheet that turns the
 * obsidian ground white and drops the navigation.
 */
export function ShareControls({
  sharingHref,
  sourcesHref,
}: {
  /** The share manager, shown to the owner only. */
  sharingHref?: string | null;
  /**
   * Where to download the evidence register, or null when this view has no
   * export authority — the worked example, or a share minted without
   * download permission.
   */
  sourcesHref?: string | null;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 print:hidden">
      {sharingHref && (
        <Button variant="secondary" size="sm" asChild>
          <Link href={sharingHref}>Manage sharing</Link>
        </Button>
      )}
      <Button variant="ghost" size="sm" onClick={() => window.print()}>
        Print or save as PDF
      </Button>
      {sourcesHref && (
        /* A plain link, so it is right-clickable, keyboard-operable and works
           without JavaScript — the browser downloads it on the strength of the
           route's Content-Disposition. */
        <Button variant="ghost" size="sm" asChild>
          <a href={sourcesHref} download>
            Download the sources
          </a>
        </Button>
      )}
    </div>
  );
}
