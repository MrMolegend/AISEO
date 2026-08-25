import { AuthMessage } from '@/components/auth/auth-shell';

/**
 * The banner that says something actually happened.
 *
 * A redirect on its own is not evidence. Landing on the dashboard could mean
 * the sign-in worked, or that you were already signed in, or that you clicked
 * the logo — and the whole failure this release fixes was a user being
 * redirected back to a page that gave them no way to tell which.
 *
 * Driven by a query parameter rather than client state so it survives the
 * server render and is announced by a screen reader on arrival, not after
 * hydration.
 */

const NOTICES = {
  'signed-out': {
    tone: 'info' as const,
    title: 'You have been signed out.',
    body: 'Your session is closed on this device.',
  },
  welcome: {
    tone: 'success' as const,
    title: 'Your account is ready.',
    body: null,
  },
  'password-reset': {
    tone: 'success' as const,
    title: 'Your password has been updated.',
    body: 'Use it the next time you sign in.',
  },
} as const;

export type NoticeKind = keyof typeof NOTICES;

export function isNoticeKind(value: string | undefined): value is NoticeKind {
  return value !== undefined && value in NOTICES;
}

export function FlashNotice({
  kind,
  email,
}: {
  kind: NoticeKind;
  /** Shown in the welcome message, so the user can see which account they got. */
  email?: string | null;
}) {
  const notice = NOTICES[kind];

  return (
    <div className="mb-8">
      <AuthMessage tone={notice.tone} title={notice.title}>
        {kind === 'welcome' && email
          ? `You're signed in as ${email}.`
          : (notice.body ?? "You're signed in.")}
      </AuthMessage>
    </div>
  );
}
