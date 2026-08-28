'use client';

import { PageHeader } from '@/components/dashboard/page-header';
import { Messenger } from '@/components/messages/messenger';

export default function MessagesPage() {
  return (
    <div className="space-y-5">
      <PageHeader
        title="Messages"
        lead="Everything you have discussed with a tutor, kept in one place alongside the lesson it relates to."
      />
      <Messenger activeId={null} />
    </div>
  );
}
