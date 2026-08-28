'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  CalendarPlus,
  Info,
  MessageSquare,
  Paperclip,
  Search,
  Send,
  UserRound,
} from 'lucide-react';
import { Avatar } from '@/components/ui/avatar';
import { Button, ButtonLink } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/states';
import {
  ConversationRow,
  DateSeparator,
  LessonContextCard,
  MessageBubble,
} from './message-bits';
import { useDemo } from '@/lib/store/demo-store';
import { useToast } from '@/lib/store/toast';
import { getAccount, getLearner, getTutor, subjectName } from '@/lib/queries';
import { formatTimeRange, formatRelativeDay } from '@/lib/datetime';
import { formatResponseTime } from '@/lib/utils';
import type { Conversation } from '@/lib/types';

/**
 * The whole messaging surface.
 *
 * One component drives both `/messages` and `/messages/[id]`: on desktop the
 * list and the thread sit side by side, on mobile they are separate screens and
 * the route decides which one is showing.
 */
export function Messenger({
  activeId,
  basePath = '/messages',
}: {
  activeId: string | null;
  basePath?: string;
}) {
  const {
    account,
    conversations,
    hydrated,
    sendMessage,
    markConversationRead,
    isConversationUnread,
    bookings,
  } = useDemo();
  const { toast } = useToast();
  const router = useRouter();

  const [query, setQuery] = useState('');
  const [draft, setDraft] = useState('');
  const threadRef = useRef<HTMLDivElement>(null);

  const viewerIsTutor = account?.role === 'tutor';
  const viewerId = viewerIsTutor ? (account?.tutorId ?? '') : (account?.id ?? '');

  const mine = useMemo(() => {
    if (!account) return [];
    return conversations.filter((conversation) =>
      viewerIsTutor
        ? conversation.tutorId === account.tutorId
        : conversation.memberId === account.id,
    );
  }, [conversations, account, viewerIsTutor]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return mine;
    return mine.filter((conversation) => {
      const name = counterpartName(conversation, viewerIsTutor).toLowerCase();
      const body = conversation.messages
        .map((m) => m.body)
        .join(' ')
        .toLowerCase();
      return name.includes(needle) || body.includes(needle);
    });
  }, [mine, query, viewerIsTutor]);

  const active = activeId ? mine.find((c) => c.id === activeId) : undefined;
  const activeTutor = getTutor(active?.tutorId);
  const activeBooking = active?.bookingId
    ? bookings.find((b) => b.id === active.bookingId)
    : undefined;

  useEffect(() => {
    if (active) markConversationRead(active.id);
  }, [active, markConversationRead]);

  useEffect(() => {
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight });
  }, [active?.messages.length, activeId]);

  function onSend(event: React.FormEvent) {
    event.preventDefault();
    const body = draft.trim();
    if (!body || !active) return;
    sendMessage(active.id, body);
    setDraft('');
  }

  if (!hydrated) {
    return (
      <div className="text-ink-subtle p-8 text-center text-sm">Loading messages…</div>
    );
  }

  if (!account) {
    return (
      <div className="p-6">
        <EmptyState
          icon={<MessageSquare className="size-6" aria-hidden />}
          title="Sign in to see your messages"
          body="Messages are tied to an account. Pick a demo role and your example conversations will be waiting."
          action={{ label: 'Choose a demo role', href: '/sign-in?next=/messages' }}
        />
      </div>
    );
  }

  return (
    <div className="border-line bg-surface overflow-hidden rounded-[var(--radius-panel)] border">
      <div className="lg:grid lg:h-[calc(100dvh-11rem)] lg:grid-cols-[20rem_minmax(0,1fr)] xl:grid-cols-[20rem_minmax(0,1fr)_17rem]">
        {/* ── Conversation list ────────────────────────────────────────── */}
        <div
          className={`border-line flex min-h-0 flex-col lg:border-r ${active ? 'hidden lg:flex' : 'flex'}`}
        >
          <div className="border-line border-b p-3">
            <div className="relative">
              <Search
                className="text-ink-subtle pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
                aria-hidden
              />
              <label htmlFor="conversation-search" className="sr-only">
                Search conversations
              </label>
              <input
                id="conversation-search"
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search conversations"
                className="border-line-strong bg-surface placeholder:text-ink-subtle/80 focus:border-brand h-10 w-full rounded-[var(--radius-control)] border pr-3 pl-9 text-sm"
              />
            </div>
          </div>

          {filtered.length === 0 ? (
            <p className="text-ink-subtle p-6 text-center text-sm">
              {query
                ? 'No conversations match that search.'
                : 'No conversations yet. Message a tutor from their profile to start one.'}
            </p>
          ) : (
            <ul className="divide-line min-h-0 flex-1 divide-y overflow-y-auto">
              {filtered.map((conversation) => (
                <ConversationRow
                  key={conversation.id}
                  conversation={conversation}
                  name={counterpartName(conversation, viewerIsTutor)}
                  tone={counterpartTone(conversation, viewerIsTutor)}
                  unread={isConversationUnread(conversation)}
                  active={conversation.id === activeId}
                  href={`${basePath}/${conversation.id}`}
                />
              ))}
            </ul>
          )}
        </div>

        {/* ── Thread ───────────────────────────────────────────────────── */}
        <div className={`flex min-h-0 flex-col ${active ? 'flex' : 'hidden lg:flex'}`}>
          {!active ? (
            <div className="flex flex-1 items-center justify-center p-8">
              <div className="max-w-sm text-center">
                <span className="bg-brand-subtle text-brand mx-auto mb-4 flex size-12 items-center justify-center rounded-[var(--radius-card)]">
                  <MessageSquare className="size-6" aria-hidden />
                </span>
                <h2 className="text-base font-semibold">Choose a conversation</h2>
                <p className="text-ink-subtle mt-1.5 text-sm leading-relaxed">
                  Pick a thread on the left, or message a tutor from their profile to
                  start a new one.
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="border-line flex items-center gap-3 border-b px-4 py-3">
                <Link
                  href={basePath}
                  className="text-ink-muted hover:bg-surface-sunken -ml-2 flex size-10 items-center justify-center rounded-[var(--radius-control)] lg:hidden"
                >
                  <ArrowLeft className="size-5" aria-hidden />
                  <span className="sr-only">Back to conversations</span>
                </Link>

                <Avatar
                  firstName={counterpartName(active, viewerIsTutor).split(' ')[0] ?? ''}
                  lastName={counterpartName(active, viewerIsTutor).split(' ')[1] ?? ''}
                  tone={counterpartTone(active, viewerIsTutor)}
                  size="sm"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">
                    {counterpartName(active, viewerIsTutor)}
                  </p>
                  <p className="text-ink-subtle text-xs">
                    {describeLastSeen(active.tutorLastSeenMins)}
                  </p>
                </div>

                {activeTutor && !viewerIsTutor && (
                  <ButtonLink
                    href={`/tutors/${activeTutor.slug}`}
                    variant="ghost"
                    size="sm"
                    className="hidden sm:inline-flex"
                  >
                    <UserRound className="size-4" aria-hidden />
                    Profile
                  </ButtonLink>
                )}
              </div>

              <div ref={threadRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
                {activeBooking && (
                  <div className="mb-4">
                    <LessonContextCard booking={activeBooking} />
                  </div>
                )}

                {active.messages.length === 0 ? (
                  <p className="text-ink-subtle py-8 text-center text-sm">
                    No messages yet. Introduce yourself and say what you would like help
                    with.
                  </p>
                ) : (
                  <ul className="space-y-2.5">
                    {active.messages.flatMap((message, index) => {
                      const previous = active.messages[index - 1];
                      const newDay =
                        !previous ||
                        message.sentAt.slice(0, 10) !== previous.sentAt.slice(0, 10);
                      const bubble = (
                        <MessageBubble
                          key={message.id}
                          message={message}
                          mine={message.senderId === viewerId}
                          senderName={counterpartName(active, viewerIsTutor)}
                        />
                      );
                      return newDay
                        ? [
                            <DateSeparator
                              key={`${message.id}-day`}
                              iso={message.sentAt}
                            />,
                            bubble,
                          ]
                        : [bubble];
                    })}
                  </ul>
                )}
              </div>

              <form onSubmit={onSend} className="border-line border-t p-3">
                <div className="flex items-end gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      toast({
                        title: 'Attachments are not connected yet',
                        description:
                          'File uploads will use Supabase Storage in the live product.',
                        tone: 'info',
                      })
                    }
                    className="border-line-strong text-ink-muted hover:text-ink flex size-11 shrink-0 items-center justify-center rounded-[var(--radius-control)] border"
                  >
                    <Paperclip className="size-[18px]" aria-hidden />
                    <span className="sr-only">
                      Attach a file — not connected in this demo
                    </span>
                  </button>

                  <label htmlFor="message-input" className="sr-only">
                    Write a message
                  </label>
                  <textarea
                    id="message-input"
                    rows={1}
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' && !event.shiftKey) {
                        event.preventDefault();
                        onSend(event);
                      }
                    }}
                    placeholder="Write a message"
                    className="border-line-strong bg-surface placeholder:text-ink-subtle/80 focus:border-brand max-h-32 min-h-11 flex-1 resize-none rounded-[var(--radius-control)] border px-3.5 py-3 text-sm"
                  />

                  <Button
                    type="submit"
                    disabled={!draft.trim()}
                    className="shrink-0 px-4"
                  >
                    <Send className="size-[18px]" aria-hidden />
                    <span className="sr-only">Send message</span>
                  </Button>
                </div>
              </form>
            </>
          )}
        </div>

        {/* ── Details panel (wide desktop) ────────────────────────────── */}
        <aside className="border-line hidden min-h-0 overflow-y-auto border-l p-4 xl:block">
          {active && activeTutor ? (
            <div>
              <div className="text-center">
                <Avatar
                  firstName={activeTutor.firstName}
                  lastName={activeTutor.lastName}
                  tone={activeTutor.avatarTone}
                  size="xl"
                  className="mx-auto"
                />
                <p className="mt-3 font-semibold">
                  {activeTutor.firstName} {activeTutor.lastName}
                </p>
                <p className="text-ink-subtle mt-0.5 text-sm">
                  {subjectName(activeTutor.subjects[0])} tutor
                </p>
              </div>

              <dl className="text-ink-muted mt-5 space-y-2.5 text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="text-ink-subtle">Replies in</dt>
                  <dd>{formatResponseTime(activeTutor.responseTimeMins)}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-ink-subtle">Rating</dt>
                  <dd className="tabular">
                    {activeTutor.rating.toFixed(1)} ({activeTutor.reviewCount})
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-ink-subtle">Levels</dt>
                  <dd className="text-right">{activeTutor.levels.join(', ')}</dd>
                </div>
              </dl>

              {activeBooking && (
                <div className="border-line bg-surface-subtle mt-5 rounded-[var(--radius-card)] border p-3.5">
                  <p className="text-ink-subtle text-xs font-medium">Next lesson</p>
                  <p className="mt-1 text-sm font-medium">
                    {subjectName(activeBooking.subjectId)}
                  </p>
                  <p className="text-ink-muted tabular mt-0.5 text-sm">
                    {formatRelativeDay(activeBooking.startsAt)} ·{' '}
                    {formatTimeRange(activeBooking.startsAt, activeBooking.durationMins)}
                  </p>
                </div>
              )}

              {!viewerIsTutor && (
                <div className="mt-5 space-y-2">
                  <Button
                    variant="secondary"
                    block
                    onClick={() => router.push(`/book/${activeTutor.slug}`)}
                  >
                    <CalendarPlus className="size-4" aria-hidden />
                    Book a lesson
                  </Button>
                  <ButtonLink href={`/tutors/${activeTutor.slug}`} variant="ghost" block>
                    Open full profile
                  </ButtonLink>
                </div>
              )}
            </div>
          ) : (
            <div className="text-ink-subtle flex h-full items-center justify-center text-center text-sm">
              <p className="flex flex-col items-center gap-2">
                <Info className="size-5" aria-hidden />
                Details about the person you are talking to appear here.
              </p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

/* ── Helpers ──────────────────────────────────────────────────────────────── */

/** "Online now", "Active 2 hours ago" — derived from minutes, not the clock. */
function describeLastSeen(minutes: number): string {
  if (minutes < 10) return 'Online now';
  if (minutes < 60) return `Active ${minutes} minutes ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `Active ${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
  const days = Math.round(hours / 24);
  return `Active ${days} ${days === 1 ? 'day' : 'days'} ago`;
}

function counterpartName(conversation: Conversation, viewerIsTutor: boolean): string {
  if (viewerIsTutor) {
    const member = getAccount(conversation.memberId);
    const learner = getLearner(conversation.learnerId);
    if (learner) return `${learner.firstName} ${learner.lastName}`;
    return member ? `${member.firstName} ${member.lastName}` : 'Student';
  }
  const tutor = getTutor(conversation.tutorId);
  return tutor ? `${tutor.firstName} ${tutor.lastName}` : 'Tutor';
}

function counterpartTone(conversation: Conversation, viewerIsTutor: boolean): number {
  if (viewerIsTutor) {
    return (
      getLearner(conversation.learnerId)?.avatarTone ??
      getAccount(conversation.memberId)?.avatarTone ??
      0
    );
  }
  return getTutor(conversation.tutorId)?.avatarTone ?? 0;
}
