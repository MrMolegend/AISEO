'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';

/**
 * The member's own LinkedIn identity link.
 *
 * Renders exactly what the deployment can do — never more. Disabled mode
 * gets one honest sentence; openid mode gets connect/disconnect plus what
 * the link actually returned. Disconnect deletes the stored identity;
 * there are no tokens to revoke because none are kept.
 */
export function LinkedInPanel({
  mode,
  configured,
  connection,
}: {
  mode: 'disabled' | 'openid_only' | 'partner_sales_access';
  configured: boolean;
  connection: {
    displayName: string | null;
    email: string | null;
    grantedScopes: string[];
    linkedAt: string;
  } | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  async function disconnect() {
    if (busy) return;
    setBusy(true);
    setFailure(null);
    try {
      const response = await fetch('/api/linkedin/disconnect', { method: 'POST' });
      if (!response.ok) {
        setFailure('The connection could not be removed. Try again.');
        return;
      }
      router.refresh();
    } catch {
      setFailure('We could not reach the server. Try again.');
    } finally {
      setBusy(false);
    }
  }

  if (mode === 'disabled' || !configured) {
    return (
      <p className="text-text-muted text-[14px] leading-relaxed">
        LinkedIn identity linking is not enabled for this deployment. Nothing in the
        product depends on it: discovery, research and relationship mapping work fully
        without LinkedIn access, and no LinkedIn data is collected by other means.
      </p>
    );
  }

  return (
    <div>
      {connection ? (
        <>
          <p className="text-text text-[14px] leading-relaxed">
            Linked as{' '}
            <span className="font-medium">
              {connection.displayName ?? 'your LinkedIn identity'}
            </span>
            {connection.email ? ` (${connection.email})` : ''} on{' '}
            {connection.linkedAt.slice(0, 10)}.
          </p>
          <p className="text-text-subtle mt-2 text-[13px] leading-relaxed">
            Granted scopes: {connection.grantedScopes.join(', ') || 'none recorded'}. This
            link identifies you; it cannot read your connections, your messages, or anyone
            else&rsquo;s profile, and no access token is stored.
          </p>
          <div className="mt-4">
            <Button
              variant="secondary"
              size="sm"
              disabled={busy}
              onClick={() => void disconnect()}
            >
              Disconnect and delete the stored identity
            </Button>
          </div>
        </>
      ) : (
        <>
          <p className="text-text-muted text-[14px] leading-relaxed">
            You can link your own LinkedIn identity (OpenID Connect: your name and email,
            nothing more). It helps colleagues see who is who; it grants the product no
            access to your connections or messages.
          </p>
          <div className="mt-4">
            <Button asChild variant="secondary" size="sm">
              <a href="/api/linkedin/authorize">Link my LinkedIn identity</a>
            </Button>
          </div>
        </>
      )}
      {failure && (
        <p role="alert" className="text-copper mt-3 text-[13px]">
          {failure}
        </p>
      )}
    </div>
  );
}
