import { Avatar } from '@/components/ui/avatar';
import { formatDateTime } from '@/lib/datetime';
import { formatPence, formatDurationLabelSafe } from '@/lib/booking-utils';
import type { Tutor } from '@/lib/types';

/** The running total, shown at every step from "choose a time" onwards. */
export function OrderSummary({
  tutor,
  subject,
  level,
  startsAt,
  durationMins,
  lessonPence,
  feePence,
}: {
  tutor: Tutor;
  subject: string;
  level: string;
  startsAt: string | null;
  durationMins: number;
  lessonPence: number;
  feePence: number;
}) {
  return (
    <div className="border-line bg-surface rounded-[var(--radius-card)] border p-5">
      <div className="flex items-center gap-3">
        <Avatar
          firstName={tutor.firstName}
          lastName={tutor.lastName}
          tone={tutor.avatarTone}
          size="md"
        />
        <div className="min-w-0">
          <p className="font-semibold">
            {tutor.firstName} {tutor.lastName}
          </p>
          <p className="text-ink-subtle text-sm">
            {subject} · {level}
          </p>
        </div>
      </div>

      <dl className="border-line mt-4 space-y-2.5 border-t pt-4 text-sm">
        <div className="flex justify-between gap-4">
          <dt className="text-ink-subtle">When</dt>
          <dd className="text-right font-medium">
            {startsAt ? formatDateTime(startsAt) : 'Not chosen yet'}
          </dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-ink-subtle">Length</dt>
          <dd className="font-medium">{formatDurationLabelSafe(durationMins)}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-ink-subtle">Lesson</dt>
          <dd className="tabular font-medium">{formatPence(lessonPence)}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-ink-subtle">Service fee</dt>
          <dd className="tabular font-medium">{formatPence(feePence)}</dd>
        </div>
      </dl>

      <div className="border-line mt-4 flex items-baseline justify-between border-t pt-4">
        <span className="font-semibold">Total</span>
        <span className="tabular text-xl font-semibold">
          {formatPence(lessonPence + feePence)}
        </span>
      </div>
    </div>
  );
}
