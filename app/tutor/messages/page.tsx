'use client';

import { PageHeader } from '@/components/dashboard/page-header';
import { Messenger } from '@/components/messages/messenger';

export default function TutorMessagesPage() {
  return (
    <div className="space-y-5">
      <PageHeader
        title="Messages"
        lead="Questions between lessons, and the context of the booking each thread belongs to."
      />
      <Messenger activeId={null} basePath="/tutor/messages" />
    </div>
  );
}
