'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Rule, Meta } from '@/components/ui/panel';
import { TextField } from '@/components/ui/field';
import { ALT_ROLES, ROLE_LABEL, ROLE_DESCRIPTION, type AltRole } from '@/schemas/team';

/**
 * Team management.
 *
 * The list is the truth of who can enter the workspace and as what. Edits
 * apply on the server through the membership table, so they take effect on
 * the target's next request — no sign-out required, no stale-token window.
 *
 * The current administrator's own row renders without role/revoke controls:
 * the server refuses those edits too, but a control that cannot succeed
 * should not exist.
 */

export interface MemberView {
  userId: string;
  role: AltRole;
  displayName: string;
  territories: string[];
  status: 'active' | 'revoked';
}

export function TeamManager({
  members: initialMembers,
  selfId,
  canInvite,
}: {
  members: MemberView[];
  selfId: string;
  canInvite: boolean;
}) {
  const router = useRouter();
  const [members, setMembers] = useState(initialMembers);
  const [failure, setFailure] = useState<string | null>(null);

  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [role, setRole] = useState<AltRole>('sales_rep');
  const [inviting, setInviting] = useState(false);
  const [invited, setInvited] = useState<string | null>(null);

  async function invite() {
    if (inviting) return;
    setInviting(true);
    setFailure(null);
    setInvited(null);
    try {
      const response = await fetch('/api/team', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, displayName, role, territories: [] }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        const issue = payload?.issues?.[0]?.message ?? payload?.message;
        setFailure(issue ?? 'The invitation could not be saved. Try again.');
        return;
      }
      setInvited(`${displayName} now has ${ROLE_LABEL[role]} access.`);
      setEmail('');
      setDisplayName('');
      setMembers((current) => {
        const next = current.filter((m) => m.userId !== payload.member.userId);
        return [...next, payload.member as MemberView];
      });
      router.refresh();
    } catch {
      setFailure('We could not reach the server. Check your connection and try again.');
    } finally {
      setInviting(false);
    }
  }

  async function patch(userId: string, body: Record<string, unknown>) {
    setFailure(null);
    const response = await fetch(`/api/team/${userId}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      setFailure(payload?.message ?? 'The change could not be saved.');
      return;
    }
    setMembers((current) =>
      current.map((m) => (m.userId === userId ? (payload.member as MemberView) : m)),
    );
    router.refresh();
  }

  return (
    <div>
      {failure && (
        <p role="alert" className="text-copper mb-6 text-[14px] leading-relaxed">
          {failure}
        </p>
      )}

      <ul className="border-rule divide-rule divide-y border">
        {members.map((member) => {
          const isSelf = member.userId === selfId;
          return (
            <li
              key={member.userId}
              className="flex flex-wrap items-center gap-x-6 gap-y-3 px-5 py-4"
            >
              <div className="min-w-0 flex-1">
                <p className="text-text truncate text-[14px] font-medium">
                  {member.displayName}
                  {isSelf && <span className="text-text-subtle"> (you)</span>}
                </p>
                <p className="text-text-subtle mt-0.5 text-[12px]">
                  {member.territories.length > 0
                    ? member.territories.join(', ')
                    : 'All territories'}
                </p>
              </div>

              {member.status === 'revoked' ? (
                <span className="text-copper text-[12px] font-medium tracking-wide uppercase">
                  Revoked
                </span>
              ) : (
                <span className="text-text-muted text-[13px]">
                  {ROLE_LABEL[member.role]}
                </span>
              )}

              {canInvite && !isSelf && (
                <div className="flex items-center gap-2">
                  <label className="sr-only" htmlFor={`role-${member.userId}`}>
                    Role for {member.displayName}
                  </label>
                  <select
                    id={`role-${member.userId}`}
                    value={member.role}
                    disabled={member.status === 'revoked'}
                    onChange={(event) =>
                      void patch(member.userId, { role: event.target.value })
                    }
                    className="border-rule-strong bg-ground-raised text-text border px-2 py-1.5 text-[13px] disabled:opacity-50"
                  >
                    {ALT_ROLES.map((r) => (
                      <option key={r} value={r}>
                        {ROLE_LABEL[r]}
                      </option>
                    ))}
                  </select>
                  {member.status === 'active' ? (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => void patch(member.userId, { status: 'revoked' })}
                    >
                      Revoke
                    </Button>
                  ) : (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => void patch(member.userId, { status: 'active' })}
                    >
                      Restore
                    </Button>
                  )}
                </div>
              )}
            </li>
          );
        })}
        {members.length === 0 && (
          <li className="text-text-muted px-5 py-8 text-center text-[14px]">
            No members yet. The first invitation below creates one.
          </li>
        )}
      </ul>

      {canInvite && (
        <>
          <Rule label="Invite a member" className="mt-12" />
          <form
            className="mt-6 max-w-xl space-y-6"
            onSubmit={(event) => {
              event.preventDefault();
              void invite();
            }}
            noValidate
          >
            <TextField
              label="Email"
              name="inviteEmail"
              required
              value={email}
              onChange={setEmail}
              hint="They sign in with this address; membership takes effect on their next request."
            />
            <TextField
              label="Display name"
              name="inviteName"
              required
              value={displayName}
              onChange={setDisplayName}
            />
            <div>
              <label
                htmlFor="invite-role"
                className="text-text mb-2 block text-[13px] font-medium"
              >
                Role
              </label>
              <select
                id="invite-role"
                value={role}
                onChange={(event) => setRole(event.target.value as AltRole)}
                className="border-rule-strong bg-ground-raised text-text border px-3 py-2.5 text-[14px]"
              >
                {ALT_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABEL[r]}
                  </option>
                ))}
              </select>
              <p className="text-text-subtle mt-2 text-[12px] leading-relaxed">
                {ROLE_DESCRIPTION[role]}
              </p>
            </div>

            {invited && (
              <p role="status" className="text-text-muted text-[14px]">
                {invited}
              </p>
            )}

            <div className="flex items-center gap-3">
              <Button type="submit" disabled={inviting}>
                {inviting ? 'Inviting…' : 'Invite member'}
              </Button>
              <Meta aria-hidden="true">Invitation-only workspace</Meta>
            </div>
          </form>
        </>
      )}
    </div>
  );
}
