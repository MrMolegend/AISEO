'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Panel, Meta } from '@/components/ui/panel';
import { countryName } from '@/config/markets';

/**
 * One profile in the list.
 *
 * The primary action is starting an assessment seeded from this profile; the
 * secondary ones are editing and archiving. Archive is a soft verb and the
 * card says so — nothing here deletes, and a restored profile comes back
 * exactly as it was.
 */
export function ProfileCard({
  profile,
}: {
  profile: {
    id: string;
    name: string;
    industry: string | null;
    homeCountry: string | null;
    websiteUrl: string | null;
    offerings: string[];
    archivedAt: string | null;
    updatedAt: string;
  };
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const archived = Boolean(profile.archivedAt);

  async function setArchived(next: boolean) {
    if (busy) return;
    setBusy(true);
    setFailed(false);
    try {
      const response = await fetch(`/api/profiles/${profile.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ archived: next }),
      });
      if (!response.ok) {
        setFailed(true);
        return;
      }
      router.refresh();
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel edge={archived ? undefined : 'signal'}>
      <div className="p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="font-display text-text text-[19px] leading-snug">
            {profile.name}
          </h3>
          {archived && <Meta>Archived</Meta>}
        </div>

        <p className="text-text-muted mt-1.5 text-[13px]">
          {[
            profile.industry,
            profile.homeCountry ? countryName(profile.homeCountry) : null,
            profile.websiteUrl ? new URL(profile.websiteUrl).hostname : 'No website',
          ]
            .filter(Boolean)
            .join(' · ')}
        </p>

        {profile.offerings.length > 0 && (
          <p className="text-text-subtle mt-3 text-[13px] leading-relaxed">
            {profile.offerings.slice(0, 4).join(', ')}
            {profile.offerings.length > 4 ? '…' : ''}
          </p>
        )}

        <div className="mt-5 flex flex-wrap items-center gap-2">
          {!archived && (
            <>
              <Button asChild size="sm">
                <Link href={`/assess?profile=${profile.id}`}>Assess a market</Link>
              </Button>
              <Button asChild variant="secondary" size="sm">
                <Link href={`/profiles/${profile.id}`}>Edit</Link>
              </Button>
            </>
          )}
          <Button
            variant="ghost"
            size="sm"
            disabled={busy}
            onClick={() => void setArchived(!archived)}
          >
            {busy ? 'Working…' : archived ? 'Restore' : 'Archive'}
          </Button>
        </div>

        {failed && (
          <p role="alert" className="text-copper mt-3 text-[13px]">
            That change did not save. Try again.
          </p>
        )}
      </div>
    </Panel>
  );
}
