'use client';

import { use } from 'react';
import { PageHeader } from '@/components/dashboard/page-header';
import { Messenger } from '@/components/messages/messenger';

export default function TutorConversationPage({
  params,
}: {
  params: Promise<{ conversationId: string }>;
}) {
  const { conversationId } = use(params);

  return (
    <div className="space-y-5">
      <div className="hidden lg:block">
        <PageHeader title="Messages" />
      </div>
      <Messenger activeId={conversationId} basePath="/tutor/messages" />
    </div>
  );
}
