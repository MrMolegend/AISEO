import { DashboardShell } from '@/components/dashboard/dashboard-shell';

export default function TutorLayout({ children }: { children: React.ReactNode }) {
  return <DashboardShell role="tutor">{children}</DashboardShell>;
}
