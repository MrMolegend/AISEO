import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { SiteHeader } from '@/components/layout/site-header';
import { SiteFooter } from '@/components/layout/site-footer';
import { AssessmentForm } from '@/components/assess/assessment-form';
import { Meta } from '@/components/ui/panel';
import { BRAND, pageTitle } from '@/config/brand';
import { creditsFrom } from '@/config/report';
import { getCurrentUser, signInPath } from '@/lib/auth/server';
import { getTokenWallet } from '@/lib/tokens';
import { getResearchJobStore } from '@/lib/jobs/store';
import { marketEntryInputSchema } from '@/schemas/market-entry/input';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: pageTitle('Assess a market'),
  description: BRAND.description,
  robots: { index: false, follow: false },
};

/**
 * The intake.
 *
 * The balance is resolved on the server and handed down as a count of report
 * credits. The client component never sees a token figure, which is the whole
 * point of doing the conversion here: there is no number in the browser for a
 * future change to accidentally render.
 */
export default async function AssessPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; profile?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect(signInPath('/assess'));

  const wallet = await getTokenWallet();
  const balance = await wallet.getBalance(user.id);

  /*
   * A brief seeded from a business profile.
   *
   * The profile prefills ordinary editable fields and rides along as a
   * reference so the finished report joins that profile's version history.
   * Owner-filtered: someone else's profile id seeds nothing.
   */
  const profileParam = (await searchParams).profile;
  let profileId: string | null = null;
  let profileName: string | null = null;
  let profileDefaults: Record<string, unknown> | null = null;

  if (profileParam) {
    const { getBusinessProfileStore } = await import('@/lib/profiles/store');
    const { profileToBriefDefaults } = await import('@/lib/profiles/prefill');
    const profile = await (
      await getBusinessProfileStore()
    )
      .getForUser(profileParam, user.id)
      .catch(() => null);
    if (profile && !profile.archivedAt) {
      profileId = profile.id;
      profileName = profile.name;
      profileDefaults = profileToBriefDefaults(profile);
    }
  }

  /*
   * "Edit and try again", after an assessment we could not complete.
   *
   * The browser draft was cleared when the job was accepted, so without this a
   * customer whose report failed would retype four stages to change one answer.
   * Owner-scoped: the lookup filters on the user id, so a public id belonging
   * to someone else returns nothing rather than seeding their brief into this
   * form. Money comes back as minor units and is turned back into what they
   * typed, or the price would grow by a factor of a hundred on every retry.
   */
  const from = (await searchParams).from;
  let initial: Record<string, unknown> | null = null;

  if (from) {
    const store = await getResearchJobStore();
    const previous = await store.getForUser(from, user.id);
    const parsed = previous ? marketEntryInputSchema.safeParse(previous.input) : null;
    if (parsed?.success) {
      const input = parsed.data;
      const asTyped = (minor: number | null) =>
        minor === null ? '' : (minor / 100).toFixed(2);
      initial = {
        ...input,
        currentPrice: asTyped(input.currentPrice),
        unitCost: asTyped(input.unitCost),
        targetPrice: asTyped(input.targetPrice),
        launchBudget: asTyped(input.launchBudget),
        minimumOrderQuantity: input.minimumOrderQuantity ?? '',
      };
    }
  }

  // A profile seed only applies to a fresh brief — a retry keeps its answers.
  if (!initial && profileDefaults) {
    initial = profileDefaults;
  }

  /*
   * With no seed of either kind, offer the most recent saved draft. Resolved
   * here rather than fetched from the browser so the form renders with the
   * draft already in it — no flash of an empty form, no client round-trip.
   */
  let serverDraft: {
    id: string;
    revision: number;
    payload: Record<string, unknown>;
    profileId: string | null;
  } | null = null;

  if (!initial) {
    const { getResearchDraftStore } = await import('@/lib/drafts/store');
    const draft = await (
      await getResearchDraftStore()
    )
      .latestActive(user.id)
      .catch(() => null);
    if (draft) {
      serverDraft = {
        id: draft.id,
        revision: draft.revision,
        payload: draft.payload,
        profileId: draft.profileId,
      };
    }
  }

  return (
    <>
      <SiteHeader />

      <main
        id="main"
        className="mx-auto max-w-[var(--container-narrow)] px-5 py-12 md:py-16"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <Meta>Market entry assessment</Meta>
          <Meta>
            {creditsFrom(balance.available)}{' '}
            {creditsFrom(balance.available) === 1
              ? BRAND.credit.singular
              : BRAND.credit.plural}{' '}
            available
          </Meta>
        </div>

        <h1 className="font-display text-text mt-4 text-[34px] leading-[1.08] tracking-[var(--tracking-display)] md:text-[42px]">
          Tell us what you sell, and where you want to take it.
        </h1>
        {profileName && (
          <p role="status" className="text-text-subtle mt-3 text-[13px]">
            Prefilled from your <strong className="text-text">{profileName}</strong>{' '}
            profile. Everything is editable — changes here never write back to the
            profile.
          </p>
        )}
        <p className="text-text-muted measure mt-4 text-[16px] leading-relaxed">
          Four short stages. We do not ask for a website — what you sell is something you
          can describe better than a homepage can.
        </p>

        <div className="mt-12">
          <AssessmentForm
            userId={user.id}
            credits={creditsFrom(balance.available)}
            initialValues={initial}
            profileId={profileId}
            serverDraft={serverDraft}
          />
        </div>

        <p className="text-text-faint mt-12 text-[13px]">
          <Link
            href="/methodology"
            className="text-cobalt underline-offset-4 hover:underline"
          >
            How the research works
          </Link>
        </p>
      </main>

      <SiteFooter />
    </>
  );
}
