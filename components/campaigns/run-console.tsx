'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Panel, Rule, Meta } from '@/components/ui/panel';
import {
  RUN_STAGES,
  RUN_STAGE_LABEL,
  CAMPAIGN_STATUS_LABEL,
  type CampaignStatus,
  type RunStage,
} from '@/schemas/campaign';

/**
 * The run console: preview, confirm, watch, cancel.
 *
 * The stage list shows named, truthful stages — never a percentage,
 * because a twelve-search discovery phase and a quality gate have no
 * comparable unit of work between them. While a run is live the console
 * polls the campaign endpoint; when it settles, it refreshes the page so
 * the server-rendered results take over.
 */

export interface PreviewView {
  estimate: {
    candidateSearches: number;
    fitSearches: number;
    contactSearches: number;
    planned: number;
    chargeableCeiling: number;
    budgetUnits: number;
    clipped: boolean;
  };
  perCampaignCap: number;
  perDayCap: number;
  spentToday: number;
  startable: boolean;
  blockedReason: string | null;
}

export interface RunView {
  id: string;
  status: 'queued' | 'running' | 'completed' | 'partial' | 'failed' | 'cancelled';
  stage: RunStage;
  errorCode: string | null;
  unitsBudget: number;
  unitsSpent: number;
  accountsFound: number;
  accountsQualified: number;
  contactsFound: number;
}

export function RunConsole({
  campaignId,
  campaignStatus,
  initialRun,
  preview,
  canManage,
}: {
  campaignId: string;
  campaignStatus: CampaignStatus;
  initialRun: RunView | null;
  preview: PreviewView | null;
  canManage: boolean;
}) {
  const router = useRouter();
  const [run, setRun] = useState<RunView | null>(initialRun);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const live = run !== null && ['queued', 'running'].includes(run.status);
  const settledOnce = useRef(false);

  useEffect(() => {
    if (!live) return;
    const interval = window.setInterval(() => {
      void (async () => {
        try {
          const response = await fetch(`/api/campaigns/${campaignId}`);
          if (!response.ok) return;
          const payload = await response.json();
          const next = payload.run as RunView | null;
          setRun(next);
          if (next && !['queued', 'running'].includes(next.status)) {
            if (!settledOnce.current) {
              settledOnce.current = true;
              router.refresh();
            }
          }
        } catch {
          // A missed poll is just a missed poll.
        }
      })();
    }, 2_500);
    return () => window.clearInterval(interval);
  }, [live, campaignId, router]);

  async function start() {
    if (busy) return;
    setBusy(true);
    setFailure(null);
    try {
      const response = await fetch(`/api/campaigns/${campaignId}/start`, {
        method: 'POST',
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        setFailure(payload?.message ?? 'The research could not be started.');
        return;
      }
      setRun(payload.run as RunView);
      settledOnce.current = false;
    } catch {
      setFailure('We could not reach the server. Try again.');
    } finally {
      setBusy(false);
    }
  }

  async function cancel() {
    setFailure(null);
    const response = await fetch(`/api/campaigns/${campaignId}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'cancel' }),
    });
    if (response.ok) {
      router.refresh();
    } else {
      const payload = await response.json().catch(() => null);
      setFailure(payload?.message ?? 'The run could not be cancelled.');
    }
  }

  if (live && run) {
    const currentIndex = RUN_STAGES.indexOf(run.stage);
    return (
      <Panel className="mt-8 p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Meta role="status">Research in progress</Meta>
          <Meta data-numeric>
            {run.unitsSpent} / {run.unitsBudget} units
          </Meta>
        </div>
        <ol className="mt-5 space-y-2" aria-label="Research stages">
          {RUN_STAGES.filter((stage) => stage !== 'done').map((stage, index) => {
            const state =
              index < currentIndex ? 'done' : index === currentIndex ? 'now' : 'ahead';
            return (
              <li key={stage} className="flex items-center gap-3">
                <span
                  aria-hidden="true"
                  className={
                    state === 'done'
                      ? 'bg-signal h-1.5 w-1.5'
                      : state === 'now'
                        ? 'bg-signal h-2.5 w-2.5 animate-pulse'
                        : 'bg-rule h-1.5 w-1.5'
                  }
                />
                <span
                  className={
                    state === 'ahead'
                      ? 'text-text-subtle text-[13px]'
                      : 'text-text text-[13px]'
                  }
                >
                  {RUN_STAGE_LABEL[stage]}
                  {state === 'now' && <span className="sr-only"> — current stage</span>}
                </span>
              </li>
            );
          })}
        </ol>
        {canManage && (
          <div className="mt-6">
            <Button variant="secondary" size="sm" onClick={() => void cancel()}>
              Cancel the research
            </Button>
          </div>
        )}
        {failure && (
          <p role="alert" className="text-copper mt-4 text-[14px]">
            {failure}
          </p>
        )}
      </Panel>
    );
  }

  return (
    <div className="mt-8">
      {run && (
        <Panel className="p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <Meta>
              Last run —{' '}
              {CAMPAIGN_STATUS_LABEL[run.status as CampaignStatus] ?? run.status}
            </Meta>
            <Meta data-numeric>
              {run.unitsSpent} unit{run.unitsSpent === 1 ? '' : 's'} spent
            </Meta>
          </div>
          <dl className="mt-4 grid grid-cols-3 gap-4">
            <div>
              <dt className="text-text-subtle text-[12px]">Accounts found</dt>
              <dd className="text-text mt-1 text-2xl font-medium" data-numeric>
                {run.accountsFound}
              </dd>
            </div>
            <div>
              <dt className="text-text-subtle text-[12px]">Qualified</dt>
              <dd className="text-text mt-1 text-2xl font-medium" data-numeric>
                {run.accountsQualified}
              </dd>
            </div>
            <div>
              <dt className="text-text-subtle text-[12px]">Contacts</dt>
              <dd className="text-text mt-1 text-2xl font-medium" data-numeric>
                {run.contactsFound}
              </dd>
            </div>
          </dl>
          {run.status === 'failed' && (
            <p className="text-copper mt-4 text-[13px]">
              The run stopped before finishing
              {run.errorCode ? ` (${run.errorCode})` : ''}. Starting again reuses the
              evidence already gathered rather than paying for it twice.
            </p>
          )}
          {run.status === 'partial' && (
            <p className="text-text-muted mt-4 text-[13px]">
              The budget ceiling was reached before the plan finished. What was gathered
              is real and kept; raise the budget and run again to continue.
            </p>
          )}
          <div className="mt-5">
            <Button asChild variant="secondary" size="sm">
              <Link href={`/leads?campaign=${campaignId}`}>
                See the accounts in the lead explorer
              </Link>
            </Button>
          </div>
        </Panel>
      )}

      {canManage && preview && campaignStatus !== 'archived' && (
        <>
          <Rule label={run ? 'Run again' : 'Cost preview'} className="mt-10" />
          <Panel className="mt-5 p-6">
            <dl className="grid grid-cols-2 gap-x-8 gap-y-3 sm:grid-cols-4">
              <div>
                <dt className="text-text-subtle text-[12px]">Candidate searches</dt>
                <dd className="text-text mt-1 text-lg font-medium" data-numeric>
                  {preview.estimate.candidateSearches}
                </dd>
              </div>
              <div>
                <dt className="text-text-subtle text-[12px]">Fit searches (max)</dt>
                <dd className="text-text mt-1 text-lg font-medium" data-numeric>
                  {preview.estimate.fitSearches}
                </dd>
              </div>
              <div>
                <dt className="text-text-subtle text-[12px]">Contact searches (max)</dt>
                <dd className="text-text mt-1 text-lg font-medium" data-numeric>
                  {preview.estimate.contactSearches}
                </dd>
              </div>
              <div>
                <dt className="text-text-subtle text-[12px]">Ceiling this run</dt>
                <dd className="text-text mt-1 text-lg font-medium" data-numeric>
                  {preview.estimate.chargeableCeiling} units
                </dd>
              </div>
            </dl>
            <p className="text-text-subtle mt-4 text-[12px]" data-numeric>
              Today&rsquo;s workspace spend so far: {preview.spentToday} of{' '}
              {preview.perDayCap} units.
              {preview.estimate.clipped &&
                ' The plan exceeds this campaign’s budget, so the run will stop at the ceiling and finish as partial.'}
            </p>
            {preview.blockedReason && (
              <p role="alert" className="text-copper mt-3 text-[13px]">
                {preview.blockedReason}
              </p>
            )}
            {failure && (
              <p role="alert" className="text-copper mt-3 text-[13px]">
                {failure}
              </p>
            )}
            <div className="mt-5 flex items-center gap-3">
              <Button onClick={() => void start()} disabled={busy || !preview.startable}>
                {busy
                  ? 'Starting…'
                  : `Confirm and spend up to ${preview.estimate.chargeableCeiling} units`}
              </Button>
            </div>
          </Panel>
        </>
      )}
    </div>
  );
}
