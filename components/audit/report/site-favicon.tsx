'use client';

import { useCallback, useState } from 'react';
import { Globe } from 'lucide-react';

/**
 * The audited site's favicon.
 *
 * This is the one place the report loads a third-party resource, and it fails
 * often in practice — dead icon paths, certificate problems, hotlink blocking.
 * Failure falls back to a neutral mark rather than an empty gap.
 *
 * Deliberately a plain <img>, not next/image: the source is arbitrary and
 * user-supplied, so it must never be proxied through our optimiser, and onError
 * is the only reliable way to detect the failure.
 */
export function SiteFavicon({ src }: { src: string | null }) {
  const [failed, setFailed] = useState(false);

  /*
   * The image is server-rendered, so it can finish loading — or fail — before
   * React hydrates, in which case the onError handler is attached too late to
   * ever fire. This ref callback catches that case: a complete image with zero
   * natural width is one that already failed.
   */
  const checkOnMount = useCallback((node: HTMLImageElement | null) => {
    if (node?.complete && node.naturalWidth === 0) setFailed(true);
  }, []);

  if (!src || failed) {
    return <Globe className="text-ink-faint size-5 shrink-0" aria-hidden />;
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      ref={checkOnMount}
      src={src}
      alt=""
      width={20}
      height={20}
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className="size-5 shrink-0 rounded-sm object-contain"
    />
  );
}
