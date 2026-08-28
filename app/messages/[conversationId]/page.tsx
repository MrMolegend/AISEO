'use client';

import { use } from 'react';
import { PageHeader } from '@/components/dashboard/page-header';
import { Messenger } from '@/components/messages/messenger';

export default function ConversationPage({
  params,
}: {
  params: Promise<{ conversationId: string }>;
}) {
  const { conversationId } = use(params);

  return (
    <div className="space-y-5">
      <div className="hidden lg:block">
        <PageHeader
          title="Messages"
          lead="Everything you have discussed with a tutor, kept in one place alongside the lesson it relates to."
        />
      </div>
      <Messenger activeId={conversationId} />
    </div>
  );
}
