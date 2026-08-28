'use client';

import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { PageHeader } from '@/components/dashboard/page-header';
import { Card, CardBody } from '@/components/ui/card';
import { Select } from '@/components/ui/field';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { EmptyState, Skeleton } from '@/components/ui/states';
import { useDemo } from '@/lib/store/demo-store';
import { getAccounts, getLearners, subjectName } from '@/lib/queries';
import { ROLE_LABELS } from '@/lib/nav';
import { pluralise } from '@/lib/utils';
import type { Role } from '@/lib/types';

const ROLE_TONE: Record<Role, 'brand' | 'mint' | 'warning' | 'neutral'> = {
  student: 'brand',
  parent: 'mint',
  tutor: 'warning',
  admin: 'neutral',
};

export default function AdminUsersPage() {
  const { bookings, hydrated } = useDemo();
  const [query, setQuery] = useState('');
  const [role, setRole] = useState('all');

  const accounts = getAccounts();

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return accounts.filter((account) => {
      if (role !== 'all' && account.role !== role) return false;
      if (!needle) return true;
      return `${account.firstName} ${account.lastName} ${account.email}`
        .toLowerCase()
        .includes(needle);
    });
  }, [accounts, query, role]);

  if (!hydrated) return <Skeleton className="h-96 w-full" />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Users"
        lead="Accounts on the platform, what they are for, and the learners linked to them. Personal data beyond this is deliberately not surfaced here."
      />

      <div className="flex flex-wrap gap-2.5">
        <div className="relative min-w-56 flex-1">
          <Search
            className="text-ink-subtle pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2"
            aria-hidden
          />
          <label htmlFor="user-search" className="sr-only">
            Search users
          </label>
          <input
            id="user-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by name or email"
            className="border-line-strong bg-surface placeholder:text-ink-subtle/80 focus:border-brand h-11 w-full rounded-[var(--radius-control)] border pr-3.5 pl-10 text-sm"
          />
        </div>
        <label htmlFor="user-role" className="sr-only">
          Filter by role
        </label>
        <Select
          id="user-role"
          value={role}
          onChange={(event) => setRole(event.target.value)}
          className="w-auto min-w-44"
        >
          <option value="all">All roles</option>
          <option value="student">Students</option>
          <option value="parent">Parents</option>
          <option value="tutor">Tutors</option>
          <option value="admin">Administrators</option>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="No accounts match" body="Try a different search or role." />
      ) : (
        <Card>
          <CardBody className="p-0">
            <ul className="divide-line divide-y">
              {filtered.map((account) => {
                const theirBookings = bookings.filter(
                  (booking) => booking.bookedById === account.id,
                );
                const learners = account.role === 'parent' ? getLearners(account.id) : [];
                return (
                  <li key={account.id} className="flex flex-wrap items-center gap-4 p-4">
                    <Avatar
                      firstName={account.firstName}
                      lastName={account.lastName}
                      tone={account.avatarTone}
                      size="md"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <p className="font-medium">
                          {account.firstName} {account.lastName}
                        </p>
                        <Badge tone={ROLE_TONE[account.role]}>
                          {ROLE_LABELS[account.role]}
                        </Badge>
                      </div>
                      <p className="text-ink-subtle mt-0.5 text-sm break-all">
                        {account.email}
                      </p>
                      {account.subjects && (
                        <p className="text-ink-subtle mt-1 text-xs">
                          Studying{' '}
                          {account.subjects.map((id) => subjectName(id)).join(', ')} ·{' '}
                          {account.level}
                        </p>
                      )}
                      {learners.length > 0 && (
                        <p className="text-ink-subtle mt-1 text-xs">
                          {learners.length} linked {pluralise(learners.length, 'learner')}
                          : {learners.map((learner) => learner.firstName).join(', ')}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="tabular text-sm font-medium">
                        {theirBookings.length}
                      </p>
                      <p className="text-ink-subtle text-xs">
                        {pluralise(theirBookings.length, 'booking')}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
