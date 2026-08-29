'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';

/**
 * Share and print.
 *
 * The share link is the page's own URL, which is a capability: the public id is
 * sixteen characters of entropy and holding it is what grants access. So the
 * copy control says what it is handing over rather than presenting it as an
 * innocuous convenience.
 *
 * Print is a button rather than an instruction because this document's most
 * common destination is a meeting, and `window.print()` picks up the print
 * stylesheet that turns the obsidian ground white and drops the navigation.
 */
export function ShareControls({
  shareable,
  sourcesHref,
}: {
  shareable: boolean;
  /**
   * Where to download the evidence register, or null when there is no stored
   * report behind this view — the worked example is rendered from a fixture and
   * has no export route to point at.
   */
  sourcesHref?: string | null;
}) {
  const [copied, setCopied] = useState(false);

  return (
    <div className="flex flex-wrap items-center gap-2 print:hidden">
      {shareable && (
        <Button
          variant="secondary"
          size="sm"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(window.location.href);
              setCopied(true);
              setTimeout(() => setCopied(false), 2400);
            } catch {
              // Clipboard permission refused, or an insecure context. The URL
              // is in the address bar either way; a failed copy is not worth an
              // error dialog.
            }
          }}
        >
          {copied ? 'Link copied' : 'Copy share link'}
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
      <span aria-live="polite" className="sr-only">
        {copied ? 'Share link copied to the clipboard.' : ''}
      </span>
    </div>
  );
}
