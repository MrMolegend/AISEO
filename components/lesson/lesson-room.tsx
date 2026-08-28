'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowLeft,
  CheckCircle2,
  Flag,
  Mic,
  MicOff,
  Send,
  Signal,
  Video,
  VideoOff,
  X,
} from 'lucide-react';
import { LogoMark } from '@/components/brand/logo';
import { Button, ButtonLink } from '@/components/ui/button';
import { Modal } from '@/components/ui/overlay';
import { Select, Textarea } from '@/components/ui/field';
import { CallControls, type PanelId } from './call-controls';
import { VideoTile } from './video-tile';
import { useLocalCamera } from '@/lib/lesson/use-local-camera';
import { QUALITY_LABEL, demoLessonProvider } from '@/lib/lesson/provider';
import { useDemo } from '@/lib/store/demo-store';
import { useToast } from '@/lib/store/toast';
import { bookingLearnerName, getTutor, subjectName } from '@/lib/queries';
import { DASHBOARD_HOME } from '@/lib/nav';
import { countdownParts, formatLongDate, formatTimeRange } from '@/lib/datetime';
import type { Booking } from '@/lib/types';

type Phase = 'check' | 'call' | 'summary';

interface RoomMessage {
  id: number;
  author: string;
  body: string;
}

/**
 * Tutor Hub's lesson room.
 *
 * It is a complete interface for a call that is not connected: the local
 * self-view is real when the visitor allows the camera, the far tile is
 * honestly a placeholder, and everything else — timer, controls, panels,
 * layout — genuinely changes what is on screen. All the video-service specifics
 * live behind `lib/lesson/provider.ts`.
 */
export function LessonRoom({ booking }: { booking: Booking }) {
  const router = useRouter();
  const { account, role } = useDemo();
  const { toast } = useToast();
  const camera = useLocalCamera();

  const [phase, setPhase] = useState<Phase>('check');
  const [micOn, setMicOn] = useState(true);
  const [cameraOn, setCameraOn] = useState(true);
  const [sharing, setSharing] = useState(false);
  const [panel, setPanel] = useState<PanelId>('objectives');
  const [layout, setLayout] = useState<'grid' | 'focus'>('grid');
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportBody, setReportBody] = useState('');
  const [reportCategory, setReportCategory] = useState('Audio or video problem');

  const tutor = getTutor(booking.tutorId);
  const viewerIsTutor = role === 'tutor';
  const studentName = bookingLearnerName(booking);
  const tutorFullName = tutor ? `${tutor.firstName} ${tutor.lastName}` : 'Tutor';

  const localName = viewerIsTutor
    ? tutorFullName
    : account
      ? `${account.firstName} ${account.lastName}`
      : studentName;
  const remoteName = viewerIsTutor ? studentName : tutorFullName;

  const [notes, setNotes] = useState(
    (booking.objectives ?? []).map((line) => `• ${line}`).join('\n'),
  );
  const [messages, setMessages] = useState<RoomMessage[]>([
    {
      id: 1,
      author: remoteName,
      body: 'Joining now — give me a second to open the paper.',
    },
  ]);
  const [draft, setDraft] = useState('');

  useEffect(() => {
    if (phase !== 'call' || startedAt === null) return;
    const timer = window.setInterval(() => setElapsed(Date.now() - startedAt), 1000);
    return () => window.clearInterval(timer);
  }, [phase, startedAt]);

  const timeLabel = useMemo(() => {
    const { hours, minutes, seconds } = countdownParts(elapsed);
    const pad = (value: number) => String(value).padStart(2, '0');
    return hours > 0
      ? `${hours}:${pad(minutes)}:${pad(seconds)}`
      : `${pad(minutes)}:${pad(seconds)}`;
  }, [elapsed]);

  function toggleMic() {
    const next = !micOn;
    setMicOn(next);
    camera.setTrackEnabled('audio', next);
  }

  async function toggleCamera() {
    const next = !cameraOn;
    setCameraOn(next);
    if (next && camera.status !== 'ready') {
      await camera.request({ video: true, audio: false });
    } else {
      camera.setTrackEnabled('video', next);
    }
  }

  function leave() {
    camera.stop();
    setPhase('summary');
  }

  /* ── Pre-call device check ──────────────────────────────────────────── */

  if (phase === 'check') {
    return (
      <div className="flex min-h-dvh flex-col bg-[#0d1322] text-white">
        <RoomHeader booking={booking} tutorName={tutorFullName} />

        <main id="main" className="container-page flex flex-1 items-center py-8">
          <div className="mx-auto grid w-full max-w-4xl gap-8 lg:grid-cols-2 lg:items-center">
            <div>
              <VideoTile
                name={localName}
                role={viewerIsTutor ? 'Tutor' : 'Student'}
                initials={initialsOf(localName)}
                stream={camera.stream}
                cameraOn={cameraOn}
                micOn={micOn}
                isLocal
                className="aspect-[4/3] w-full"
              />

              <div className="mt-4 flex flex-wrap items-center gap-2.5">
                <Button
                  variant="secondary"
                  onClick={async () => {
                    const result = await camera.request({ video: true, audio: true });
                    if (result.error === 'denied') {
                      toast({
                        title: 'Camera access was blocked',
                        description:
                          'The lesson room still works — your tile will show your initials.',
                        tone: 'warning',
                      });
                    }
                  }}
                  className="border-white/20 bg-white/10 text-white hover:bg-white/20"
                >
                  {camera.status === 'ready'
                    ? 'Restart camera'
                    : camera.status === 'requesting'
                      ? 'Waiting for permission…'
                      : 'Test my camera and microphone'}
                </Button>
                {camera.status === 'ready' && (
                  <Button
                    variant="ghost"
                    onClick={camera.stop}
                    className="text-white/70 hover:bg-white/10 hover:text-white"
                  >
                    Turn off preview
                  </Button>
                )}
              </div>

              {camera.status === 'blocked' && (
                <p className="mt-3 rounded-[var(--radius-control)] border border-[#57411e] bg-[#382a12] p-3 text-sm text-[#e6ad5c]">
                  {camera.error === 'denied'
                    ? 'Your browser blocked access. You can still join — your tile will show your initials instead of a picture.'
                    : 'No camera or microphone was available. You can still join the lesson.'}
                </p>
              )}
            </div>

            <div>
              <p className="text-sm font-medium text-[#7fdcbe]">Before you join</p>
              <h1 className="mt-2 text-2xl tracking-[var(--tracking-tight)] text-white">
                {subjectName(booking.subjectId)} with {remoteName}
              </h1>
              <p className="mt-2 text-sm text-white/70">
                {formatLongDate(booking.startsAt)} ·{' '}
                {formatTimeRange(booking.startsAt, booking.durationMins)}
              </p>

              <div className="mt-6 space-y-3">
                <ToggleRow
                  label="Microphone"
                  on={micOn}
                  onChange={toggleMic}
                  onIcon={<Mic className="size-4" aria-hidden />}
                  offIcon={<MicOff className="size-4" aria-hidden />}
                />
                <ToggleRow
                  label="Camera"
                  on={cameraOn}
                  onChange={() => void toggleCamera()}
                  onIcon={<Video className="size-4" aria-hidden />}
                  offIcon={<VideoOff className="size-4" aria-hidden />}
                />
              </div>

              {booking.objectives && booking.objectives.length > 0 && (
                <div className="mt-6 rounded-[var(--radius-card)] border border-white/10 bg-white/5 p-4">
                  <p className="text-xs font-medium text-white/60">
                    What you agreed to cover
                  </p>
                  <ul className="mt-2 space-y-1.5">
                    {booking.objectives.map((objective) => (
                      <li key={objective} className="flex gap-2 text-sm text-white/80">
                        <span className="text-[#7fdcbe]" aria-hidden>
                          •
                        </span>
                        {objective}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <Button
                size="xl"
                className="mt-6 w-full"
                onClick={() => {
                  setPhase('call');
                  setStartedAt(Date.now());
                }}
              >
                Join lesson
              </Button>

              <p className="mt-3 text-xs leading-relaxed text-white/50">
                This is a demonstration of the Tutor Hub lesson room. No call is
                established and nobody else can see or hear you.
              </p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  /* ── Post-call summary ──────────────────────────────────────────────── */

  if (phase === 'summary') {
    const minutes = Math.max(1, Math.round(elapsed / 60_000));
    return (
      <div className="flex min-h-dvh flex-col bg-[#0d1322] text-white">
        <RoomHeader booking={booking} tutorName={tutorFullName} />
        <main id="main" className="container-narrow flex flex-1 items-center py-10">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="w-full"
          >
            <div className="flex items-center gap-3">
              <span className="flex size-11 items-center justify-center rounded-full bg-[#10362c] text-[#58d3ac]">
                <CheckCircle2 className="size-6" aria-hidden />
              </span>
              <div>
                <h1 className="text-2xl tracking-[var(--tracking-tight)] text-white">
                  Lesson ended
                </h1>
                <p className="text-sm text-white/60">
                  {subjectName(booking.subjectId)} with {remoteName}
                </p>
              </div>
            </div>

            <dl className="mt-7 grid gap-3 sm:grid-cols-3">
              <SummaryStat label="Time in the room" value={`${minutes} min`} />
              <SummaryStat
                label="Scheduled length"
                value={`${booking.durationMins} min`}
              />
              <SummaryStat
                label="Objectives covered"
                value={String(booking.objectives?.length ?? 0)}
              />
            </dl>

            <div className="mt-6 rounded-[var(--radius-card)] border border-white/10 bg-white/5 p-5">
              <h2 className="text-base font-semibold text-white">Shared notes</h2>
              <p className="mt-2 text-sm whitespace-pre-wrap text-white/70">
                {notes.trim() || 'No notes were taken in this lesson.'}
              </p>
            </div>

            <div className="mt-6 rounded-[var(--radius-card)] border border-white/10 bg-white/5 p-5">
              <h2 className="text-base font-semibold text-white">What happens next</h2>
              <ul className="mt-2.5 space-y-2 text-sm text-white/70">
                <li>
                  {viewerIsTutor
                    ? 'Add feedback so the student and their parent can see what to work on.'
                    : `${tutor?.firstName ?? 'Your tutor'} will add a short note about what to work on.`}
                </li>
                <li>
                  The lesson moves into your completed list with these notes attached.
                </li>
                <li>
                  {viewerIsTutor
                    ? 'The fee is released to your balance after the lesson.'
                    : 'You can leave a review once the lesson is marked complete.'}
                </li>
              </ul>
            </div>

            <div className="mt-7 flex flex-wrap gap-2.5">
              <ButtonLink href={DASHBOARD_HOME[role ?? 'student']} size="lg">
                Back to dashboard
              </ButtonLink>
              <Button
                variant="secondary"
                size="lg"
                className="border-white/20 bg-white/10 text-white hover:bg-white/20"
                onClick={() => {
                  setPhase('check');
                  setElapsed(0);
                  setStartedAt(null);
                }}
              >
                Rejoin the room
              </Button>
              <Button
                variant="ghost"
                size="lg"
                className="text-white/70 hover:bg-white/10 hover:text-white"
                onClick={() => router.push('/messages')}
              >
                Message {remoteName.split(' ')[0]}
              </Button>
            </div>
          </motion.div>
        </main>
      </div>
    );
  }

  /* ── In the call ────────────────────────────────────────────────────── */

  return (
    <div className="flex min-h-dvh flex-col bg-[#0d1322] text-white">
      <header className="border-b border-white/10 px-4 py-3 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <LogoMark className="size-7 shrink-0" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white">
                {subjectName(booking.subjectId)} · {booking.level}
              </p>
              <p className="text-xs text-white/60">
                with {remoteName} · {booking.reference}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 rounded-md bg-white/10 px-2.5 py-1.5 text-xs text-white/80">
              <Signal className="size-3.5 text-[#58d3ac]" aria-hidden />
              {QUALITY_LABEL[demoLessonProvider.connectionQuality()]}
            </span>
            <span
              className="tabular rounded-md bg-white/10 px-2.5 py-1.5 text-xs font-medium text-white"
              aria-label={`Session time ${timeLabel}`}
            >
              {timeLabel}
            </span>
            <button
              type="button"
              onClick={() => setReportOpen(true)}
              className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs text-white/60 hover:bg-white/10 hover:text-white"
            >
              <Flag className="size-3.5" aria-hidden />
              Report a problem
            </button>
          </div>
        </div>
      </header>

      <main
        id="main"
        className="flex min-h-0 flex-1 flex-col gap-3 p-3 sm:p-4 lg:flex-row"
      >
        <div className="flex min-h-0 flex-1 flex-col gap-3">
          {sharing && (
            <div className="flex items-center justify-center rounded-[var(--radius-panel)] border border-dashed border-white/20 bg-white/5 p-8 text-center">
              <div>
                <p className="text-sm font-medium text-white">You are sharing a screen</p>
                <p className="mt-1 text-xs text-white/60">
                  Screen capture is not connected in this demonstration — the layout shows
                  where the shared view appears.
                </p>
              </div>
            </div>
          )}

          <div
            className={
              layout === 'grid'
                ? 'grid min-h-0 flex-1 gap-3 sm:grid-cols-2'
                : 'relative min-h-0 flex-1'
            }
          >
            <VideoTile
              name={remoteName}
              role={viewerIsTutor ? 'Student' : 'Tutor'}
              initials={initialsOf(remoteName)}
              cameraOn
              micOn
              speaking
              className={layout === 'grid' ? 'min-h-52' : 'size-full min-h-72'}
            />
            <VideoTile
              name={localName}
              role={viewerIsTutor ? 'Tutor' : 'Student'}
              initials={initialsOf(localName)}
              stream={camera.stream}
              cameraOn={cameraOn}
              micOn={micOn}
              isLocal
              className={
                layout === 'grid'
                  ? 'min-h-52'
                  : 'absolute right-4 bottom-4 h-32 w-48 shadow-[var(--shadow-raised)]'
              }
            />
          </div>
        </div>

        <AnimatePresence initial={false}>
          {panel && (
            <motion.aside
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 16 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              className="flex max-h-[45dvh] min-h-0 flex-col rounded-[var(--radius-panel)] border border-white/10 bg-[#151d31] lg:max-h-none lg:w-80"
              aria-label={PANEL_TITLES[panel]}
            >
              <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
                <h2 className="text-sm font-semibold text-white">
                  {PANEL_TITLES[panel]}
                </h2>
                <button
                  type="button"
                  onClick={() => setPanel(null)}
                  className="-m-1.5 rounded p-1.5 text-white/60 hover:bg-white/10 hover:text-white"
                >
                  <X className="size-4" aria-hidden />
                  <span className="sr-only">Close panel</span>
                </button>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto p-4">
                {panel === 'objectives' && (
                  <ul className="space-y-2.5">
                    {(
                      booking.objectives ?? [
                        'Work through the questions you are stuck on',
                      ]
                    ).map((objective) => (
                      <li key={objective} className="flex gap-2.5 text-sm text-white/80">
                        <CheckCircle2
                          className="mt-0.5 size-4 shrink-0 text-[#58d3ac]"
                          aria-hidden
                        />
                        {objective}
                      </li>
                    ))}
                  </ul>
                )}

                {panel === 'notes' && (
                  <>
                    <label htmlFor="lesson-notes" className="sr-only">
                      Shared lesson notes
                    </label>
                    <textarea
                      id="lesson-notes"
                      value={notes}
                      onChange={(event) => setNotes(event.target.value)}
                      placeholder="Notes taken here are shared with the other person and saved with the lesson."
                      className="min-h-40 w-full resize-none rounded-[var(--radius-control)] border border-white/15 bg-white/5 p-3 text-sm text-white placeholder:text-white/40 focus:border-[#8f9dff]"
                    />
                    <p className="mt-2 text-xs text-white/50">
                      Notes appear on the lesson summary when the call ends.
                    </p>
                  </>
                )}

                {panel === 'chat' && (
                  <ul className="space-y-3">
                    {messages.map((message) => (
                      <li key={message.id}>
                        <p className="text-xs font-medium text-white/60">
                          {message.author}
                        </p>
                        <p className="mt-1 rounded-[var(--radius-control)] bg-white/8 px-3 py-2 text-sm text-white/90">
                          {message.body}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}

                {panel === 'settings' && (
                  <div className="space-y-4 text-sm">
                    <div>
                      <label
                        htmlFor="camera-select"
                        className="mb-1.5 block text-xs font-medium text-white/60"
                      >
                        Camera
                      </label>
                      <Select
                        id="camera-select"
                        defaultValue="default"
                        className="border-white/15 bg-white/5 text-white"
                      >
                        <option value="default">System default camera</option>
                      </Select>
                    </div>
                    <div>
                      <label
                        htmlFor="mic-select"
                        className="mb-1.5 block text-xs font-medium text-white/60"
                      >
                        Microphone
                      </label>
                      <Select
                        id="mic-select"
                        defaultValue="default"
                        className="border-white/15 bg-white/5 text-white"
                      >
                        <option value="default">System default microphone</option>
                      </Select>
                    </div>
                    <p className="text-xs leading-relaxed text-white/50">
                      Device selection becomes real once a video provider is connected.
                      Until then this panel shows where it will live.
                    </p>
                    <Button
                      variant="secondary"
                      size="sm"
                      className="border-white/20 bg-white/10 text-white hover:bg-white/20"
                      onClick={() => setPanel('objectives')}
                    >
                      Back to objectives
                    </Button>
                  </div>
                )}
              </div>

              {panel === 'chat' && (
                <form
                  className="border-t border-white/10 p-3"
                  onSubmit={(event) => {
                    event.preventDefault();
                    const body = draft.trim();
                    if (!body) return;
                    setMessages((current) => [
                      ...current,
                      { id: current.length + 1, author: 'You', body },
                    ]);
                    setDraft('');
                  }}
                >
                  <div className="flex items-center gap-2">
                    <label htmlFor="lesson-chat" className="sr-only">
                      Message in the lesson
                    </label>
                    <input
                      id="lesson-chat"
                      value={draft}
                      onChange={(event) => setDraft(event.target.value)}
                      placeholder="Send a message"
                      className="h-10 flex-1 rounded-[var(--radius-control)] border border-white/15 bg-white/5 px-3 text-sm text-white placeholder:text-white/40 focus:border-[#8f9dff]"
                    />
                    <Button type="submit" size="sm" disabled={!draft.trim()}>
                      <Send className="size-4" aria-hidden />
                      <span className="sr-only">Send</span>
                    </Button>
                  </div>
                </form>
              )}
            </motion.aside>
          )}
        </AnimatePresence>
      </main>

      <footer className="border-t border-white/10 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6">
        <CallControls
          micOn={micOn}
          cameraOn={cameraOn}
          sharing={sharing}
          panel={panel}
          layout={layout}
          onToggleMic={toggleMic}
          onToggleCamera={() => void toggleCamera()}
          onToggleShare={() => {
            setSharing((value) => !value);
            toast({
              title: sharing ? 'Stopped sharing' : 'Screen share placeholder',
              description: sharing
                ? undefined
                : 'Screen capture connects with the video provider.',
              tone: 'info',
            });
          }}
          onPanel={setPanel}
          onToggleLayout={() =>
            setLayout((value) => (value === 'grid' ? 'focus' : 'grid'))
          }
          onLeave={leave}
        />
      </footer>

      <Modal
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        title="Report a problem"
        description="Tell us what went wrong and the platform team will look into it."
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setReportOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={!reportBody.trim()}
              onClick={() => {
                setReportOpen(false);
                setReportBody('');
                toast({
                  title: 'Report submitted',
                  description: 'It would appear in the admin reports queue.',
                });
              }}
            >
              Send report
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div>
            <label
              htmlFor="report-category"
              className="text-ink mb-1.5 block text-sm font-medium"
            >
              What kind of problem?
            </label>
            <Select
              id="report-category"
              value={reportCategory}
              onChange={(event) => setReportCategory(event.target.value)}
            >
              <option>Audio or video problem</option>
              <option>The other person did not join</option>
              <option>Behaviour in the lesson</option>
              <option>Billing query</option>
              <option>Something else</option>
            </Select>
          </div>
          <div>
            <label
              htmlFor="report-body"
              className="text-ink mb-1.5 block text-sm font-medium"
            >
              What happened?
            </label>
            <Textarea
              id="report-body"
              value={reportBody}
              onChange={(event) => setReportBody(event.target.value)}
              placeholder="A sentence or two is enough."
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}

const PANEL_TITLES: Record<NonNullable<PanelId>, string> = {
  chat: 'Lesson chat',
  notes: 'Shared notes',
  objectives: 'Lesson objectives',
  settings: 'Devices and settings',
};

function RoomHeader({ booking, tutorName }: { booking: Booking; tutorName: string }) {
  return (
    <header className="border-b border-white/10 px-4 py-3 sm:px-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <LogoMark className="size-7" />
          <p className="text-sm font-medium text-white">
            {subjectName(booking.subjectId)} with {tutorName}
          </p>
        </div>
        <Link
          href="/student/lessons"
          className="flex items-center gap-1.5 rounded-[var(--radius-control)] px-2.5 py-2 text-sm text-white/70 hover:bg-white/10 hover:text-white"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Lessons
        </Link>
      </div>
    </header>
  );
}

function ToggleRow({
  label,
  on,
  onChange,
  onIcon,
  offIcon,
}: {
  label: string;
  on: boolean;
  onChange: () => void;
  onIcon: React.ReactNode;
  offIcon: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onChange}
      aria-pressed={on}
      className="flex w-full items-center justify-between gap-3 rounded-[var(--radius-control)] border border-white/15 bg-white/5 px-4 py-3 text-sm text-white hover:bg-white/10"
    >
      <span className="flex items-center gap-2.5">
        {on ? onIcon : offIcon}
        {label}
      </span>
      <span className={on ? 'text-[#7fdcbe]' : 'text-white/50'}>{on ? 'On' : 'Off'}</span>
    </button>
  );
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[var(--radius-card)] border border-white/10 bg-white/5 p-4">
      <dt className="text-xs text-white/60">{label}</dt>
      <dd className="tabular mt-1 text-xl font-semibold text-white">{value}</dd>
    </div>
  );
}

function initialsOf(name: string): string {
  const [first = '', last = ''] = name.split(' ');
  return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase();
}
