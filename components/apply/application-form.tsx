'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowLeft, ArrowRight, CheckCircle2, Clock4, Send } from 'lucide-react';
import { Button, ButtonLink } from '@/components/ui/button';
import { Card, CardBody } from '@/components/ui/card';
import { Field, Input, Textarea } from '@/components/ui/field';
import { Stepper } from '@/components/ui/stepper';
import { Badge } from '@/components/ui/badge';
import { Avatar } from '@/components/ui/avatar';
import {
  EMPTY_APPLICATION_DRAFT,
  useDemo,
  type ApplicationDraft,
} from '@/lib/store/demo-store';
import { useToast } from '@/lib/store/toast';
import { getSubjects, subjectName } from '@/lib/queries';
import { educationLevels, levelLabels } from '@/lib/data/subjects';
import { formatPence } from '@/lib/utils';
import type { EducationLevel } from '@/lib/types';

const STEPS = [
  'Basic details',
  'Subjects and levels',
  'Experience',
  'Qualifications',
  'Teaching approach',
  'Availability',
  'Preview',
  'Submit',
];

type Errors = Partial<Record<keyof ApplicationDraft, string>>;

/**
 * The tutor application.
 *
 * Progress is written to the demo store on every change, so closing the tab and
 * coming back keeps the answers and the step. Submitting adds the application
 * to the admin queue, where an administrator can approve it.
 */
export function ApplicationForm() {
  const { applicationDraft, applicationDraftStep, hydrated } = useDemo();

  // The saved draft only exists once localStorage has been read, so the form
  // itself is not mounted until then — that way the draft is a plain initial
  // value rather than something copied in later.
  if (!hydrated) {
    return (
      <Card>
        <CardBody className="sm:p-6">
          <p className="text-ink-subtle text-sm">Loading your saved progress…</p>
        </CardBody>
      </Card>
    );
  }

  return (
    <ApplicationSteps
      key="application"
      initialDraft={applicationDraft ?? EMPTY_APPLICATION_DRAFT}
      initialStep={applicationDraftStep}
    />
  );
}

function ApplicationSteps({
  initialDraft,
  initialStep,
}: {
  initialDraft: ApplicationDraft;
  initialStep: number;
}) {
  const { saveApplicationDraft, submitApplication } = useDemo();
  const { toast } = useToast();

  const [draft, setDraft] = useState<ApplicationDraft>(initialDraft);
  const [step, setStep] = useState(initialStep);
  const [errors, setErrors] = useState<Errors>({});
  const [submittedRef, setSubmittedRef] = useState<string | null>(null);

  function update(patch: Partial<ApplicationDraft>) {
    const next = { ...draft, ...patch };
    setDraft(next);
    saveApplicationDraft(next, step);
  }

  function validate(index: number): Errors {
    const found: Errors = {};
    if (index === 0) {
      if (!draft.firstName.trim()) found.firstName = 'Enter your first name.';
      if (!draft.lastName.trim()) found.lastName = 'Enter your last name.';
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.email.trim()))
        found.email = 'Enter a valid email address.';
      if (draft.phone.replace(/\D/g, '').length < 10)
        found.phone = 'Enter a phone number we can reach you on.';
      if (!draft.location.trim()) found.location = 'Where are you based?';
    }
    if (index === 1) {
      if (draft.subjects.length === 0) found.subjects = 'Choose at least one subject.';
      if (draft.levels.length === 0) found.levels = 'Choose at least one level.';
      if (draft.hourlyRate < 1500 || draft.hourlyRate > 15000)
        found.hourlyRate = 'Rates on Tutor Hub run from £15 to £150 an hour.';
    }
    if (index === 2) {
      if (draft.experience.trim().length < 80)
        found.experience =
          'Give us at least a couple of sentences — this is what the reviewer reads first.';
      if (draft.yearsExperience < 0 || draft.yearsExperience > 50)
        found.yearsExperience = 'Enter a number of years between 0 and 50.';
    }
    if (index === 3 && draft.qualifications.trim().length < 30) {
      found.qualifications =
        'List your degrees, teaching qualifications or certificates.';
    }
    if (index === 4) {
      if (!draft.headline.trim())
        found.headline = 'Write the one line students will see.';
      if (draft.approach.trim().length < 80)
        found.approach = 'Describe what actually happens in one of your lessons.';
    }
    if (index === 5 && draft.availabilitySummary.trim().length < 10) {
      found.availabilitySummary = 'Tell us roughly when you can teach.';
    }
    return found;
  }

  function next() {
    const found = validate(step);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    const nextStep = Math.min(step + 1, STEPS.length - 1);
    setStep(nextStep);
    saveApplicationDraft(draft, nextStep);
  }

  function back() {
    const previous = Math.max(step - 1, 0);
    setStep(previous);
    saveApplicationDraft(draft, previous);
  }

  function submit() {
    for (let index = 0; index < 6; index += 1) {
      const found = validate(index);
      if (Object.keys(found).length > 0) {
        setErrors(found);
        setStep(index);
        toast({
          title: 'Something is missing',
          description: `Check step ${index + 1}: ${STEPS[index]}.`,
          tone: 'warning',
        });
        return;
      }
    }
    const application = submitApplication(draft);
    setSubmittedRef(application.id);
    toast({
      title: 'Application submitted',
      description: 'It is now in the Tutor Hub review queue.',
    });
  }

  if (submittedRef) {
    return <SubmittedPanel draft={draft} />;
  }

  return (
    <div>
      <Stepper steps={STEPS} current={step} className="mb-7" />

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -8 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
        >
          <Card>
            <CardBody className="space-y-5 sm:p-6">
              {step === 0 && (
                <>
                  <StepHeading
                    title="Your details"
                    body="We use these to contact you about your application. They are not published."
                  />
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="First name" error={errors.firstName} required>
                      {({ id, describedBy }) => (
                        <Input
                          id={id}
                          value={draft.firstName}
                          aria-invalid={Boolean(errors.firstName)}
                          aria-describedby={describedBy}
                          onChange={(event) => update({ firstName: event.target.value })}
                        />
                      )}
                    </Field>
                    <Field label="Last name" error={errors.lastName} required>
                      {({ id, describedBy }) => (
                        <Input
                          id={id}
                          value={draft.lastName}
                          aria-invalid={Boolean(errors.lastName)}
                          aria-describedby={describedBy}
                          onChange={(event) => update({ lastName: event.target.value })}
                        />
                      )}
                    </Field>
                  </div>
                  <Field label="Email address" error={errors.email} required>
                    {({ id, describedBy }) => (
                      <Input
                        id={id}
                        type="email"
                        value={draft.email}
                        aria-invalid={Boolean(errors.email)}
                        aria-describedby={describedBy}
                        onChange={(event) => update({ email: event.target.value })}
                      />
                    )}
                  </Field>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Phone number" error={errors.phone} required>
                      {({ id, describedBy }) => (
                        <Input
                          id={id}
                          type="tel"
                          value={draft.phone}
                          aria-invalid={Boolean(errors.phone)}
                          aria-describedby={describedBy}
                          onChange={(event) => update({ phone: event.target.value })}
                          placeholder="07700 900000"
                        />
                      )}
                    </Field>
                    <Field
                      label="Where are you based?"
                      hint="Town or city. Lessons are online."
                      error={errors.location}
                      required
                    >
                      {({ id, describedBy }) => (
                        <Input
                          id={id}
                          value={draft.location}
                          aria-invalid={Boolean(errors.location)}
                          aria-describedby={describedBy}
                          onChange={(event) => update({ location: event.target.value })}
                        />
                      )}
                    </Field>
                  </div>
                </>
              )}

              {step === 1 && (
                <>
                  <StepHeading
                    title="What do you teach?"
                    body="Pick only the subjects and levels you would be comfortable teaching tomorrow."
                  />
                  <fieldset>
                    <legend className="text-ink mb-2 text-sm font-medium">
                      Subjects
                      <span className="text-danger ml-1" aria-hidden>
                        *
                      </span>
                    </legend>
                    <div className="flex flex-wrap gap-2">
                      {getSubjects().map((subject) => {
                        const active = draft.subjects.includes(subject.id);
                        return (
                          <button
                            key={subject.id}
                            type="button"
                            aria-pressed={active}
                            onClick={() =>
                              update({
                                subjects: active
                                  ? draft.subjects.filter((id) => id !== subject.id)
                                  : [...draft.subjects, subject.id],
                              })
                            }
                            className={`min-h-11 rounded-[var(--radius-control)] border px-3.5 text-sm font-medium transition-colors duration-[var(--duration-fast)] ${
                              active
                                ? 'border-brand bg-brand-subtle text-brand-ink'
                                : 'border-line-strong bg-surface text-ink-muted hover:border-ink-subtle'
                            }`}
                          >
                            {subject.name}
                          </button>
                        );
                      })}
                    </div>
                    {errors.subjects && (
                      <p className="text-danger mt-2 text-sm">{errors.subjects}</p>
                    )}
                  </fieldset>

                  <fieldset>
                    <legend className="text-ink mb-2 text-sm font-medium">
                      Levels
                      <span className="text-danger ml-1" aria-hidden>
                        *
                      </span>
                    </legend>
                    <div className="flex flex-wrap gap-2">
                      {educationLevels.map((level) => {
                        const active = draft.levels.includes(level as EducationLevel);
                        return (
                          <button
                            key={level}
                            type="button"
                            aria-pressed={active}
                            onClick={() =>
                              update({
                                levels: active
                                  ? draft.levels.filter((item) => item !== level)
                                  : [...draft.levels, level as EducationLevel],
                              })
                            }
                            className={`min-h-11 rounded-[var(--radius-control)] border px-3.5 text-sm font-medium transition-colors duration-[var(--duration-fast)] ${
                              active
                                ? 'border-brand bg-brand-subtle text-brand-ink'
                                : 'border-line-strong bg-surface text-ink-muted hover:border-ink-subtle'
                            }`}
                          >
                            {levelLabels[level]}
                          </button>
                        );
                      })}
                    </div>
                    {errors.levels && (
                      <p className="text-danger mt-2 text-sm">{errors.levels}</p>
                    )}
                  </fieldset>

                  <Field
                    label="Your hourly rate (£)"
                    hint="You set this yourself and can change it later. Tutor Hub adds a service fee for the student on top."
                    error={errors.hourlyRate}
                    required
                  >
                    {({ id, describedBy }) => (
                      <Input
                        id={id}
                        type="number"
                        min={15}
                        max={150}
                        value={Math.round(draft.hourlyRate / 100)}
                        aria-invalid={Boolean(errors.hourlyRate)}
                        aria-describedby={describedBy}
                        onChange={(event) =>
                          update({ hourlyRate: Number(event.target.value) * 100 })
                        }
                        className="max-w-40"
                      />
                    )}
                  </Field>
                </>
              )}

              {step === 2 && (
                <>
                  <StepHeading
                    title="Your experience"
                    body="Where you have taught, which exam boards you know, and who you usually work with."
                  />
                  <Field
                    label="Years of teaching or tutoring"
                    error={errors.yearsExperience}
                    required
                  >
                    {({ id, describedBy }) => (
                      <Input
                        id={id}
                        type="number"
                        min={0}
                        max={50}
                        value={draft.yearsExperience}
                        aria-invalid={Boolean(errors.yearsExperience)}
                        aria-describedby={describedBy}
                        onChange={(event) =>
                          update({ yearsExperience: Number(event.target.value) })
                        }
                        className="max-w-32"
                      />
                    )}
                  </Field>
                  <Field
                    label="Tell us about your experience"
                    hint="Roles, schools or colleges, exam boards, and anything unusual you bring."
                    error={errors.experience}
                    required
                  >
                    {({ id, describedBy }) => (
                      <Textarea
                        id={id}
                        value={draft.experience}
                        aria-invalid={Boolean(errors.experience)}
                        aria-describedby={describedBy}
                        onChange={(event) => update({ experience: event.target.value })}
                        className="min-h-36"
                        placeholder="Six years teaching A-Level Biology at a sixth-form college, mostly AQA. I have marked Paper 1 for two series and run the practical endorsement."
                      />
                    )}
                  </Field>
                </>
              )}

              {step === 3 && (
                <>
                  <StepHeading
                    title="Qualifications"
                    body="Degrees, teaching qualifications and any certificates relevant to what you teach. We check these before publishing a profile."
                  />
                  <Field
                    label="Your qualifications"
                    hint="Include the institution and year for each one."
                    error={errors.qualifications}
                    required
                  >
                    {({ id, describedBy }) => (
                      <Textarea
                        id={id}
                        value={draft.qualifications}
                        aria-invalid={Boolean(errors.qualifications)}
                        aria-describedby={describedBy}
                        onChange={(event) =>
                          update({ qualifications: event.target.value })
                        }
                        className="min-h-36"
                        placeholder="BSc Biological Sciences, University of Exeter (2015). PGCE Secondary Science, University of Bristol (2016)."
                      />
                    )}
                  </Field>
                  <p className="text-ink-subtle border-line border-t pt-4 text-sm leading-relaxed">
                    Document upload is not connected in this demonstration. In the live
                    product you would attach certificates and photographic identification
                    here, stored securely and visible only to the review team.
                  </p>
                </>
              )}

              {step === 4 && (
                <>
                  <StepHeading
                    title="How you teach"
                    body="This is the part students read most closely. Be specific rather than enthusiastic."
                  />
                  <Field
                    label="Profile headline"
                    hint="One line, shown on your card in search results."
                    error={errors.headline}
                    required
                  >
                    {({ id, describedBy }) => (
                      <Input
                        id={id}
                        value={draft.headline}
                        maxLength={110}
                        aria-invalid={Boolean(errors.headline)}
                        aria-describedby={describedBy}
                        onChange={(event) => update({ headline: event.target.value })}
                        placeholder="A-Level Biology, with a focus on exam technique"
                      />
                    )}
                  </Field>
                  <Field
                    label="Your teaching approach"
                    hint="What happens in a lesson, and what you expect from a student between lessons."
                    error={errors.approach}
                    required
                  >
                    {({ id, describedBy }) => (
                      <Textarea
                        id={id}
                        value={draft.approach}
                        aria-invalid={Boolean(errors.approach)}
                        aria-describedby={describedBy}
                        onChange={(event) => update({ approach: event.target.value })}
                        className="min-h-36"
                        placeholder="I start with a short diagnostic, then we alternate between one worked example and a set of questions you attempt while I stay quiet."
                      />
                    )}
                  </Field>
                </>
              )}

              {step === 5 && (
                <>
                  <StepHeading
                    title="When can you teach?"
                    body="A rough pattern is fine — you will set exact hours in your dashboard once your profile is live."
                  />
                  <Field
                    label="Typical availability"
                    error={errors.availabilitySummary}
                    required
                  >
                    {({ id, describedBy }) => (
                      <Textarea
                        id={id}
                        value={draft.availabilitySummary}
                        aria-invalid={Boolean(errors.availabilitySummary)}
                        aria-describedby={describedBy}
                        onChange={(event) =>
                          update({ availabilitySummary: event.target.value })
                        }
                        placeholder="Weekday evenings after 17:00, plus Saturday mornings."
                      />
                    )}
                  </Field>
                </>
              )}

              {step === 6 && (
                <>
                  <StepHeading
                    title="How your profile will look"
                    body="This is the card students see in search results. You can edit everything after approval."
                  />
                  <div className="border-line bg-surface-subtle rounded-[var(--radius-card)] border p-5">
                    <div className="flex items-start gap-3.5">
                      <Avatar
                        firstName={draft.firstName || 'New'}
                        lastName={draft.lastName || 'Tutor'}
                        tone={2}
                        size="md"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold">
                          {draft.firstName || 'Your name'} {draft.lastName}
                        </p>
                        <p className="text-ink-muted mt-0.5 text-sm">
                          {draft.subjects.map((id) => subjectName(id)).join(' · ') ||
                            'No subjects chosen'}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="tabular font-semibold">
                          {formatPence(draft.hourlyRate)}
                        </p>
                        <p className="text-ink-subtle text-xs">per hour</p>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {draft.levels.map((level) => (
                        <Badge key={level} tone="outline">
                          {levelLabels[level]}
                        </Badge>
                      ))}
                    </div>
                    <p className="text-ink-muted mt-3 text-sm leading-relaxed">
                      {draft.headline || 'Your headline appears here.'}
                    </p>
                  </div>

                  <dl className="space-y-3.5 text-sm">
                    <PreviewRow label="Experience" value={draft.experience} />
                    <PreviewRow label="Qualifications" value={draft.qualifications} />
                    <PreviewRow label="Teaching approach" value={draft.approach} />
                    <PreviewRow label="Availability" value={draft.availabilitySummary} />
                  </dl>
                </>
              )}

              {step === 7 && (
                <>
                  <StepHeading
                    title="Ready to send"
                    body="A member of the Tutor Hub team reads every application. You will hear back by email."
                  />
                  <ul className="text-ink-muted space-y-2.5 text-sm">
                    <li className="flex gap-2.5">
                      <CheckCircle2
                        className="text-success mt-0.5 size-4 shrink-0"
                        aria-hidden
                      />
                      Your application is checked against the subjects and levels you
                      chose.
                    </li>
                    <li className="flex gap-2.5">
                      <CheckCircle2
                        className="text-success mt-0.5 size-4 shrink-0"
                        aria-hidden
                      />
                      Qualifications and identity are verified before your profile is
                      published.
                    </li>
                    <li className="flex gap-2.5">
                      <CheckCircle2
                        className="text-success mt-0.5 size-4 shrink-0"
                        aria-hidden
                      />
                      If something is unclear we will ask rather than decline.
                    </li>
                  </ul>
                  <p className="text-ink-subtle border-line border-t pt-4 text-sm leading-relaxed">
                    In this demonstration your application is stored in this browser and
                    appears in the admin queue, where you can approve it yourself to see
                    the whole flow.
                  </p>
                </>
              )}
            </CardBody>
          </Card>
        </motion.div>
      </AnimatePresence>

      <div className="mt-6 flex items-center justify-between gap-3">
        <Button variant="ghost" onClick={back} disabled={step === 0}>
          <ArrowLeft className="size-4" aria-hidden />
          Back
        </Button>

        {step < STEPS.length - 1 ? (
          <Button onClick={next} size="lg">
            Continue
            <ArrowRight className="size-4" aria-hidden />
          </Button>
        ) : (
          <Button onClick={submit} size="lg">
            <Send className="size-4" aria-hidden />
            Submit application
          </Button>
        )}
      </div>

      <p className="text-ink-subtle mt-4 text-sm">
        Your progress is saved in this browser as you type — you can close the tab and
        come back to it.
      </p>
    </div>
  );
}

function StepHeading({ title, body }: { title: string; body: string }) {
  return (
    <div>
      <h3 className="text-lg">{title}</h3>
      <p className="text-ink-subtle mt-1.5 text-sm leading-relaxed">{body}</p>
    </div>
  );
}

function PreviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-line border-b pb-3 last:border-b-0 last:pb-0">
      <dt className="text-ink-subtle text-xs">{label}</dt>
      <dd className="text-ink-muted mt-1 leading-relaxed">
        {value.trim() || <span className="text-ink-subtle">Not filled in yet</span>}
      </dd>
    </div>
  );
}

function SubmittedPanel({ draft }: { draft: ApplicationDraft }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
    >
      <Card>
        <CardBody className="sm:p-8">
          <div className="flex items-center gap-3">
            <span className="bg-success-bg text-success flex size-11 items-center justify-center rounded-full">
              <CheckCircle2 className="size-6" aria-hidden />
            </span>
            <div>
              <h3 className="text-xl tracking-[var(--tracking-tight)]">
                Application received
              </h3>
              <p className="text-ink-subtle mt-0.5 text-sm">
                Thank you, {draft.firstName}. We will be in touch by email.
              </p>
            </div>
          </div>

          <div className="border-warning-line bg-warning-bg mt-6 flex items-center gap-3 rounded-[var(--radius-card)] border p-4">
            <Clock4 className="text-warning size-5 shrink-0" aria-hidden />
            <div>
              <p className="text-ink text-sm font-semibold">Status: under review</p>
              <p className="text-ink-muted mt-0.5 text-sm">
                Applications are usually read within three working days.
              </p>
            </div>
          </div>

          <div className="mt-6">
            <h4 className="text-base font-semibold">What happens next</h4>
            <ol className="text-ink-muted mt-3 space-y-2.5 text-sm">
              <li className="flex gap-2.5">
                <span className="text-brand font-semibold">1.</span>A reviewer reads your
                application and checks your qualifications.
              </li>
              <li className="flex gap-2.5">
                <span className="text-brand font-semibold">2.</span>
                We may email you for a reference or a certificate.
              </li>
              <li className="flex gap-2.5">
                <span className="text-brand font-semibold">3.</span>
                Once approved, you set your availability and your profile goes live.
              </li>
            </ol>
          </div>

          <div className="mt-7 flex flex-wrap gap-2.5">
            <ButtonLink href="/admin/applications" size="lg">
              See it in the admin queue
            </ButtonLink>
            <ButtonLink href="/tutor" variant="secondary" size="lg">
              Open the tutor dashboard
            </ButtonLink>
          </div>

          <p className="text-ink-subtle mt-5 text-sm leading-relaxed">
            This is a demonstration: your application is stored in this browser only. Open
            the admin area to approve, decline or request more information and watch the
            status change.
          </p>
        </CardBody>
      </Card>
    </motion.div>
  );
}
