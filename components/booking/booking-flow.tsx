'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowLeft, ArrowRight, Info, Lock, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Field, RadioCard, Select, Textarea } from '@/components/ui/field';
import { Stepper } from '@/components/ui/stepper';
import { DateStrip, TimeGrid } from './date-picker';
import { OrderSummary } from './order-summary';
import { generateSlots } from '@/lib/availability';
import { useDemo } from '@/lib/store/demo-store';
import { useToast } from '@/lib/store/toast';
import { getLearners, subjectName } from '@/lib/queries';
import { levelLabels } from '@/lib/data/subjects';
import { formatLongDate } from '@/lib/datetime';
import {
  DURATION_OPTIONS,
  feePenceFor,
  formatDurationLabelSafe,
  lessonPenceFor,
} from '@/lib/booking-utils';
import { formatPence } from '@/lib/utils';
import type { EducationLevel, Tutor } from '@/lib/types';

const STEPS = ['Lesson details', 'Date and time', 'Message', 'Review', 'Checkout'];

const EASE = [0.22, 1, 0.36, 1] as const;

/**
 * The booking flow.
 *
 * Everything is local: the confirmation creates a demo booking in the store,
 * which then appears in the student and parent dashboards. The checkout step is
 * where Stripe would be introduced, and is labelled plainly rather than
 * imitating a card form.
 */
export function BookingFlow({
  tutor,
  initialStart,
}: {
  tutor: Tutor;
  initialStart?: string;
}) {
  const router = useRouter();
  const { account, createBooking, getAvailability, getUnavailableDates } = useDemo();
  const { toast } = useToast();

  const [step, setStep] = useState(0);
  const [subjectId, setSubjectId] = useState(tutor.subjects[0] ?? 'maths');
  const [level, setLevel] = useState<EducationLevel>(tutor.levels[0] ?? 'A-Level');
  const [duration, setDuration] = useState(60);
  const [learnerId, setLearnerId] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const slots = useMemo(
    () =>
      generateSlots({
        availability: getAvailability(tutor.id),
        days: 21,
        durationMins: duration,
        unavailableDates: getUnavailableDates(tutor.id),
      }),
    [getAvailability, getUnavailableDates, tutor.id, duration],
  );

  const initialDay = initialStart ? initialStart.slice(0, 10) : undefined;
  const [selectedDate, setSelectedDate] = useState<string | null>(
    initialDay ?? slots.find((day) => day.times.length > 0)?.dateKey ?? null,
  );
  const [startsAt, setStartsAt] = useState<string | null>(initialStart ?? null);

  const activeDay = slots.find((day) => day.dateKey === selectedDate);
  const lessonPence = lessonPenceFor(tutor.hourlyRate, duration);
  const feePence = feePenceFor(lessonPence);

  const learners = account?.role === 'parent' ? getLearners(account.id) : [];
  const canContinue = step !== 1 || Boolean(startsAt);

  function next() {
    setStep((current) => Math.min(current + 1, STEPS.length - 1));
  }

  function back() {
    if (step === 0) {
      router.push(`/tutors/${tutor.slug}`);
      return;
    }
    setStep((current) => Math.max(current - 1, 0));
  }

  function confirm() {
    if (!startsAt) return;
    setSubmitting(true);
    const booking = createBooking({
      tutorId: tutor.id,
      subjectId,
      level,
      startsAt,
      durationMins: duration,
      ...(note.trim() ? { note: note.trim() } : {}),
      ...(learnerId ? { learnerId } : {}),
    });
    toast({
      title: 'Lesson booked',
      description: `${subjectName(subjectId)} with ${tutor.firstName} — reference ${booking.reference}.`,
    });
    router.push(`/booking/confirmed?id=${booking.id}`);
  }

  return (
    <div className="container-page py-8 lg:py-10">
      <div className="mx-auto max-w-5xl">
        <h1 className="text-[1.75rem] tracking-[var(--tracking-tight)]">
          Book a lesson with {tutor.firstName}
        </h1>
        <p className="text-ink-muted mt-2">
          {formatPence(tutor.hourlyRate)} an hour · online · {tutor.levels.join(', ')}
        </p>

        <Stepper steps={STEPS} current={step} className="mt-6" />

        <div className="mt-8 lg:grid lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-8">
          <div>
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={step}
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                transition={{ duration: 0.22, ease: EASE }}
              >
                {step === 0 && (
                  <Card className="p-5 sm:p-6">
                    <h2 className="text-lg">What would you like to cover?</h2>
                    <div className="mt-5 space-y-5">
                      <Field label="Subject" required>
                        {({ id }) => (
                          <Select
                            id={id}
                            value={subjectId}
                            onChange={(event) => setSubjectId(event.target.value)}
                          >
                            {tutor.subjects.map((option) => (
                              <option key={option} value={option}>
                                {subjectName(option)}
                              </option>
                            ))}
                          </Select>
                        )}
                      </Field>

                      <Field label="Education level" required>
                        {({ id }) => (
                          <Select
                            id={id}
                            value={level}
                            onChange={(event) =>
                              setLevel(event.target.value as EducationLevel)
                            }
                          >
                            {tutor.levels.map((option) => (
                              <option key={option} value={option}>
                                {levelLabels[option]}
                              </option>
                            ))}
                          </Select>
                        )}
                      </Field>

                      {learners.length > 0 && (
                        <Field
                          label="Who is this lesson for?"
                          hint="Parents can book on behalf of a linked learner."
                        >
                          {({ id }) => (
                            <Select
                              id={id}
                              value={learnerId}
                              onChange={(event) => setLearnerId(event.target.value)}
                            >
                              <option value="">Myself</option>
                              {learners.map((learner) => (
                                <option key={learner.id} value={learner.id}>
                                  {learner.firstName} {learner.lastName} ·{' '}
                                  {learner.yearGroup}
                                </option>
                              ))}
                            </Select>
                          )}
                        </Field>
                      )}

                      <fieldset>
                        <legend className="text-ink mb-2 block text-sm font-medium">
                          Lesson length
                        </legend>
                        <div className="grid gap-2.5 sm:grid-cols-3">
                          {DURATION_OPTIONS.map((option) => (
                            <RadioCard
                              key={option.value}
                              name="duration"
                              value={String(option.value)}
                              checked={duration === option.value}
                              onChange={(value) => {
                                setDuration(Number(value));
                                setStartsAt(null);
                              }}
                              title={option.label}
                              description={option.note}
                            />
                          ))}
                        </div>
                      </fieldset>
                    </div>
                  </Card>
                )}

                {step === 1 && (
                  <Card className="p-5 sm:p-6">
                    <h2 className="text-lg">Choose a date and time</h2>
                    <p className="text-ink-subtle mt-1.5 text-sm">
                      These are {tutor.firstName}’s open slots for a{' '}
                      {formatDurationLabelSafe(duration)} lesson. Times are shown in UTC.
                    </p>

                    <div className="mt-5">
                      <DateStrip
                        slots={slots}
                        selectedDate={selectedDate}
                        onSelect={(dateKey) => {
                          setSelectedDate(dateKey);
                          setStartsAt(null);
                        }}
                      />
                    </div>

                    <div className="mt-5">
                      {activeDay && (
                        <p className="text-ink-subtle mb-3 text-sm">
                          {formatLongDate(activeDay.dateIso)}
                        </p>
                      )}
                      <TimeGrid
                        times={activeDay?.times ?? []}
                        selected={startsAt}
                        onSelect={setStartsAt}
                      />
                    </div>
                  </Card>
                )}

                {step === 2 && (
                  <Card className="p-5 sm:p-6">
                    <h2 className="text-lg">Anything {tutor.firstName} should know?</h2>
                    <p className="text-ink-subtle mt-1.5 text-sm">
                      Optional, but a sentence about what you are stuck on makes the first
                      lesson much more useful.
                    </p>
                    <div className="mt-5">
                      <Field
                        label="Message to the tutor"
                        hint="For example: the topic, the exam board, or a question you could not finish."
                      >
                        {({ id, describedBy }) => (
                          <Textarea
                            id={id}
                            aria-describedby={describedBy}
                            value={note}
                            maxLength={500}
                            onChange={(event) => setNote(event.target.value)}
                            placeholder="We are on integration by parts and I keep losing marks on the limits."
                          />
                        )}
                      </Field>
                      <p className="text-ink-subtle mt-2 text-right text-xs">
                        {note.length}/500
                      </p>
                    </div>
                  </Card>
                )}

                {step === 3 && (
                  <Card className="p-5 sm:p-6">
                    <h2 className="text-lg">Check the details</h2>
                    <dl className="mt-5 space-y-3.5 text-sm">
                      <Row label="Tutor" value={`${tutor.firstName} ${tutor.lastName}`} />
                      <Row label="Subject" value={subjectName(subjectId)} />
                      <Row label="Level" value={levelLabels[level] ?? level} />
                      <Row
                        label="Date and time"
                        value={startsAt ? formatLongDate(startsAt) : '—'}
                      />
                      <Row label="Length" value={formatDurationLabelSafe(duration)} />
                      <Row
                        label="Note"
                        value={note.trim() ? note.trim() : 'None added'}
                      />
                    </dl>
                    <div className="border-info-line bg-info-bg text-info mt-5 flex gap-2.5 rounded-[var(--radius-control)] border p-3.5 text-sm">
                      <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
                      <p>
                        {tutor.firstName} can propose a different time if this one no
                        longer suits. You will see any change in your lessons list.
                      </p>
                    </div>
                  </Card>
                )}

                {step === 4 && (
                  <Card className="p-5 sm:p-6">
                    <h2 className="text-lg">Payment</h2>
                    <div className="border-warning-line bg-warning-bg mt-4 rounded-[var(--radius-card)] border p-4">
                      <div className="flex gap-3">
                        <Lock
                          className="text-warning mt-0.5 size-5 shrink-0"
                          aria-hidden
                        />
                        <div>
                          <p className="text-ink font-semibold">
                            Demonstration checkout — no payment is taken
                          </p>
                          <p className="text-ink-muted mt-1.5 text-sm leading-relaxed">
                            Card details are deliberately not collected here. In the live
                            product this step hands over to a regulated payment provider,
                            and Tutor Hub never sees or stores a card number. Confirming
                            below creates a demo booking only.
                          </p>
                        </div>
                      </div>
                    </div>

                    <ul className="text-ink-muted mt-5 space-y-2.5 text-sm">
                      <li className="flex gap-2.5">
                        <ShieldCheck
                          className="text-success mt-0.5 size-4 shrink-0"
                          aria-hidden
                        />
                        Payment would be held until the lesson is completed.
                      </li>
                      <li className="flex gap-2.5">
                        <ShieldCheck
                          className="text-success mt-0.5 size-4 shrink-0"
                          aria-hidden
                        />
                        Cancel more than 24 hours ahead and nothing is charged.
                      </li>
                      <li className="flex gap-2.5">
                        <ShieldCheck
                          className="text-success mt-0.5 size-4 shrink-0"
                          aria-hidden
                        />
                        Tutors are paid out after the lesson, not before.
                      </li>
                    </ul>
                  </Card>
                )}
              </motion.div>
            </AnimatePresence>

            <div className="mt-6 flex items-center justify-between gap-3">
              <Button variant="ghost" onClick={back}>
                <ArrowLeft className="size-4" aria-hidden />
                {step === 0 ? 'Back to profile' : 'Back'}
              </Button>

              {step < STEPS.length - 1 ? (
                <Button onClick={next} disabled={!canContinue} size="lg">
                  Continue
                  <ArrowRight className="size-4" aria-hidden />
                </Button>
              ) : (
                <Button onClick={confirm} disabled={submitting || !startsAt} size="lg">
                  {submitting ? 'Confirming…' : 'Confirm demo booking'}
                </Button>
              )}
            </div>

            {step === 1 && !startsAt && (
              <p className="text-ink-subtle mt-3 text-sm">Choose a time to continue.</p>
            )}
          </div>

          <aside className="mt-8 lg:mt-0">
            <div className="lg:sticky lg:top-24">
              <OrderSummary
                tutor={tutor}
                subject={subjectName(subjectId)}
                level={levelLabels[level] ?? level}
                startsAt={startsAt}
                durationMins={duration}
                lessonPence={lessonPence}
                feePence={feePence}
              />
              <p className="text-ink-subtle mt-3 text-xs leading-relaxed">
                The service fee keeps messaging, the lesson room and support running. It
                is shown separately so the tutor’s rate stays clear.
              </p>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-line flex flex-wrap justify-between gap-x-6 gap-y-1 border-b pb-3 last:border-b-0 last:pb-0">
      <dt className="text-ink-subtle">{label}</dt>
      <dd className="text-ink max-w-sm text-right font-medium">{value}</dd>
    </div>
  );
}
