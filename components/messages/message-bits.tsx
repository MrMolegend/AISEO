'use client';

import Link from 'next/link';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  formatMessageStamp,
  formatRelativeDay,
  formatTime,
  formatTimeRange,
} from '@/lib/datetime';
import { getTutor, subjectName } from '@/lib/queries';
import { cn } from '@/lib/utils';
import type { Booking, Conversation, Message } from '@/lib/types';

/** A row in the conversation list. */
export function ConversationRow({
  conversation,
  name,
  tone,
  unread,
  active,
  href,
  onSelect,
}: {
  conversation: Conversation;
  name: string;
  tone: number;
  unread: boolean;
  active: boolean;
  href: string;
  onSelect?: () => void;
}) {
  const last = conversation.messages[conversation.messages.length - 1];
  const [first = '', surname = ''] = name.split(' ');
  const online = conversation.tutorLastSeenMins < 10;

  return (
    <li>
      <Link
        href={href}
        onClick={onSelect}
        aria-current={active ? 'true' : undefined}
        className={cn(
          'flex items-start gap-3 px-4 py-3 transition-colors duration-[var(--duration-fast)]',
          active ? 'bg-brand-subtle' : 'hover:bg-surface-sunken',
        )}
      >
        <span className="relative shrink-0">
          <Avatar firstName={first} lastName={surname} tone={tone} size="md" />
          {online && (
            <span
              className="bg-success border-surface absolute -right-0.5 -bottom-0.5 size-3 rounded-full border-2"
              aria-hidden
            />
          )}
        </span>

        <span className="min-w-0 flex-1">
          <span className="flex items-baseline justify-between gap-2">
            <span
              className={cn(
                'truncate text-sm',
                unread ? 'text-ink font-semibold' : 'text-ink font-medium',
              )}
            >
              {name}
            </span>
            {last && (
              <span className="text-ink-subtle shrink-0 text-xs">
                {formatMessageStamp(last.sentAt)}
              </span>
            )}
          </span>
          <span className="mt-0.5 flex items-center gap-2">
            <span
              className={cn(
                'line-clamp-1 flex-1 text-sm',
                unread ? 'text-ink' : 'text-ink-subtle',
              )}
            >
              {last ? last.body : 'No messages yet — say hello.'}
            </span>
            {unread && (
              <span className="bg-brand size-2 shrink-0 rounded-full" aria-hidden />
            )}
          </span>
          {online && <span className="sr-only">Recently active</span>}
          {unread && <span className="sr-only">Unread</span>}
        </span>
      </Link>
    </li>
  );
}

/** A single message. Ours on the right in cobalt, theirs on the left. */
export function MessageBubble({
  message,
  mine,
  senderName,
}: {
  message: Message;
  mine: boolean;
  senderName: string;
}) {
  return (
    <li className={cn('flex', mine ? 'justify-end' : 'justify-start')}>
      <div className={cn('max-w-[85%] sm:max-w-[70%]', mine && 'text-right')}>
        <div
          className={cn(
            'inline-block rounded-[var(--radius-card)] px-3.5 py-2.5 text-left text-sm leading-relaxed',
            mine
              ? 'bg-brand text-on-brand rounded-br-sm'
              : 'border-line bg-surface text-ink rounded-bl-sm border',
          )}
        >
          {message.body}
        </div>
        <p className="text-ink-subtle mt-1 text-[0.6875rem]">
          <span className="sr-only">{mine ? 'You' : senderName} at </span>
          {formatTime(message.sentAt)}
        </p>
      </div>
    </li>
  );
}

export function DateSeparator({ iso }: { iso: string }) {
  return (
    <li className="flex items-center gap-3 py-2">
      <span className="bg-line h-px flex-1" aria-hidden />
      <span className="text-ink-subtle text-xs font-medium">
        {formatRelativeDay(iso)}
      </span>
      <span className="bg-line h-px flex-1" aria-hidden />
    </li>
  );
}

/** The lesson a thread is about, pinned above the messages. */
export function LessonContextCard({ booking }: { booking: Booking }) {
  const tutor = getTutor(booking.tutorId);
  return (
    <div className="border-brand-line bg-brand-subtle/60 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-[var(--radius-card)] border px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="text-brand-ink text-sm font-semibold">
          {subjectName(booking.subjectId)} · {booking.level}
        </p>
        <p className="text-ink-muted tabular mt-0.5 text-sm">
          {formatRelativeDay(booking.startsAt)} ·{' '}
          {formatTimeRange(booking.startsAt, booking.durationMins)}
          {tutor ? ` · ${tutor.firstName}` : ''}
        </p>
      </div>
      <Badge tone="brand">Booking {booking.reference}</Badge>
    </div>
  );
}
