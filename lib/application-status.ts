import type { ApplicationStatus, ReportStatus } from '@/lib/types';

type Tone = 'neutral' | 'brand' | 'mint' | 'success' | 'warning' | 'danger' | 'info';

export const APPLICATION_STATUS: Record<
  ApplicationStatus,
  { label: string; tone: Tone }
> = {
  'under-review': { label: 'Under review', tone: 'warning' },
  'information-requested': { label: 'Information requested', tone: 'info' },
  approved: { label: 'Approved', tone: 'success' },
  rejected: { label: 'Declined', tone: 'danger' },
};

export const REPORT_STATUS: Record<ReportStatus, { label: string; tone: Tone }> = {
  open: { label: 'Open', tone: 'warning' },
  investigating: { label: 'Investigating', tone: 'info' },
  resolved: { label: 'Resolved', tone: 'success' },
  escalated: { label: 'Escalated', tone: 'danger' },
};
