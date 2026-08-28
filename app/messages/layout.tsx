'use client';

import { DashboardShell } from '@/components/dashboard/dashboard-shell';
import { useDemo } from '@/lib/store/demo-store';

/**
 * Messages are shared by students, parents and tutors, so the shell follows
 * whoever is signed in rather than being fixed to one role.
 */
export default function MessagesLayout({ children }: { children: React.ReactNode }) {
  const { role } = useDemo();
  return (
    <DashboardShell role={role === 'admin' ? 'student' : (role ?? 'student')}>
      {children}
    </DashboardShell>
  );
}
