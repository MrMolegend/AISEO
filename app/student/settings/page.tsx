'use client';

import { PageHeader } from '@/components/dashboard/page-header';
import { AccountSettings } from '@/components/dashboard/account-settings';

export default function StudentSettingsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        lead="Your details, what you hear about and how Tutor Hub looks."
      />
      <AccountSettings />
    </div>
  );
}
