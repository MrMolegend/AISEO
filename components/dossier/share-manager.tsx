'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Panel, Rule, Meta } from '@/components/ui/panel';
import { TextField } from '@/components/ui/field';

/**
 * The owner's share manager.
 *
 * Minting shows the link once, plainly labelled as the only time it will be
 * shown — the server keeps a hash, not the token, so there is nothing to
 * re-display later. The list below is live and revoked links with their
 * usage, which answers the owner's real questions: who still has access, has
 * it been used, and how do I stop it.
 */

interface ShareRow {
  id: string;
  label: string | null;
  allowDownload: boolean;
  expiresAt: string | null;
  revokedAt: string | null;
  createdAt: string;
  lastUsedAt: string | null;
  useCount: number;
}

function dateLabel(iso: string | null): string {
  if (!iso) return '—';
  const parsed = new Date(iso);
  return Number.isNaN(parsed.getTime())
    ? iso
    : parsed.toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
}

export function ShareManager({
  publicId,
  initialShares,
}: {
  publicId: string;
  initialShares: ShareRow[];
}) {
  const [shares, setShares] = useState<ShareRow[]>(initialShares);
  const [label, setLabel] = useState('');
  const [expiresInDays, setExpiresInDays] = useState('30');
  const [allowDownload, setAllowDownload] = useState(false);
  const [mintedUrl, setMintedUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Captured once at mount: expiry display only needs to be right to the
  // page-load, and calling Date.now() mid-render trips the compiler's purity
  // rule for good reason.
  const [now] = useState(() => Date.now());

  async function mint() {
    if (busy) return;
    setBusy(true);
    setNotice(null);
    setMintedUrl(null);
    try {
      const days = Number(expiresInDays.trim());
      const response = await fetch(`/api/research/${publicId}/shares`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          label: label.trim() || null,
          expiresInDays: Number.isInteger(days) && days >= 1 ? days : null,
          allowDownload,
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        setNotice(payload?.message ?? 'The link could not be created.');
        return;
      }
      setShares((previous) => [payload.share as ShareRow, ...previous]);
      setMintedUrl(payload.url as string);
      setLabel('');
    } catch {
      setNotice('We could not reach the server. Nothing was created.');
    } finally {
      setBusy(false);
    }
  }

  async function revoke(id: string) {
    try {
      const response = await fetch(`/api/shares/${id}`, { method: 'DELETE' });
      if (response.ok) {
        setShares((previous) =>
          previous.map((share) =>
            share.id === id ? { ...share, revokedAt: new Date().toISOString() } : share,
          ),
        );
      } else {
        setNotice('That link could not be revoked. Try again.');
      }
    } catch {
      setNotice('We could not reach the server.');
    }
  }

  return (
    <div>
      {/* ── Mint ───────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-end gap-4">
        <div className="min-w-[220px] flex-1">
          <TextField
            label="Who is this for?"
            name="shareLabel"
            value={label}
            onChange={setLabel}
            placeholder="The Dubai distributor"
            hint="A note to yourself, shown only to you."
          />
        </div>
        <div className="w-36">
          <TextField
            label="Expires after (days)"
            name="shareExpiry"
            inputMode="numeric"
            value={expiresInDays}
            onChange={setExpiresInDays}
            hint="Blank = until revoked."
          />
        </div>
        <label className="flex cursor-pointer items-center gap-2 pb-7 text-[14px]">
          <input
            type="checkbox"
            checked={allowDownload}
            onChange={(event) => setAllowDownload(event.target.checked)}
            className="accent-signal h-4 w-4"
          />
          <span className="text-text">Allow CSV download</span>
        </label>
        <div className="pb-5">
          <Button onClick={() => void mint()} disabled={busy}>
            {busy ? 'Creating…' : 'Create share link'}
          </Button>
        </div>
      </div>

      {mintedUrl && (
        <Panel edge="signal" className="mt-4">
          <div className="p-4">
            <Meta>Your new link — shown this once</Meta>
            <p className="text-text-muted mt-1 text-[13px] leading-relaxed">
              We keep only a fingerprint of it, so it cannot be shown again. Copy it now;
              if it is lost, revoke it and mint another.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <code className="bg-ground-raised border-rule text-text min-w-0 flex-1 overflow-x-auto border px-3 py-2 text-[12px] break-all">
                {mintedUrl}
              </code>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  void navigator.clipboard
                    .writeText(mintedUrl)
                    .then(() => {
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2400);
                    })
                    .catch(() => {});
                }}
              >
                {copied ? 'Copied' : 'Copy link'}
              </Button>
            </div>
          </div>
        </Panel>
      )}

      {notice && (
        <p role="alert" className="text-copper mt-4 text-[13px]">
          {notice}
        </p>
      )}

      {/* ── The register ───────────────────────────────────────────────── */}
      <Rule label="Links for this report" className="mt-10" />
      {shares.length === 0 ? (
        <p className="text-text-faint mt-4 text-[13px]">
          No links yet. This report is visible to you alone.
        </p>
      ) : (
        <ul className="mt-4 space-y-2">
          {shares.map((share) => {
            const expired =
              share.expiresAt !== null && new Date(share.expiresAt).getTime() <= now;
            const state = share.revokedAt ? 'Revoked' : expired ? 'Expired' : 'Live';
            return (
              <li
                key={share.id}
                className="border-rule flex flex-wrap items-center gap-x-4 gap-y-1 border p-3"
              >
                <span
                  className={
                    state === 'Live'
                      ? 'text-signal w-16 shrink-0 text-[12px] tracking-wide uppercase'
                      : 'text-text-faint w-16 shrink-0 text-[12px] tracking-wide uppercase'
                  }
                >
                  {state}
                </span>
                <span className="text-text min-w-0 flex-1 text-[14px]">
                  {share.label ?? 'Unlabelled link'}
                  {share.allowDownload && (
                    <span className="text-text-subtle text-[12px]"> · downloads on</span>
                  )}
                </span>
                <span className="text-text-subtle text-[12px]" data-numeric>
                  created {dateLabel(share.createdAt)}
                  {share.expiresAt && ` · expires ${dateLabel(share.expiresAt)}`}
                  {` · opened ${share.useCount} ${share.useCount === 1 ? 'time' : 'times'}`}
                  {share.lastUsedAt && `, last ${dateLabel(share.lastUsedAt)}`}
                </span>
                {state === 'Live' && (
                  <Button variant="ghost" size="sm" onClick={() => void revoke(share.id)}>
                    Revoke
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
