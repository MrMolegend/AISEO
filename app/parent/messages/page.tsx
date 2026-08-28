'use client';

import { PageHeader } from '@/components/dashboard/page-header';
import { Messenger } from '@/components/messages/messenger';

export default function ParentMessagesPage() {
  return (
    <div className="space-y-5">
      <PageHeader
        title="Messages"
        lead="Your own conversations with tutors. Your children's private threads stay on their accounts."
      />
      <Messenger activeId={null} basePath="/parent/messages" />
    </div>
  );
}
