'use client';

import { useMemo, useRef, useState } from 'react';
import { Check, ExternalLink, Loader2, Plus, Trash2 } from 'lucide-react';
import { PageHeader } from '@/components/dashboard/page-header';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import { Button, ButtonLink } from '@/components/ui/button';
import { Field, Input, Textarea } from '@/components/ui/field';
import { Badge } from '@/components/ui/badge';
import { ProgressBar } from '@/components/ui/progress';
import { Avatar } from '@/components/ui/avatar';
import { Rating } from '@/components/ui/rating';
import { VerifiedBadge } from '@/components/ui/badges';
import { Skeleton } from '@/components/ui/states';
import { useDemo, type TutorProfilePatch } from '@/lib/store/demo-store';
import { useToast } from '@/lib/store/toast';
import { profileCompletion } from '@/lib/tutor-metrics';
import { getSubjects, subjectName } from '@/lib/queries';
import { educationLevels, levelLabels } from '@/lib/data/subjects';
import { formatPence } from '@/lib/utils';
import type { EducationLevel, Qualification, Tutor } from '@/lib/types';

/**
 * The public profile editor.
 *
 * Edits are held locally and written to the store a second after typing stops,
 * which is what the "Saved" indicator reports. The preview on the right is the
 * same data the marketplace card reads, so there is no second source of truth.
 */
export default function TutorProfileEditorPage() {
  const { account, tutors, hydrated } = useDemo();
  const tutor = tutors.find((item) => item.id === account?.tutorId);

  // The editor mounts only once the tutor is known, so its draft can be a plain
  // initial value instead of something copied in by an effect.
  if (!hydrated || !tutor) return <Skeleton className="h-96 w-full" />;

  return <ProfileEditor key={tutor.id} tutor={tutor} />;
}

function ProfileEditor({ tutor }: { tutor: Tutor }) {
  const { saveTutorProfile } = useDemo();
  const { toast } = useToast();

  const [draft, setDraft] = useState<TutorProfilePatch>({
    headline: tutor.headline,
    about: tutor.about,
    teachingApproach: tutor.teachingApproach,
    subjects: tutor.subjects,
    levels: tutor.levels,
    hourlyRate: tutor.hourlyRate,
    qualifications: tutor.qualifications,
  });
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const timer = useRef<number | null>(null);

  const [newQual, setNewQual] = useState<Qualification>({
    title: '',
    institution: '',
    year: new Date().getFullYear(),
  });

  const merged = useMemo(() => ({ ...tutor, ...draft }), [tutor, draft]);
  const completion = profileCompletion(merged);

  function update(patch: TutorProfilePatch) {
    setDraft((current) => ({ ...current, ...patch }));
    setSaveState('saving');
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      saveTutorProfile(tutor.id, patch);
      setSaveState('saved');
      window.setTimeout(() => setSaveState('idle'), 2200);
    }, 800);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Public profile"
        lead="This is what students see before they book. Changes save as you type."
        action={
          <div className="flex items-center gap-3">
            <SaveIndicator state={saveState} />
            <ButtonLink href={`/tutors/${tutor.slug}`} variant="secondary">
              <ExternalLink className="size-4" aria-hidden />
              View live
            </ButtonLink>
          </div>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle as="h2">Profile completion</CardTitle>
              <span className="tabular text-sm font-semibold">{completion.percent}%</span>
            </CardHeader>
            <CardBody className="space-y-3">
              <ProgressBar
                value={completion.percent}
                label="Profile completion"
                tone="mint"
              />
              {completion.missing.length > 0 && (
                <p className="text-ink-subtle text-sm">
                  Still to do: {completion.missing.join(', ').toLowerCase()}.
                </p>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle as="h2">Photograph</CardTitle>
            </CardHeader>
            <CardBody className="flex flex-wrap items-center gap-5">
              <Avatar
                firstName={tutor.firstName}
                lastName={tutor.lastName}
                tone={tutor.avatarTone}
                size="2xl"
              />
              <div className="min-w-0 flex-1">
                <p className="text-ink-muted text-sm leading-relaxed">
                  Profiles currently use your initials. Photograph uploads will be stored
                  in Supabase Storage once the backend is connected.
                </p>
                <Button
                  variant="secondary"
                  size="sm"
                  className="mt-3"
                  onClick={() =>
                    toast({
                      title: 'Photo upload is not connected yet',
                      description: 'Images will be uploaded to Supabase Storage.',
                      tone: 'info',
                    })
                  }
                >
                  Upload a photograph
                </Button>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle as="h2">How you describe yourself</CardTitle>
            </CardHeader>
            <CardBody className="space-y-4">
              <Field
                label="Headline"
                hint="One line, shown on your card in search results."
              >
                {({ id, describedBy }) => (
                  <Input
                    id={id}
                    aria-describedby={describedBy}
                    value={draft.headline ?? ''}
                    maxLength={110}
                    onChange={(event) => update({ headline: event.target.value })}
                  />
                )}
              </Field>

              <Field
                label="About you"
                hint="Two or three sentences. Who you teach and what you are good at."
              >
                {({ id, describedBy }) => (
                  <Textarea
                    id={id}
                    aria-describedby={describedBy}
                    value={draft.about ?? ''}
                    onChange={(event) => update({ about: event.target.value })}
                  />
                )}
              </Field>

              <Field
                label="Teaching approach"
                hint="What actually happens in one of your lessons."
              >
                {({ id, describedBy }) => (
                  <Textarea
                    id={id}
                    aria-describedby={describedBy}
                    value={draft.teachingApproach ?? ''}
                    onChange={(event) => update({ teachingApproach: event.target.value })}
                  />
                )}
              </Field>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle as="h2">Subjects, levels and rate</CardTitle>
            </CardHeader>
            <CardBody className="space-y-5">
              <fieldset>
                <legend className="text-ink mb-2 text-sm font-medium">Subjects</legend>
                <div className="flex flex-wrap gap-2">
                  {getSubjects().map((subject) => {
                    const active = (draft.subjects ?? []).includes(subject.id);
                    return (
                      <button
                        key={subject.id}
                        type="button"
                        aria-pressed={active}
                        onClick={() =>
                          update({
                            subjects: active
                              ? (draft.subjects ?? []).filter((id) => id !== subject.id)
                              : [...(draft.subjects ?? []), subject.id],
                          })
                        }
                        className={`min-h-10 rounded-[var(--radius-control)] border px-3 text-sm font-medium transition-colors duration-[var(--duration-fast)] ${
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
              </fieldset>

              <fieldset>
                <legend className="text-ink mb-2 text-sm font-medium">Levels</legend>
                <div className="flex flex-wrap gap-2">
                  {educationLevels.map((level) => {
                    const active = (draft.levels ?? []).includes(level as EducationLevel);
                    return (
                      <button
                        key={level}
                        type="button"
                        aria-pressed={active}
                        onClick={() =>
                          update({
                            levels: active
                              ? (draft.levels ?? []).filter((item) => item !== level)
                              : [...(draft.levels ?? []), level as EducationLevel],
                          })
                        }
                        className={`min-h-10 rounded-[var(--radius-control)] border px-3 text-sm font-medium transition-colors duration-[var(--duration-fast)] ${
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
              </fieldset>

              <Field
                label="Hourly rate"
                hint="In pounds. Tutor Hub adds a service fee on top for the student."
              >
                {({ id, describedBy }) => (
                  <Input
                    id={id}
                    type="number"
                    min={15}
                    max={150}
                    aria-describedby={describedBy}
                    value={Math.round((draft.hourlyRate ?? 0) / 100)}
                    onChange={(event) =>
                      update({ hourlyRate: Number(event.target.value) * 100 })
                    }
                    className="max-w-40"
                  />
                )}
              </Field>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle as="h2">Qualifications</CardTitle>
            </CardHeader>
            <CardBody className="space-y-4">
              <ul className="space-y-2">
                {(draft.qualifications ?? []).map((qualification) => (
                  <li
                    key={`${qualification.title}-${qualification.year}`}
                    className="border-line bg-surface-subtle flex items-start justify-between gap-3 rounded-[var(--radius-control)] border p-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{qualification.title}</p>
                      <p className="text-ink-subtle text-xs">
                        {qualification.institution} · {qualification.year}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        update({
                          qualifications: (draft.qualifications ?? []).filter(
                            (item) => item !== qualification,
                          ),
                        })
                      }
                      className="text-ink-subtle hover:text-danger -m-1 shrink-0 p-1"
                    >
                      <Trash2 className="size-4" aria-hidden />
                      <span className="sr-only">Remove {qualification.title}</span>
                    </button>
                  </li>
                ))}
              </ul>

              <div className="border-line grid gap-3 border-t pt-4 sm:grid-cols-[1.4fr_1fr_auto]">
                <Field label="Qualification">
                  {({ id }) => (
                    <Input
                      id={id}
                      value={newQual.title}
                      placeholder="MSc Mathematics"
                      onChange={(event) =>
                        setNewQual({ ...newQual, title: event.target.value })
                      }
                    />
                  )}
                </Field>
                <Field label="Institution">
                  {({ id }) => (
                    <Input
                      id={id}
                      value={newQual.institution}
                      placeholder="University of Leeds"
                      onChange={(event) =>
                        setNewQual({ ...newQual, institution: event.target.value })
                      }
                    />
                  )}
                </Field>
                <div className="flex items-end">
                  <Button
                    variant="secondary"
                    disabled={!newQual.title.trim() || !newQual.institution.trim()}
                    onClick={() => {
                      update({
                        qualifications: [...(draft.qualifications ?? []), newQual],
                      });
                      setNewQual({
                        title: '',
                        institution: '',
                        year: new Date().getFullYear(),
                      });
                      toast({ title: 'Qualification added' });
                    }}
                  >
                    <Plus className="size-4" aria-hidden />
                    Add
                  </Button>
                </div>
              </div>
              <p className="text-ink-subtle text-xs leading-relaxed">
                Certificates are checked by the Tutor Hub team before a qualification is
                shown with a verified marker. Document upload is not connected in this
                build.
              </p>
            </CardBody>
          </Card>
        </div>

        <aside>
          <div className="xl:sticky xl:top-24">
            <p className="text-ink-subtle mb-2 text-sm font-medium">
              Preview — how your card appears in search
            </p>
            <Card className="p-5">
              <div className="flex items-start gap-3.5">
                <Avatar
                  firstName={tutor.firstName}
                  lastName={tutor.lastName}
                  tone={tutor.avatarTone}
                  size="md"
                />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">
                    {tutor.firstName} {tutor.lastName}
                  </p>
                  <p className="text-ink-muted mt-0.5 truncate text-sm">
                    {(draft.subjects ?? []).map((id) => subjectName(id)).join(' · ') ||
                      'No subjects selected'}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="tabular font-semibold">
                    {formatPence(draft.hourlyRate ?? 0)}
                  </p>
                  <p className="text-ink-subtle text-xs">per hour</p>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Rating value={tutor.rating} count={tutor.reviewCount} size="sm" />
                {tutor.verified && <VerifiedBadge />}
              </div>

              <p className="text-ink-subtle mt-2.5 text-xs">
                {(draft.levels ?? []).join(' · ') || 'No levels selected'}
              </p>

              <p className="text-ink-muted mt-3 line-clamp-2 text-sm leading-relaxed">
                {draft.headline || 'Add a headline so students know what you teach.'}
              </p>
            </Card>

            <div className="border-line bg-surface mt-4 rounded-[var(--radius-card)] border p-4">
              <p className="text-sm font-semibold">Status</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {tutor.verified ? (
                  <VerifiedBadge />
                ) : (
                  <Badge tone="warning">Awaiting verification</Badge>
                )}
                {tutor.featured && <Badge tone="mint">Featured</Badge>}
                <Badge tone="neutral">{tutor.lessonsCompleted} lessons taught</Badge>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function SaveIndicator({ state }: { state: 'idle' | 'saving' | 'saved' }) {
  if (state === 'idle') return null;
  return (
    <p className="text-ink-subtle flex items-center gap-1.5 text-sm" aria-live="polite">
      {state === 'saving' ? (
        <>
          <Loader2 className="size-4 animate-spin" aria-hidden />
          Saving
        </>
      ) : (
        <>
          <Check className="text-success size-4" aria-hidden />
          Saved
        </>
      )}
    </p>
  );
}
