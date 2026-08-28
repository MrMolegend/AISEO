'use client';

import { motion, useReducedMotion } from 'motion/react';
import { CalendarDays, Mic, Video } from 'lucide-react';
import { Avatar } from '@/components/ui/avatar';
import { Rating } from '@/components/ui/rating';
import { VerifiedBadge } from '@/components/ui/badges';
import { formatPence } from '@/lib/utils';

/**
 * A composed still of the product rather than an illustration: the tutor card
 * you would find, the lesson you would have booked, and the room you would join.
 * The three pieces settle in sequence on first paint and then stay still —
 * nothing here floats or loops.
 */
export function ProductPreview() {
  const reduced = useReducedMotion();
  const rise = (delay: number) =>
    reduced
      ? {}
      : {
          initial: { opacity: 0, y: 14 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.45, delay, ease: [0.22, 1, 0.36, 1] as const },
        };

  return (
    <div className="relative mx-auto w-full max-w-[26rem] lg:max-w-none">
      <motion.div
        {...rise(0.05)}
        className="border-line bg-surface rounded-[var(--radius-panel)] border p-4 shadow-[var(--shadow-raised)]"
      >
        <div className="flex items-start gap-3.5">
          <Avatar firstName="Amara" lastName="Okonkwo" tone={0} size="lg" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="font-semibold">Amara Okonkwo</p>
              <VerifiedBadge />
            </div>
            <p className="text-ink-subtle mt-0.5 text-sm">
              Mathematics · GCSE, A-Level, University
            </p>
            <div className="mt-1.5">
              <Rating value={4.9} count={214} size="sm" />
            </div>
          </div>
          <div className="text-right">
            <p className="tabular font-semibold">{formatPence(4800)}</p>
            <p className="text-ink-subtle text-xs">per hour</p>
          </div>
        </div>
        <p className="text-ink-muted mt-3.5 text-sm leading-relaxed">
          A-Level Maths and Further Maths, with a focus on exam method.
        </p>
      </motion.div>

      <motion.div
        {...rise(0.18)}
        className="border-line bg-surface relative z-10 -mt-1 ml-6 rounded-[var(--radius-card)] border p-3.5 shadow-[var(--shadow-raised)] sm:ml-10"
      >
        <div className="flex items-center gap-3">
          <span className="bg-brand-subtle text-brand flex size-10 shrink-0 items-center justify-center rounded-[var(--radius-control)]">
            <CalendarDays className="size-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold">A-Level Maths · Thursday 17:00</p>
            <p className="text-ink-subtle text-xs">60 minutes · integration by parts</p>
          </div>
          <span className="bg-mint text-mint-ink ml-auto rounded-md px-2 py-1 text-xs font-medium">
            Confirmed
          </span>
        </div>
      </motion.div>

      <motion.div
        {...rise(0.3)}
        className="border-navy-line surface-navy-gradient relative z-20 -mt-1 mr-4 ml-1 rounded-[var(--radius-card)] border p-3.5 shadow-[var(--shadow-raised)] sm:mr-8"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="flex size-9 items-center justify-center rounded-[var(--radius-control)] bg-white/10 text-white">
              <Video className="size-4.5" aria-hidden />
            </span>
            <div>
              <p className="text-sm font-medium text-white">Lesson room</p>
              <p className="text-[0.6875rem] text-white/70">
                Connection strong · 12:04 elapsed
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="flex size-9 items-center justify-center rounded-full bg-white/10 text-white">
              <Mic className="size-4" aria-hidden />
            </span>
            <span className="flex size-9 items-center justify-center rounded-full bg-white/10 text-white">
              <Video className="size-4" aria-hidden />
            </span>
          </div>
        </div>
      </motion.div>

      <motion.div
        {...rise(0.42)}
        className="border-line bg-surface relative z-30 mt-3 ml-auto w-[min(20rem,100%)] rounded-[var(--radius-card)] border p-3.5 shadow-[var(--shadow-card)]"
      >
        <div className="flex items-start gap-2.5">
          <Avatar firstName="Amara" lastName="Okonkwo" tone={0} size="sm" />
          <div className="min-w-0">
            <p className="text-xs font-semibold">Amara</p>
            <p className="text-ink-muted mt-0.5 text-sm leading-snug">
              That substitution is fine — the limits need changing too. We will do it
              properly on Thursday.
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
