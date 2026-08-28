import { DashboardShell } from '@/components/dashboard/dashboard-shell';

export default function ParentLayout({ children }: { children: React.ReactNode }) {
  return <DashboardShell role="parent">{children}</DashboardShell>;
}
